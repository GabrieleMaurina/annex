import type { RefObject } from 'react';
import { contrastTextColor, playerColor } from '../../../lib/palette';
import type { Card, CardSymbol, GameMode, GameState } from '../../../lib/types';
import {
  areAnimationsDisabled,
  drawAnimations,
  drawFogCloud,
  drawFortifyPath,
  drawPortal,
  drawRadiationCloud,
  drawToxinCloud,
  ENTRENCHED_OCTAGON_SCALE,
  traceOctagon,
} from '../../animations';
import type { EvaluatedCombo } from '../../logic/cards';
import type { Territory } from '../../mapData';
import { buildWrappedPathSegments } from '../../mapMath';
import { isPortalHop } from '../../portals';
import type { ConquestArrow } from '../../replay';
import type { RailEdge } from '../../supplyLines';
import { drawSupplyLines } from '../../supplyLines';
import {
  ENTRENCHED_OCTAGON_FILL,
  ENTRENCHED_OCTAGON_STROKE,
  getScales,
  getScreenOffset,
  STATE_STYLE,
  strokeContinentOutline,
  UNCLAIMED_TERRITORY_COLOR,
  type Point,
  type Transform,
} from '../helpers';

export interface DrawCanvasParams {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  size: { w: number; h: number };
  imgDims: { w: number; h: number };
  transform: Transform;
  imageRef: RefObject<HTMLImageElement | null>;
  supplyLineEdgesByPlayer: Map<number, RailEdge[]>;
  territories: Territory[];
  fortifyPathTerritoryIds: number[][];
  portalTerritoryIds: number[];
  portalsEnabled: boolean;
  attackStartTerritoryId: number | null;
  attackEndTerritoryId: number | null;
  replayConquestArrow: ConquestArrow | null;
  bonusesOpen: boolean;
  gameMode: GameMode;
  continentId: number | null;
  players: GameState['players'];
  displayedToxinTerritories: GameState['toxinTerritories'];
  radiationById: Set<number>;
  radiationPlacedAtRef: RefObject<Map<number, number>>;
  visibleTerritoryIds: GameState['visibleTerritoryIds'];
  frozenVisibleTerritoryIdsRef: RefObject<Set<number> | null>;
  radiationUpcomingById: Set<number>;
  ownerById: Map<number, GameState['territories'][number]>;
  frozenTerritoryDataRef: RefObject<
    Map<number, GameState['territories'][number]>
  >;
  nodeState: (id: number) => 'normal' | 'selectable' | 'hovered' | 'selected';
  frozenOwnerRef: RefObject<Map<number, number>>;
  VERTEX_RADIUS: number;
  toxinPlacedAtRef: RefObject<Map<number, number>>;
  isMyTurn: boolean;
  attackPendingConquest: boolean;
  attackMoveTroops: number;
  deployPanelOpen: boolean;
  selectedTerritoryId: number | null;
  deployTroops: number;
  fortifyPanelOpen: boolean;
  fortifyEndTerritoryId: number | null;
  fortifyTroops: number;
  fortifyStartTerritoryId: number | null;
  frozenTroopsRef: RefObject<Map<number, number>>;
  cardByTerritoryId: Map<number, Card>;
  ownedTerritoryIds: Set<number>;
  cardsOpen: boolean;
  selectedCombo: EvaluatedCombo | undefined;
  cardImagesRef: RefObject<Record<CardSymbol, HTMLImageElement>>;
  bonuses: number[];
}

