import { useCallback, useRef, useState } from 'react';
import { connector } from '../../../../connector';
import type { Ack } from '../../../../lib/types';
import { ATTACK_EMOJI } from '../../../logic/emoji';
import {
  DRAG_THRESHOLD,
  getScales,
  getScreenOffset,
  HIT_RADIUS_MULTIPLIER,
  HIT_TOLERANCE,
  type DragState,
  type Point,
} from '../../helpers';
import type { CanvasInteractionsParams } from './types';
import { useCanvasKeyboard } from './useCanvasKeyboard';
import { useMapViewportAnimation } from './useMapViewportAnimation';

const SYNTHETIC_MOUSE_WINDOW_MS = 500;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_DIST = 24;

function touchDistance(touches: React.TouchList): number {
  return Math.hypot(
    touches[0].clientX - touches[1].clientX,
    touches[0].clientY - touches[1].clientY,
  );
}

function touchMidpoint(touches: React.TouchList): {
  clientX: number;
  clientY: number;
} {
  return {
    clientX: (touches[0].clientX + touches[1].clientX) / 2,
    clientY: (touches[0].clientY + touches[1].clientY) / 2,
  };
}

export function useCanvasInteractions(params: CanvasInteractionsParams) {
  const {
    canvasRef,
    territories,
    seaTerritories,
    sailStartTerritoryId,
    sailEndTerritoryId,
    sailStartCandidates,
    sailEndCandidates,
    selectSailStart,
    selectSailEnd,
    submitSail,
    cancelSail,
    attackSeaTerritoryId,
    attackSeaDefenderId,
    attackSeaStartCandidates,
    attackSeaRevealing,
    attackSeaDiceOnly,
    setAttackSeaDiceRoll,
    selectAttackSeaStart,
    submitAttackSea,
    cancelAttackSea,
    transform,
    setTransform,
    imgDims,
    VERTEX_RADIUS,
    gameEnded,
    isMyTurn,
    paused,
    turnPhase,
    selfId,
    selectedTerritoryId,
    territoryClaimCandidates,
    troopsToDeploy,
    supplyConnectedTerritoryIds,
    ownerById,
    fortifyStartTerritoryId,
    fortifyEndTerritoryId,
    fortifyStartCandidates,
    fortifyEndCandidates,
    attackPendingConquest,
    attackStartTerritoryId,
    attackEndTerritoryId,
    blitzEnabled,
    attackStartCandidates,
    attackEndCandidates,
    attackDiceRoll,
    setAttackDiceRoll,
    attackRevealing,
    entrenchCandidates,
    toxinsCandidates,
    nukeTargeting,
    setNukeTargeting,
    antiNukeTerritoryIds,
    pendingAttackEmoji,
    setPendingAttackEmoji,
    sendEmoji,
    setToasts,
    setGame,
    submitDeploy,
    deploySeaCandidates,
    deploySeaTerritoryId,
    selectDeploySea,
    cancelDeploySea,
    submitDeploySea,
    comboActive,
    isSeaAdjacentToTerritory,
    cancelFortify,
    selectFortifyStart,
    selectFortifyEnd,
    submitFortify,
    submitEntrench,
    submitToxins,
    selectAttackStart,
    selectAttackEnd,
    quickAttack,
    submitAttackMove,
    cancelAttack,
    submitAttack,
  } = params;
  const dragRef = useRef<DragState>(null);
  const pinchRef = useRef<{ lastDistance: number } | null>(null);
  const lastTouchAtRef = useRef(0);
  const lastTapAtRef = useRef(0);
  const lastTapPosRef = useRef<Point>({ x: 0, y: 0 });
  const { zoomAround, startSettle, cancelSettle, resetView } =
    useMapViewportAnimation(canvasRef, transform, imgDims, setTransform);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [tooltipTerritoryId, setTooltipTerritoryId] = useState<number | null>(
    null,
  );

  function isSyntheticMouseEvent(): boolean {
    return Date.now() - lastTouchAtRef.current < SYNTHETIC_MOUSE_WINDOW_MS;
  }

  const selectTerritory = useCallback(
    (territoryId: number | null) => {
      connector.selectTerritory({ territoryId }, (res: Ack) => {
        if (res.ok) setGame(res.game);
      });
    },
    [setGame],
  );

  const selectCapital = useCallback(
    (territoryId: number) => {
      connector.selectCapital({ territoryId }, (res: Ack) => {
        if (res.ok) setGame(res.game);
      });
    },
    [setGame],
  );

  const claimTerritory = useCallback(
    (territoryId: number) => {
      connector.claimTerritory({ territoryId }, (res: Ack) => {
        if (res.ok) setGame(res.game);
      });
    },
    [setGame],
  );

  const nukeCandidates = new Set<number>(
    nukeTargeting === null
      ? []
      : nukeTargeting === 'launch'
        ? territories
            .filter((t) => ownerById.get(t.id)?.ownerId !== selfId)
            .map((t) => t.id)
        : territories
            .filter(
              (t) =>
                ownerById.get(t.id)?.ownerId === selfId &&
                !antiNukeTerritoryIds.includes(t.id),
            )
            .map((t) => t.id),
  );

  function isInteractable(t: { id: number }): boolean {
    if (pendingAttackEmoji) return true;
    if (gameEnded || !isMyTurn || paused) return false;
    if (nukeTargeting) return nukeCandidates.has(t.id);
    if (turnPhase === 'territory') return territoryClaimCandidates.has(t.id);
    if (turnPhase === 'capital') return ownerById.get(t.id)?.ownerId === selfId;
    if (turnPhase === 'deploy' || turnPhase === 'troop') {
      if (seaIdSet.has(t.id))
        return turnPhase === 'deploy' && deploySeaCandidates.has(t.id);
      return (
        troopsToDeploy > 0 &&
        ownerById.get(t.id)?.ownerId === selfId &&
        (supplyConnectedTerritoryIds === null ||
          supplyConnectedTerritoryIds.has(t.id))
      );
    }
    if (turnPhase === 'sail') {
      if (sailStartTerritoryId === null) return sailStartCandidates.has(t.id);
      if (sailEndTerritoryId === null) return sailEndCandidates.has(t.id);
      return false;
    }
    if (turnPhase === 'fortify') {
      if (fortifyStartTerritoryId === null)
        return fortifyStartCandidates.has(t.id);
      if (fortifyEndTerritoryId === null) return fortifyEndCandidates.has(t.id);
      return false;
    }
    if (turnPhase === 'attack') {
      if (attackPendingConquest) return false;
      if (seaIdSet.has(t.id)) {
        if (attackSeaTerritoryId === null)
          return (
            attackStartTerritoryId === null &&
            attackSeaStartCandidates.has(t.id)
          );
        return t.id === attackSeaTerritoryId;
      }
      if (attackStartTerritoryId === null)
        return attackSeaTerritoryId === null && attackStartCandidates.has(t.id);
      if (attackEndTerritoryId === null) return attackEndCandidates.has(t.id);
      return false;
    }
    if (turnPhase === 'entrench') return entrenchCandidates.has(t.id);
    if (turnPhase === 'toxins') return toxinsCandidates.has(t.id);
    return true;
  }

  function nodeState(
    id: number,
  ): 'normal' | 'selectable' | 'hovered' | 'selected' {
    if (nukeTargeting) {
      if (id === hoveredId) return 'hovered';
      return nukeCandidates.has(id) ? 'selectable' : 'normal';
    }
    if (turnPhase === 'territory') {
      if (id === hoveredId) return 'hovered';
      return territoryClaimCandidates.has(id) ? 'selectable' : 'normal';
    }
    if (turnPhase === 'sail') {
      if (id === sailStartTerritoryId || id === sailEndTerritoryId)
        return 'selected';
      if (id === hoveredId) return 'hovered';
      if (
        sailStartTerritoryId !== null &&
        sailEndTerritoryId === null &&
        sailEndCandidates.has(id)
      )
        return 'selectable';
      return 'normal';
    }
    if (turnPhase === 'fortify') {
      if (id === fortifyStartTerritoryId || id === fortifyEndTerritoryId)
        return 'selected';
      if (id === hoveredId) return 'hovered';
      if (
        fortifyStartTerritoryId !== null &&
        fortifyEndTerritoryId === null &&
        fortifyEndCandidates.has(id)
      )
        return 'selectable';
      return 'normal';
    }
    if (turnPhase === 'attack') {
      if (seaIdSet.has(id)) {
        if (id === attackSeaTerritoryId) return 'selected';
        if (id === hoveredId) return 'hovered';
        return 'normal';
      }
      if (id === attackStartTerritoryId || id === attackEndTerritoryId)
        return 'selected';
      if (id === hoveredId) return 'hovered';
      if (
        attackStartTerritoryId !== null &&
        attackEndTerritoryId === null &&
        attackEndCandidates.has(id)
      )
        return 'selectable';
      return 'normal';
    }
    if (id === selectedTerritoryId || id === deploySeaTerritoryId)
      return 'selected';
    if (id === hoveredId) return 'hovered';
    if (
      turnPhase !== 'deploy' &&
      turnPhase !== 'troop' &&
      turnPhase !== 'entrench' &&
      turnPhase !== 'toxins' &&
      selectedTerritoryId !== null
    ) {
      const selected = territories.find((t) => t.id === selectedTerritoryId);
      if (selected?.neighbors.includes(id)) return 'selectable';
    }
    return 'normal';
  }

  function getPos(e: { clientX: number; clientY: number }): Point {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function hitVertex(pos: Point): { id: number } | null {
    const canvas = canvasRef.current!;
    const { scaleX, scaleY } = getScales(
      canvas.clientWidth,
      canvas.clientHeight,
      transform.zoom,
      imgDims,
    );
    const { x: offsetX, y: offsetY } = getScreenOffset(
      canvas.clientWidth,
      canvas.clientHeight,
      transform.zoom,
      transform.offsetX,
      transform.offsetY,
      imgDims,
    );
    const hitRadius =
      VERTEX_RADIUS * HIT_RADIUS_MULTIPLIER * scaleX + HIT_TOLERANCE;
    let nearest: { id: number } | null = null;
    let nearestDist = Infinity;
    for (const t of [...territories, ...seaTerritories]) {
      const d = Math.hypot(
        pos.x - (t.x * scaleX + offsetX),
        pos.y - (t.y * scaleY + offsetY),
      );
      if (d <= hitRadius && d < nearestDist) {
        nearest = t;
        nearestDist = d;
      }
    }
    return nearest;
  }

  const seaIdSet = new Set(seaTerritories.map((s) => s.id));

  function beginDrag(pos: Point) {
    cancelSettle();
    dragRef.current = {
      startPos: pos,
      startTransform: { x: transform.offsetX, y: transform.offsetY },
      moved: false,
    };
  }

  function updateDrag(pos: Point) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = pos.x - drag.startPos.x;
    const dy = pos.y - drag.startPos.y;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD) drag.moved = true;
    if (!drag.moved) return;
    setTransform((t) => ({
      ...t,
      offsetX: drag.startTransform.x + dx,
      offsetY: drag.startTransform.y + dy,
    }));
    setHoveredId(null);
    setTooltipTerritoryId(null);
    setIsDragging(true);
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0 || isSyntheticMouseEvent()) return;
    beginDrag(getPos(e));
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (isSyntheticMouseEvent()) return;
    const pos = getPos(e);
    if (!dragRef.current) {
      const vertex = hitVertex(pos);
      setHoveredId(vertex && isInteractable(vertex) ? vertex.id : null);
      setTooltipTerritoryId(vertex ? vertex.id : null);
      return;
    }
    updateDrag(pos);
  }

  function consumeDoubleTap(pos: Point): boolean {
    if (hitVertex(pos)) {
      lastTapAtRef.current = 0;
      return false;
    }
    const now = Date.now();
    const isDouble =
      now - lastTapAtRef.current < DOUBLE_TAP_MS &&
      Math.hypot(
        pos.x - lastTapPosRef.current.x,
        pos.y - lastTapPosRef.current.y,
      ) < DOUBLE_TAP_DIST;
    lastTapAtRef.current = isDouble ? 0 : now;
    lastTapPosRef.current = pos;
    if (isDouble) resetView();
    return isDouble;
  }

  function handleTap(pos: Point) {
    const vertex = hitVertex(pos);

    if (pendingAttackEmoji) {
      if (vertex)
        sendEmoji(pendingAttackEmoji.targetPlayerId, ATTACK_EMOJI, {
          type: 'territory',
          territoryId: vertex.id,
        });
      setPendingAttackEmoji(null);
      return;
    }

    if (gameEnded || !isMyTurn || paused) return;

    if (nukeTargeting && turnPhase === 'attack') {
      if (vertex && nukeCandidates.has(vertex.id)) {
        const submit =
          nukeTargeting === 'launch'
            ? connector.launchNuke
            : connector.deployAntiNuke;
        submit({ territoryId: vertex.id }, (res: Ack) => {
          if (res.ok) setGame(res.game);
          else
            setToasts((prev) => [
              ...prev,
              { id: Date.now(), message: res.error },
            ]);
        });
      }
      setNukeTargeting(null);
      return;
    }

    if (turnPhase === 'territory') {
      if (vertex && isInteractable(vertex)) claimTerritory(vertex.id);
      return;
    }

    if (turnPhase === 'capital') {
      if (vertex && isInteractable(vertex)) selectCapital(vertex.id);
      return;
    }

    if (turnPhase === 'sail') {
      if (sailEndTerritoryId !== null) {
        if (
          vertex &&
          (vertex.id === sailStartTerritoryId ||
            vertex.id === sailEndTerritoryId)
        ) {
          submitSail();
        } else {
          cancelSail();
        }
        return;
      }
      if (!vertex || !isInteractable(vertex)) {
        if (
          sailStartTerritoryId !== null &&
          vertex?.id !== sailStartTerritoryId
        )
          cancelSail();
        return;
      }
      if (sailStartTerritoryId === null) {
        selectSailStart(vertex.id);
      } else {
        selectSailEnd(vertex.id);
      }
      return;
    }

    if (turnPhase === 'fortify') {
      if (fortifyEndTerritoryId !== null) {
        if (
          vertex &&
          (vertex.id === fortifyStartTerritoryId ||
            vertex.id === fortifyEndTerritoryId)
        ) {
          submitFortify();
        } else {
          cancelFortify();
        }
        return;
      }
      if (!vertex || !isInteractable(vertex)) {
        if (
          fortifyStartTerritoryId !== null &&
          vertex?.id !== fortifyStartTerritoryId
        )
          cancelFortify();
        return;
      }
      if (fortifyStartTerritoryId === null) {
        selectFortifyStart(vertex.id);
      } else {
        selectFortifyEnd(vertex.id);
      }
      return;
    }

    if (turnPhase === 'attack') {
      if (attackPendingConquest) {
        if (vertex && vertex.id === attackEndTerritoryId) submitAttackMove();
        return;
      }
      if (vertex && seaIdSet.has(vertex.id)) {
        if (attackSeaRevealing) return;
        if (attackSeaTerritoryId !== null) {
          if (vertex.id === attackSeaTerritoryId) {
            if (attackSeaDefenderId !== null) submitAttackSea();
          } else {
            cancelAttackSea();
          }
        } else if (isInteractable(vertex)) {
          selectAttackSeaStart(vertex.id);
        }
        return;
      }
      if (attackSeaTerritoryId !== null) {
        if (!attackSeaRevealing) cancelAttackSea();
        return;
      }
      if (attackEndTerritoryId !== null) {
        if (
          !attackRevealing &&
          vertex &&
          (vertex.id === attackStartTerritoryId ||
            vertex.id === attackEndTerritoryId)
        ) {
          submitAttack();
        } else {
          cancelAttack();
        }
        return;
      }
      if (!vertex || !isInteractable(vertex)) {
        if (attackStartTerritoryId !== null) {
          if (vertex?.id !== attackStartTerritoryId) cancelAttack();
        } else if (attackSeaDiceOnly) {
          setAttackSeaDiceRoll(null);
        } else if (attackDiceRoll !== null) {
          setAttackDiceRoll(null);
        }
        return;
      }
      if (attackStartTerritoryId === null) {
        selectAttackStart(vertex.id);
      } else {
        selectAttackEnd(vertex.id);
      }
      return;
    }

    if (turnPhase === 'entrench') {
      if (!vertex || !isInteractable(vertex)) {
        if (selectedTerritoryId !== null && vertex?.id !== selectedTerritoryId)
          selectTerritory(null);
        return;
      }
      if (selectedTerritoryId === vertex.id) {
        submitEntrench();
        return;
      }
      selectTerritory(vertex.id);
      return;
    }

    if (turnPhase === 'toxins') {
      if (!vertex || !isInteractable(vertex)) {
        if (selectedTerritoryId !== null && vertex?.id !== selectedTerritoryId)
          selectTerritory(null);
        return;
      }
      if (selectedTerritoryId === vertex.id) {
        submitToxins();
        return;
      }
      selectTerritory(vertex.id);
      return;
    }

    if (!vertex || !isInteractable(vertex)) {
      if (selectedTerritoryId !== null && vertex?.id !== selectedTerritoryId)
        selectTerritory(null);
      if (deploySeaTerritoryId !== null && vertex?.id !== deploySeaTerritoryId)
        cancelDeploySea();
      return;
    }
    if (turnPhase === 'deploy' && seaIdSet.has(vertex.id)) {
      if (deploySeaTerritoryId === vertex.id) {
        submitDeploySea();
        return;
      }
      if (
        selectedTerritoryId === null ||
        !isSeaAdjacentToTerritory(vertex.id, selectedTerritoryId)
      )
        selectTerritory(null);
      setToasts([]);
      selectDeploySea(vertex.id);
      return;
    }
    if (selectedTerritoryId === vertex.id) {
      if (comboActive) submitDeploySea();
      else submitDeploy();
      return;
    }
    if (turnPhase === 'deploy') setToasts([]);
    if (
      deploySeaTerritoryId !== null &&
      !isSeaAdjacentToTerritory(deploySeaTerritoryId, vertex.id)
    )
      cancelDeploySea();
    selectTerritory(vertex.id);
  }

  function handleMouseUp(e: React.MouseEvent) {
    if (isSyntheticMouseEvent()) return;
    const drag = dragRef.current;
    dragRef.current = null;
    setIsDragging(false);
    if (drag && !drag.moved) {
      const pos = getPos(e);
      if (consumeDoubleTap(pos)) return;
      handleTap(pos);
    }
    startSettle();
  }

  function handleMouseLeave() {
    dragRef.current = null;
    setHoveredId(null);
    setTooltipTerritoryId(null);
    setIsDragging(false);
    startSettle();
  }

  function handleTouchStart(e: React.TouchEvent) {
    lastTouchAtRef.current = Date.now();
    cancelSettle();
    if (e.touches.length === 1) {
      pinchRef.current = null;
      beginDrag(getPos(e.touches[0]));
    } else if (e.touches.length === 2) {
      dragRef.current = null;
      setIsDragging(false);
      pinchRef.current = { lastDistance: touchDistance(e.touches) };
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    lastTouchAtRef.current = Date.now();
    if (pinchRef.current && e.touches.length === 2) {
      const distance = touchDistance(e.touches);
      const factor = distance / pinchRef.current.lastDistance;
      pinchRef.current.lastDistance = distance;
      const { clientX, clientY } = touchMidpoint(e.touches);
      zoomAround(clientX, clientY, factor);
      return;
    }
    if (dragRef.current && e.touches.length === 1) {
      updateDrag(getPos(e.touches[0]));
    }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    lastTouchAtRef.current = Date.now();
    if (pinchRef.current) {
      pinchRef.current = null;
      if (e.touches.length === 1) beginDrag(getPos(e.touches[0]));
      return;
    }
    if (e.touches.length > 0) return;
    const drag = dragRef.current;
    dragRef.current = null;
    setIsDragging(false);
    if (drag && !drag.moved && e.changedTouches.length > 0) {
      const pos = getPos(e.changedTouches[0]);
      if (consumeDoubleTap(pos)) return;
      handleTap(pos);
    }
    startSettle();
  }

  function handleTouchCancel() {
    lastTouchAtRef.current = Date.now();
    dragRef.current = null;
    pinchRef.current = null;
    setIsDragging(false);
    startSettle();
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    if (isSyntheticMouseEvent()) return;
    if (pendingAttackEmoji) {
      setPendingAttackEmoji(null);
      return;
    }
    if (gameEnded || !isMyTurn || paused) return;
    if (nukeTargeting) {
      setNukeTargeting(null);
      return;
    }
    if (turnPhase === 'sail') {
      if (sailStartTerritoryId !== null) cancelSail();
      return;
    }
    if (turnPhase === 'fortify') {
      if (fortifyStartTerritoryId !== null) cancelFortify();
      return;
    }
    if (turnPhase === 'attack') {
      if (attackPendingConquest) return;
      const vertex = hitVertex(getPos(e));
      if (attackSeaTerritoryId !== null) {
        if (!attackSeaRevealing) cancelAttackSea();
      } else if (
        blitzEnabled &&
        !attackRevealing &&
        vertex &&
        attackEndCandidates.has(vertex.id)
      ) {
        quickAttack(vertex.id);
      } else if (attackStartTerritoryId !== null) {
        cancelAttack();
      } else if (attackSeaDiceOnly) {
        setAttackSeaDiceRoll(null);
      } else if (attackDiceRoll !== null) {
        setAttackDiceRoll(null);
      }
      return;
    }
    if (deploySeaTerritoryId !== null) {
      cancelDeploySea();
      return;
    }
    if (selectedTerritoryId !== null) selectTerritory(null);
  }

  useCanvasKeyboard({ ...params, selectTerritory, zoomAround });

  return {
    hoveredId,
    isDragging,
    tooltipTerritoryId,
    isInteractable,
    nodeState,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleContextMenu,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
  };
}
