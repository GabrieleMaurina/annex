import type { Dispatch, RefObject, SetStateAction } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { connector } from '../../../connector';
import type {
  Ack,
  EmojiAttackTarget,
  EmojiValue,
  GameState,
} from '../../../lib/types';
import type { EvaluatedCombo } from '../../logic/cards';
import { ATTACK_EMOJI } from '../../logic/emoji';
import type { Territory } from '../../mapData';
import type { AttackType, DiceRoll } from '../../panels/AttackPanel';
import {
  DRAG_THRESHOLD,
  getScales,
  getScreenOffset,
  HIT_RADIUS_MULTIPLIER,
  HIT_TOLERANCE,
  isTypingTarget,
  type DragState,
  type Point,
  type Transform,
} from '../helpers';
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

export function useCanvasInteractions({
  canvasRef,
  territories,
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
  fortifyMaxTroops,
  fortifyInputRef,
  attackPendingConquest,
  attackStartTerritoryId,
  attackEndTerritoryId,
  attackStartCandidates,
  attackEndCandidates,
  attackMoveMinTroops,
  attackMoveMaxTroops,
  attackDiceRoll,
  setAttackDiceRoll,
  attackRevealing,
  attackDiceOnly,
  maxBlitzTroops,
  setAttackSelectedType,
  setAttackBlitzTroops,
  attackMoveInputRef,
  blitzInputRef,
  entrenchCandidates,
  entrenchMaxTroops,
  entrenchInputRef,
  toxinsCandidates,
  pendingAttackEmoji,
  setPendingAttackEmoji,
  sendEmoji,
  emojiPickerFor,
  setEmojiPickerFor,
  alliancePopupFor,
  setAlliancePopupFor,
  setToasts,
  setGame,
  setChatOpen,
  setPanelCollapsed,
  openPanel,
  setOpenPanel,
  cardsOpen,
  selectedCombo,
  playCardSet,
  deployPanelOpen,
  deployInputRef,
  setDeployTroops,
  submitDeploy,
  fortifyPanelOpen,
  setFortifyTroops,
  cancelFortify,
  selectFortifyStart,
  selectFortifyEnd,
  submitFortify,
  entrenchPanelOpen,
  setEntrenchTroops,
  submitEntrench,
  toxinsPanelOpen,
  submitToxins,
  attackPanelOpen,
  attackShowPendingConquest,
  setAttackMoveTroops,
  cycleAttackOption,
  selectAttackStart,
  selectAttackEnd,
  submitAttackMove,
  cancelAttack,
  submitAttack,
  canAdvancePhase,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  territories: Territory[];
  transform: Transform;
  setTransform: Dispatch<SetStateAction<Transform>>;
  imgDims: { w: number; h: number };
  VERTEX_RADIUS: number;
  gameEnded: boolean;
  isMyTurn: boolean;
  paused: boolean;
  turnPhase: GameState['turnPhase'];
  selfId: number | null;
  selectedTerritoryId: number | null;
  territoryClaimCandidates: Set<number>;
  troopsToDeploy: number;
  supplyConnectedTerritoryIds: Set<number> | null;
  ownerById: Map<number, GameState['territories'][number]>;
  fortifyStartTerritoryId: number | null;
  fortifyEndTerritoryId: number | null;
  fortifyStartCandidates: Set<number>;
  fortifyEndCandidates: Set<number>;
  fortifyMaxTroops: number;
  fortifyInputRef: RefObject<HTMLInputElement | null>;
  attackPendingConquest: boolean;
  attackStartTerritoryId: number | null;
  attackEndTerritoryId: number | null;
  attackStartCandidates: Set<number>;
  attackEndCandidates: Set<number>;
  attackMoveMinTroops: number;
  attackMoveMaxTroops: number;
  attackDiceRoll: DiceRoll | null;
  setAttackDiceRoll: Dispatch<SetStateAction<DiceRoll | null>>;
  attackRevealing: boolean;
  attackDiceOnly: boolean;
  maxBlitzTroops: number;
  setAttackSelectedType: Dispatch<SetStateAction<AttackType>>;
  setAttackBlitzTroops: Dispatch<SetStateAction<number>>;
  attackMoveInputRef: RefObject<HTMLInputElement | null>;
  blitzInputRef: RefObject<HTMLInputElement | null>;
  entrenchCandidates: Set<number>;
  entrenchMaxTroops: number;
  entrenchInputRef: RefObject<HTMLInputElement | null>;
  toxinsCandidates: Set<number>;
  pendingAttackEmoji: { targetPlayerId: number } | null;
  setPendingAttackEmoji: Dispatch<
    SetStateAction<{ targetPlayerId: number } | null>
  >;
  sendEmoji: (
    targetPlayerId: number,
    emoji: EmojiValue,
    attackTarget?: EmojiAttackTarget,
  ) => void;
  emojiPickerFor: number | null;
  setEmojiPickerFor: Dispatch<SetStateAction<number | null>>;
  alliancePopupFor: number | null;
  setAlliancePopupFor: Dispatch<SetStateAction<number | null>>;
  setToasts: Dispatch<SetStateAction<{ id: number; message: string }[]>>;
  setGame: (game: GameState) => void;
  setChatOpen: Dispatch<SetStateAction<boolean>>;
  setPanelCollapsed: Dispatch<SetStateAction<boolean>>;
  openPanel: 'cards' | 'bonuses' | 'logs' | 'settings' | null;
  setOpenPanel: (
    panel: 'cards' | 'bonuses' | 'logs' | 'settings' | null,
  ) => void;
  cardsOpen: boolean;
  selectedCombo: EvaluatedCombo | undefined;
  playCardSet: (combo: EvaluatedCombo) => void;
  deployPanelOpen: boolean;
  deployInputRef: RefObject<HTMLInputElement | null>;
  setDeployTroops: Dispatch<SetStateAction<number>>;
  submitDeploy: () => void;
  fortifyPanelOpen: boolean;
  setFortifyTroops: Dispatch<SetStateAction<number>>;
  cancelFortify: () => void;
  selectFortifyStart: (territoryId: number | null) => void;
  selectFortifyEnd: (territoryId: number) => void;
  submitFortify: () => void;
  entrenchPanelOpen: boolean;
  setEntrenchTroops: Dispatch<SetStateAction<number>>;
  submitEntrench: () => void;
  toxinsPanelOpen: boolean;
  submitToxins: () => void;
  attackPanelOpen: boolean;
  attackShowPendingConquest: boolean;
  setAttackMoveTroops: Dispatch<SetStateAction<number>>;
  cycleAttackOption: (direction: 1 | -1) => void;
  selectAttackStart: (territoryId: number | null) => void;
  selectAttackEnd: (territoryId: number) => void;
  submitAttackMove: () => void;
  cancelAttack: () => void;
  submitAttack: () => void;
  canAdvancePhase: boolean;
}) {
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

  function isInteractable(t: Territory): boolean {
    if (pendingAttackEmoji) return true;
    if (gameEnded || !isMyTurn || paused) return false;
    if (turnPhase === 'territory') return territoryClaimCandidates.has(t.id);
    if (turnPhase === 'capital') return ownerById.get(t.id)?.ownerId === selfId;
    if (turnPhase === 'deploy' || turnPhase === 'troop')
      return (
        troopsToDeploy > 0 &&
        ownerById.get(t.id)?.ownerId === selfId &&
        (supplyConnectedTerritoryIds === null ||
          supplyConnectedTerritoryIds.has(t.id))
      );
    if (turnPhase === 'fortify') {
      if (fortifyStartTerritoryId === null)
        return fortifyStartCandidates.has(t.id);
      if (fortifyEndTerritoryId === null) return fortifyEndCandidates.has(t.id);
      return false;
    }
    if (turnPhase === 'attack') {
      if (attackPendingConquest) return false;
      if (attackStartTerritoryId === null)
        return attackStartCandidates.has(t.id);
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
    if (turnPhase === 'territory') {
      if (id === hoveredId) return 'hovered';
      return territoryClaimCandidates.has(id) ? 'selectable' : 'normal';
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
    if (id === selectedTerritoryId) return 'selected';
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

  function hitVertex(pos: Point): Territory | null {
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
    let nearest: Territory | null = null;
    let nearestDist = Infinity;
    for (const t of territories) {
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

    if (turnPhase === 'territory') {
      if (vertex && isInteractable(vertex)) claimTerritory(vertex.id);
      return;
    }

    if (turnPhase === 'capital') {
      if (vertex && isInteractable(vertex)) selectCapital(vertex.id);
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
        if (fortifyStartTerritoryId !== null) cancelFortify();
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
          cancelAttack();
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
        if (selectedTerritoryId !== null) selectTerritory(null);
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
        if (selectedTerritoryId !== null) selectTerritory(null);
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
      if (selectedTerritoryId !== null) selectTerritory(null);
      return;
    }
    if (selectedTerritoryId === vertex.id) {
      submitDeploy();
      return;
    }
    if (turnPhase === 'deploy') setToasts([]);
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
    if (turnPhase === 'fortify') {
      if (fortifyStartTerritoryId !== null) cancelFortify();
      return;
    }
    if (turnPhase === 'attack') {
      if (attackPendingConquest) return;
      if (attackStartTerritoryId !== null) {
        cancelAttack();
      } else if (attackDiceRoll !== null) {
        setAttackDiceRoll(null);
      }
      return;
    }
    if (selectedTerritoryId !== null) selectTerritory(null);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (pendingAttackEmoji) {
          setPendingAttackEmoji(null);
          return;
        }
        if (emojiPickerFor !== null) {
          setEmojiPickerFor(null);
          return;
        }
        if (alliancePopupFor !== null) {
          setAlliancePopupFor(null);
          return;
        }
        if (openPanel !== null) {
          setOpenPanel(null);
          return;
        }
        if (
          isMyTurn &&
          turnPhase === 'fortify' &&
          fortifyStartTerritoryId !== null
        ) {
          cancelFortify();
          return;
        }
        if (
          isMyTurn &&
          turnPhase === 'attack' &&
          attackStartTerritoryId !== null &&
          !attackPendingConquest
        ) {
          cancelAttack();
          return;
        }
        if (isMyTurn && turnPhase === 'attack' && attackDiceOnly) {
          setAttackDiceRoll(null);
          return;
        }
        if (isMyTurn && selectedTerritoryId !== null) {
          selectTerritory(null);
          return;
        }
        setPanelCollapsed(true);
        setChatOpen(false);
        return;
      }
      const isConfirmKey = e.key === 'Enter' || e.key === ' ';
      if (
        isConfirmKey &&
        cardsOpen &&
        isMyTurn &&
        turnPhase === 'deploy' &&
        selectedCombo
      ) {
        if (!isTypingTarget(e.target)) {
          e.preventDefault();
          playCardSet(selectedCombo);
          return;
        }
      }
      if (isConfirmKey && deployPanelOpen) {
        if (!isTypingTarget(e.target) || e.target === deployInputRef.current) {
          e.preventDefault();
          submitDeploy();
          return;
        }
      }
      if (isConfirmKey && fortifyPanelOpen) {
        if (!isTypingTarget(e.target) || e.target === fortifyInputRef.current) {
          e.preventDefault();
          submitFortify();
          return;
        }
      }
      if (isConfirmKey && entrenchPanelOpen) {
        if (
          !isTypingTarget(e.target) ||
          e.target === entrenchInputRef.current
        ) {
          e.preventDefault();
          submitEntrench();
          return;
        }
      }
      if (isConfirmKey && toxinsPanelOpen) {
        if (!isTypingTarget(e.target)) {
          e.preventDefault();
          submitToxins();
          return;
        }
      }
      if (isConfirmKey && attackPanelOpen && attackShowPendingConquest) {
        if (
          !isTypingTarget(e.target) ||
          e.target === attackMoveInputRef.current
        ) {
          e.preventDefault();
          submitAttackMove();
          return;
        }
      }
      if (
        isConfirmKey &&
        attackPanelOpen &&
        !attackShowPendingConquest &&
        !attackDiceOnly &&
        !attackRevealing
      ) {
        if (!isTypingTarget(e.target) || e.target === blitzInputRef.current) {
          e.preventDefault();
          submitAttack();
          return;
        }
      }
      if (
        attackPanelOpen &&
        !attackShowPendingConquest &&
        !attackDiceOnly &&
        (e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
        e.target === blitzInputRef.current
      ) {
        e.preventDefault();
        const delta = e.key === 'ArrowUp' ? 1 : -1;
        setAttackDiceRoll(null);
        setAttackSelectedType('blitz');
        setAttackBlitzTroops((prev) =>
          Math.min(maxBlitzTroops, Math.max(1, prev + delta)),
        );
        return;
      }
      if (
        attackPanelOpen &&
        !attackShowPendingConquest &&
        !attackDiceOnly &&
        !isTypingTarget(e.target) &&
        (e.key === 'ArrowUp' ||
          e.key === 'ArrowDown' ||
          e.key === 'ArrowLeft' ||
          e.key === 'ArrowRight')
      ) {
        e.preventDefault();
        const direction =
          e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
        cycleAttackOption(direction);
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (e.key === 'Tab') {
        e.preventDefault();
        if (canAdvancePhase) {
          connector.nextPhase((res: Ack) => {
            if (res.ok) setGame(res.game);
          });
        } else {
          setPanelCollapsed((prev) => !prev);
        }
      } else if (e.key.toLowerCase() === 't') {
        setChatOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    pendingAttackEmoji,
    setPendingAttackEmoji,
    emojiPickerFor,
    alliancePopupFor,
    openPanel,
    isMyTurn,
    turnPhase,
    selectedTerritoryId,
    selectTerritory,
    setChatOpen,
    deployPanelOpen,
    submitDeploy,
    fortifyStartTerritoryId,
    cancelFortify,
    fortifyPanelOpen,
    submitFortify,
    entrenchPanelOpen,
    submitEntrench,
    toxinsPanelOpen,
    submitToxins,
    attackStartTerritoryId,
    attackPendingConquest,
    attackShowPendingConquest,
    attackDiceOnly,
    attackRevealing,
    cancelAttack,
    attackPanelOpen,
    submitAttack,
    submitAttackMove,
    maxBlitzTroops,
    cycleAttackOption,
    cardsOpen,
    selectedCombo,
    playCardSet,
    canAdvancePhase,
    setGame,
    setEmojiPickerFor,
    setAlliancePopupFor,
    setOpenPanel,
    setPanelCollapsed,
    setAttackDiceRoll,
    setAttackSelectedType,
    setAttackBlitzTroops,
    deployInputRef,
    fortifyInputRef,
    entrenchInputRef,
    attackMoveInputRef,
    blitzInputRef,
  ]);

  useEffect(() => {
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      if (deployPanelOpen) {
        const delta = e.deltaY < 0 ? 1 : -1;
        setDeployTroops((prev) =>
          Math.min(troopsToDeploy, Math.max(1, prev + delta)),
        );
        return;
      }
      if (fortifyPanelOpen) {
        const delta = e.deltaY < 0 ? 1 : -1;
        setFortifyTroops((prev) =>
          Math.min(fortifyMaxTroops, Math.max(1, prev + delta)),
        );
        return;
      }
      if (entrenchPanelOpen) {
        const delta = e.deltaY < 0 ? 1 : -1;
        setEntrenchTroops((prev) =>
          Math.min(entrenchMaxTroops, Math.max(1, prev + delta)),
        );
        return;
      }
      if (attackPanelOpen && attackShowPendingConquest) {
        const delta = e.deltaY < 0 ? 1 : -1;
        setAttackMoveTroops((prev) =>
          Math.min(
            attackMoveMaxTroops,
            Math.max(attackMoveMinTroops, prev + delta),
          ),
        );
        return;
      }
      if (attackPanelOpen && !attackShowPendingConquest && !attackDiceOnly) {
        cycleAttackOption(e.deltaY < 0 ? -1 : 1);
        return;
      }
      if (attackPanelOpen) return;
      zoomAround(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 0.9);
    }
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [
    deployPanelOpen,
    troopsToDeploy,
    fortifyPanelOpen,
    fortifyMaxTroops,
    entrenchPanelOpen,
    entrenchMaxTroops,
    attackPanelOpen,
    attackShowPendingConquest,
    attackDiceOnly,
    cycleAttackOption,
    attackMoveMinTroops,
    attackMoveMaxTroops,
    zoomAround,
    setDeployTroops,
    setFortifyTroops,
    setEntrenchTroops,
    setAttackMoveTroops,
  ]);

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