export function drawGameMapCanvas(params: DrawCanvasParams) {
  const {
    canvasRef,
    size,
    imgDims,
    transform,
    imageRef,
    supplyLineEdgesByPlayer,
    territories,
    fortifyPathTerritoryIds,
    portalTerritoryIds,
    portalsEnabled,
    attackStartTerritoryId,
    attackEndTerritoryId,
    replayConquestArrow,
    bonusesOpen,
    gameMode,
    continentId,
    players,
    displayedToxinTerritories,
    radiationById,
    radiationPlacedAtRef,
    visibleTerritoryIds,
    frozenVisibleTerritoryIdsRef,
    radiationUpcomingById,
    ownerById,
    frozenTerritoryDataRef,
    nodeState,
    frozenOwnerRef,
    VERTEX_RADIUS,
    toxinPlacedAtRef,
    isMyTurn,
    attackPendingConquest,
    attackMoveTroops,
    deployPanelOpen,
    selectedTerritoryId,
    deployTroops,
    fortifyPanelOpen,
    fortifyEndTerritoryId,
    fortifyTroops,
    fortifyStartTerritoryId,
    frozenTroopsRef,
    cardByTerritoryId,
    ownedTerritoryIds,
    cardsOpen,
    selectedCombo,
    cardImagesRef,
    bonuses,
  } = params;

  const canvas = canvasRef.current;
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(size.w * dpr);
  canvas.height = Math.round(size.h * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.fillStyle = '#212529';
  ctx.fillRect(0, 0, size.w, size.h);

  const { zoom } = transform;
  const { imgW, imgH, scaleX, scaleY } = getScales(
    size.w,
    size.h,
    zoom,
    imgDims,
  );
  const { x: offsetX, y: offsetY } = getScreenOffset(
    size.w,
    size.h,
    zoom,
    transform.offsetX,
    transform.offsetY,
    imgDims,
  );

  if (imageRef.current) {
    ctx.drawImage(
      imageRef.current,
      offsetX,
      offsetY,
      imgW * scaleX,
      imgH * scaleY,
    );
  }

  const toScreen = (p: Point): Point => ({
    x: p.x * scaleX + offsetX,
    y: p.y * scaleY + offsetY,
  });

  const territoryById = new Map(territories.map((t) => [t.id, t]));

  if (supplyLineEdgesByPlayer.size > 0) {
    drawSupplyLines(
      ctx,
      supplyLineEdgesByPlayer,
      territoryById,
      toScreen,
      imgW,
      imgH,
      zoom,
    );
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(offsetX, offsetY, imgW * scaleX, imgH * scaleY);
  ctx.clip();
  drawAnimations(ctx, toScreen, VERTEX_RADIUS * scaleX, imgW, imgH);

  const visibleSet = visibleTerritoryIds
    ? new Set([
        ...visibleTerritoryIds,
        ...(frozenVisibleTerritoryIdsRef.current ?? []),
      ])
    : null;
  const fadeForPair = (
    fromId: number,
    toId: number,
  ): 'start' | 'end' | undefined => {
    if (!visibleSet) return undefined;
    const fromVisible = visibleSet.has(fromId);
    const toVisible = visibleSet.has(toId);
    if (fromVisible && toVisible) return undefined;
    return fromVisible ? 'end' : 'start';
  };
  const drawArrowSegment = (
    a: Territory,
    b: Territory,
    fade?: 'start' | 'end',
  ) => {
    drawFortifyPath(
      ctx,
      buildWrappedPathSegments([a, b], toScreen, imgW, imgH),
      fade,
    );
  };

  if (fortifyPathTerritoryIds.length > 0) {
    for (const run of fortifyPathTerritoryIds) {
      if (run.length < 2) continue;
      const worldPath = run
        .map((id) => territoryById.get(id))
        .filter((t): t is Territory => !!t);
      if (worldPath.length !== run.length) continue;
      for (let i = 0; i < worldPath.length - 1; i++) {
        if (
          isPortalHop(
            worldPath[i].id,
            worldPath[i + 1].id,
            portalTerritoryIds,
            portalsEnabled,
          )
        )
          continue;
        drawArrowSegment(
          worldPath[i],
          worldPath[i + 1],
          fadeForPair(worldPath[i].id, worldPath[i + 1].id),
        );
      }
    }
  }

  if (
    attackStartTerritoryId !== null &&
    attackEndTerritoryId !== null &&
    !isPortalHop(
      attackStartTerritoryId,
      attackEndTerritoryId,
      portalTerritoryIds,
      portalsEnabled,
    )
  ) {
    const start = territoryById.get(attackStartTerritoryId);
    const end = territoryById.get(attackEndTerritoryId);
    if (start && end)
      drawArrowSegment(
        start,
        end,
        fadeForPair(attackStartTerritoryId, attackEndTerritoryId),
      );
  }

  if (
    replayConquestArrow &&
    !isPortalHop(
      replayConquestArrow.fromTerritoryId,
      replayConquestArrow.toTerritoryId,
      portalTerritoryIds,
      portalsEnabled,
    )
  ) {
    const start = territoryById.get(replayConquestArrow.fromTerritoryId);
    const end = territoryById.get(replayConquestArrow.toTerritoryId);
    if (start && end) drawArrowSegment(start, end);
  }

  ctx.restore();

  const continentGroups = bonusesOpen
    ? (() => {
        const groups = new Map<number, Territory[]>();
        for (const t of territories) {
          const list = groups.get(t.continentId);
          if (list) list.push(t);
          else groups.set(t.continentId, [t]);
        }
        return groups;
      })()
    : null;

  if (continentGroups) {
    const hullPad = (VERTEX_RADIUS + 30) * scaleX;
    ctx.save();
    ctx.fillStyle = 'rgba(110, 110, 110, 0.4)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2.5 * zoom;
    ctx.lineJoin = 'round';
    ctx.setLineDash([6 * zoom, 5 * zoom]);
    for (const group of continentGroups.values()) {
      strokeContinentOutline(ctx, group, toScreen, hullPad);
    }
    ctx.restore();
  }

  if (gameMode === 'Continent' && continentId !== null) {
    const targetTerritories = territories.filter(
      (t) => t.continentId === continentId,
    );
    if (targetTerritories.length > 0) {
      const hullPad = (VERTEX_RADIUS + 30) * scaleX;
      ctx.save();
      ctx.fillStyle = 'rgba(110, 110, 110, 0.4)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 3.5 * zoom;
      ctx.lineJoin = 'round';
      strokeContinentOutline(ctx, targetTerritories, toScreen, hullPad);
      ctx.restore();
    }
  }

  const colorByPlayerId = new Map(players.map((pl) => [pl.id, pl.color]));
  const portalTerritoryIdSet = new Set(portalTerritoryIds);
  const toxinByTerritoryId = new Map(
    displayedToxinTerritories.map((t) => [t.id, t]),
  );
  const now = areAnimationsDisabled() ? 0 : performance.now();

  for (const t of territories) {
    const isVisible = visibleSet === null || visibleSet.has(t.id);
    const p = toScreen(t);

    if (portalTerritoryIdSet.has(t.id)) {
      drawPortal(
        ctx,
        p.x,
        p.y,
        VERTEX_RADIUS * scaleX,
        now,
        portalsEnabled,
        t.id,
      );
    }

    const isRadiated = radiationById.has(t.id);
    if (isRadiated) {
      drawRadiationCloud(
        ctx,
        p.x,
        p.y,
        VERTEX_RADIUS * scaleX,
        now,
        false,
        t.id,
        areAnimationsDisabled()
          ? -Infinity
          : (radiationPlacedAtRef.current.get(t.id) ?? -Infinity),
      );
    }

    let owner: GameState['territories'][number] | undefined;

    if (!isVisible) {
      if (!isRadiated && radiationUpcomingById.has(t.id)) {
        drawRadiationCloud(
          ctx,
          p.x,
          p.y,
          VERTEX_RADIUS * scaleX,
          now,
          true,
          t.id,
          -Infinity,
        );
      }
      drawFogCloud(ctx, p.x, p.y, VERTEX_RADIUS * scaleX, now, t.id);
    } else {
      const style = STATE_STYLE[nodeState(t.id)];
      owner = ownerById.get(t.id) ?? frozenTerritoryDataRef.current.get(t.id);
      const displayOwnerId = frozenOwnerRef.current.get(t.id) ?? owner?.ownerId;
      const fillColor =
        displayOwnerId !== undefined
          ? playerColor(colorByPlayerId.get(displayOwnerId) ?? 0)
          : UNCLAIMED_TERRITORY_COLOR;

      if (owner && owner.entrenchedTurns > 0) {
        traceOctagon(
          ctx,
          p.x,
          p.y,
          VERTEX_RADIUS * ENTRENCHED_OCTAGON_SCALE * scaleX,
        );
        ctx.fillStyle = ENTRENCHED_OCTAGON_FILL;
        ctx.fill();
        ctx.strokeStyle = ENTRENCHED_OCTAGON_STROKE;
        ctx.lineWidth = 2 * zoom;
        ctx.stroke();
      }

      const toxin = toxinByTerritoryId.get(t.id);
      if (toxin) {
        drawToxinCloud(
          ctx,
          p.x,
          p.y,
          VERTEX_RADIUS * scaleX,
          now,
          toxin.permanent,
          toxin.roundsRemaining,
          t.id,
          areAnimationsDisabled()
            ? -Infinity
            : (toxinPlacedAtRef.current.get(t.id) ?? -Infinity),
        );
      }

      if (!toxin && !isRadiated) {
        ctx.beginPath();
        if (owner?.isCapital) {
          const half = VERTEX_RADIUS * scaleX;
          ctx.rect(p.x - half, p.y - half, half * 2, half * 2);
        } else {
          ctx.arc(p.x, p.y, VERTEX_RADIUS * scaleX, 0, Math.PI * 2);
        }
        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = style.width * zoom;
        ctx.stroke();

        if (radiationUpcomingById.has(t.id)) {
          drawRadiationCloud(
            ctx,
            p.x,
            p.y,
            VERTEX_RADIUS * scaleX,
            now,
            true,
            t.id,
            -Infinity,
          );
        }
      }

      if (owner) {
        const troops =
          isMyTurn && attackPendingConquest && t.id === attackEndTerritoryId
            ? attackMoveTroops
            : isMyTurn &&
                attackPendingConquest &&
                t.id === attackStartTerritoryId
              ? owner.troops - attackMoveTroops
              : deployPanelOpen && t.id === selectedTerritoryId
                ? owner.troops + deployTroops
                : fortifyPanelOpen && t.id === fortifyEndTerritoryId
                  ? owner.troops + fortifyTroops
                  : fortifyPanelOpen && t.id === fortifyStartTerritoryId
                    ? owner.troops - fortifyTroops
                    : (frozenTroopsRef.current.get(t.id) ?? owner.troops);
        ctx.fillStyle = contrastTextColor(fillColor);
        ctx.font = `bold ${VERTEX_RADIUS * scaleX}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        const text = String(troops);
        const metrics = ctx.measureText(text);
        const baselineY =
          p.y +
          (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) /
            2;
        ctx.fillText(text, p.x, baselineY);
      }
    }

    const territoryCard = cardByTerritoryId.get(t.id);
    if (territoryCard) {
      const cardOwned = ownedTerritoryIds.has(t.id);

      const inSelectedCombo =
        cardsOpen &&
        (selectedCombo?.cards.some((c) => c.territoryId === t.id) ?? false);
      if (inSelectedCombo) {
        ctx.beginPath();
        if (owner?.isCapital) {
          const half = (VERTEX_RADIUS + 6) * scaleX;
          ctx.rect(p.x - half, p.y - half, half * 2, half * 2);
        } else {
          ctx.arc(p.x, p.y, (VERTEX_RADIUS + 6) * scaleX, 0, Math.PI * 2);
        }
        ctx.strokeStyle = '#0d6efd';
        ctx.lineWidth = 3 * zoom;
        ctx.stroke();
      }

      if (territoryCard.symbol && territoryCard.territoryId !== null) {
        const img = cardImagesRef.current[territoryCard.symbol];
        if (img.complete && img.naturalWidth > 0) {
          const iconSize = 16 * zoom;
          const textHeight = 11 * zoom;
          const badgePad = 4 * zoom;
          const badgeGap = 1 * zoom;
          const badgeW = iconSize + badgePad * 2;
          const badgeH = iconSize + badgeGap + textHeight + badgePad * 2;
          const dist = (VERTEX_RADIUS + 6) * scaleX + badgeH / 2 + 4;
          const cx = p.x + dist * Math.SQRT1_2;
          const cy = p.y - dist * Math.SQRT1_2;

          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1 * zoom;
          ctx.beginPath();
          ctx.roundRect(
            cx - badgeW / 2,
            cy - badgeH / 2,
            badgeW,
            badgeH,
            4 * zoom,
          );
          ctx.fill();
          ctx.stroke();
          ctx.drawImage(
            img,
            cx - iconSize / 2,
            cy - badgeH / 2 + badgePad,
            iconSize,
            iconSize,
          );

          ctx.fillStyle = '#000000';
          ctx.font = `bold ${textHeight}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'alphabetic';
          ctx.fillText(
            `#${territoryCard.territoryId + 1}`,
            cx,
            cy + badgeH / 2 - badgePad * 0.6,
          );

          if (cardOwned) {
            const pillText = '+2';
            ctx.font = `bold ${10 * zoom}px sans-serif`;
            const pillWidth = ctx.measureText(pillText).width + 6 * zoom;
            const pillHeight = 12 * zoom;
            const pillX = cx + badgeW / 2;
            const pillY = cy - badgeH / 2;
            ctx.fillStyle = '#2ecc71';
            ctx.beginPath();
            ctx.roundRect(
              pillX - pillWidth / 2,
              pillY - pillHeight / 2,
              pillWidth,
              pillHeight,
              pillHeight / 2,
            );
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.fillText(pillText, pillX, pillY + 3.5 * zoom);
          }
        }
      }
    }

    if (bonusesOpen) {
      const idText = `#${t.id + 1}`;
      ctx.font = `bold ${11 * zoom}px sans-serif`;
      const padX = 4 * zoom;
      const boxW = ctx.measureText(idText).width + padX * 2;
      const boxH = 15 * zoom;
      const boxX = p.x - boxW / 2;
      const boxY = p.y + VERTEX_RADIUS * scaleX + 4 * zoom;

      ctx.fillStyle = 'rgba(20, 20, 20, 0.85)';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1 * zoom;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 4 * zoom);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(idText, p.x, boxY + boxH / 2 + 1 * zoom);
    }
  }

  if (continentGroups) {
    for (const [continentGroupId, group] of continentGroups) {
      const screenPoints = group.map((t) => toScreen(t));
      const cx =
        screenPoints.reduce((s, p) => s + p.x, 0) / screenPoints.length;
      const cy =
        screenPoints.reduce((s, p) => s + p.y, 0) / screenPoints.length;
      const text = `#${continentGroupId + 1}:+${bonuses[continentGroupId] ?? 0}`;

      ctx.font = `bold ${34 * zoom}px sans-serif`;
      const metrics = ctx.measureText(text);
      const paddingX = 10 * zoom;
      const boxW = metrics.width + paddingX * 2;
      const boxH = 42 * zoom;
      const boxX = cx - boxW / 2;
      const boxY = cy - boxH / 2;

      ctx.fillStyle = 'rgba(20, 20, 20, 0.85)';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 * zoom;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 10 * zoom);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, cx, cy + 1 * zoom);
    }
  }
}
