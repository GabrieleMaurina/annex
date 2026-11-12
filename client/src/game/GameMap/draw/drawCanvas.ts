import type { RefObject } from 'react';
import { contrastTextColor, lighten, playerColor } from '../../../lib/palette';
import type {
  Card,
  CardSymbol,
  GameMode,
  GameState,
  LockedTile,
  MapSwitch,
} from '../../../lib/types';
import {
  areAnimationsDisabled,
  crackingTileIds,
  drawAnimations,
  drawFortifyPath,
  regionRipple,
  trackCaptures,
  type Capture,
  type Ripple,
} from '../../animations';
import { animationNow } from '../../animations/clock';
import {
  drawEndCard,
  END_CARD_SETTLED_MS,
  END_CARD_SHOWN_MS,
  type EndCardOverlay,
} from '../../endCard/endCard';
import type { EvaluatedCombo } from '../../logic/cards';
import { formatTroops } from '../../logic/formatTroops';
import { drawMapBorder, imageBorder } from '../../mapBorder';
import type { PlaceNames, SeaTerritory, Territory } from '../../mapData';
import {
  borderScale,
  buildWrappedPathSegments,
  type ForcedWraps,
} from '../../mapMath';
import { isPortalHop } from '../../portals';
import {
  continentShapes,
  type ClickableRegions,
} from '../../regions/clickableRegions';
import { drawSmoothImage } from '../../regions/smoothImage';
import type { RegionShape } from '../../regions/traceRegions';
import type { ConquestArrow } from '../../replay/replay';
import type { RailEdge } from '../../supplyLines';
import { drawSupplyLines } from '../../supplyLines';
import type { Camera } from '../camera';
import {
  CANVAS_FONT_FAMILY,
  getScales,
  getScreenOffset,
  hexagonPath,
  SEA_COLOR,
  SEA_SIZE_MULTIPLIER,
  STATE_STYLE,
  strokeContinentOutline,
  UNCLAIMED_TERRITORY_COLOR,
  type Point,
} from '../helpers';
import type { DirectionalLink } from '../hooks/view/useDirectionalConnections';
import type { TimedLink } from '../hooks/view/useTimedConnections';
import {
  drawCardBadge,
  drawFog,
  drawHills,
  drawOverModifiers,
  drawShips,
  drawUnderModifiers,
  trackModifiers,
  type ModifierFrame,
} from './drawModifiers';
import { drawTerritoryNames } from './drawNames';
import {
  outlineContinentRegion,
  regionFillLayer,
  strokeRegion,
  strokeSharedBorders,
  unlockedTileLayer,
} from './drawRegions';
import { drawSwitches, type SwitchedLinkSpot } from './drawSwitches';
import { drawDirectionalLinks, drawTimedLinks } from './drawTimedLinks';

export interface DrawCanvasParams {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  size: { w: number; h: number };
  imgDims: { w: number; h: number };
  camera: Camera;
  imageRef: RefObject<HTMLImageElement | null>;
  supplyLineEdgesByPlayer: Map<number, RailEdge[]>;
  territories: Territory[];
  seaTerritories: SeaTerritory[];
  seas: GameState['seas'];
  fortifyPathTerritoryIds: number[][];
  attackPathTerritoryIds: number[][];
  sailPathTerritoryIds: number[][];
  portalTerritoryIds: number[];
  portalsEnabled: boolean;
  attackStartTerritoryId: number | null;
  attackEndTerritoryId: number | null;
  replayConquestArrow: ConquestArrow | null;
  bonusesOpen: boolean;
  gameMode: GameMode;
  continentId: number | null;
  hillTerritoryIds: number[];
  players: GameState['players'];
  displayedToxinTerritories: GameState['toxinTerritories'];
  radiationById: Set<number>;
  antiNukeById: Set<number>;
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
  frozenSeaShipsRef: RefObject<Map<number, GameState['seas'][number]['ships']>>;
  cardByTerritoryId: Map<number, Card>;
  ownedTerritoryIds: Set<number>;
  showReplay: boolean;
  continentsEnabled: boolean;
  cardsOpen: boolean;
  selectedCombo: EvaluatedCombo | undefined;
  cardImagesRef: RefObject<Record<CardSymbol, HTMLImageElement>>;
  bonuses: number[];
  forcedWraps: ForcedWraps;
  regions: ClickableRegions | null;
  timedLinks: TimedLink[];
  directionalLinks: DirectionalLink[];
  switches: MapSwitch[];
  switchOn: boolean[];
  unlockTiles: LockedTile[];
  placeNames: PlaceNames;
  heatMap?: Map<number, string> | null;
  endCard?: EndCardOverlay | null;
  pixelRatio?: number;
}

export function drawGameMapCanvas(params: DrawCanvasParams) {
  const {
    canvasRef,
    size,
    imgDims,
    camera,
    imageRef,
    territories,
    seaTerritories,
    fortifyPathTerritoryIds,
    attackPathTerritoryIds,
    sailPathTerritoryIds,
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
    visibleTerritoryIds,
    frozenVisibleTerritoryIdsRef,
    ownerById,
    frozenTerritoryDataRef,
    nodeState,
    frozenOwnerRef,
    VERTEX_RADIUS,
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
    showReplay,
    continentsEnabled,
    cardsOpen,
    selectedCombo,
    cardImagesRef,
    bonuses,
    forcedWraps,
    regions,
    timedLinks,
    directionalLinks,
    switches,
    switchOn,
    unlockTiles,
    placeNames,
    heatMap,
    endCard,
    pixelRatio,
  } = params;

  const canvas = canvasRef.current;
  if (!canvas) return;
  const dpr = pixelRatio ?? (window.devicePixelRatio || 1);
  canvas.width = Math.round(size.w * dpr);
  canvas.height = Math.round(size.h * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.fillStyle = '#10151c';
  ctx.fillRect(0, 0, size.w, size.h);

  const transform = camera.get();
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
  const uiScale = zoom * borderScale((VERTEX_RADIUS * scaleX) / zoom);

  drawMapBorder(
    ctx,
    imageRef.current && imageBorder(imageRef.current),
    offsetX,
    offsetY,
    imgW * scaleX,
    imgH * scaleY,
    10 * uiScale,
  );

  const cracking = crackingTileIds();
  const tileLayer = regions && unlockedTileLayer(regions, cracking);

  const toScreen = (p: Point): Point => ({
    x: p.x * scaleX + offsetX,
    y: p.y * scaleY + offsetY,
  });

  const territoryById = new Map(territories.map((t) => [t.id, t]));
  const pathPointById: Map<number, Point> = new Map(
    [...territories, ...seaTerritories].map((t) => [t.id, t]),
  );

  const visibleSet = visibleTerritoryIds
    ? new Set([
        ...visibleTerritoryIds,
        ...[...(frozenVisibleTerritoryIdsRef.current ?? [])].filter(
          (id) =>
            !territoryById.has(id) ||
            ownerById.has(id) ||
            frozenTerritoryDataRef.current.has(id),
        ),
      ])
    : null;
  const colorByPlayerId = new Map(players.map((pl) => [pl.id, pl.color]));
  const ownerOf = (id: number) =>
    ownerById.get(id) ?? frozenTerritoryDataRef.current.get(id);
  const displayOwnerOf = (id: number) =>
    frozenOwnerRef.current.get(id) ?? ownerOf(id)?.ownerId;
  const ownerColor = (ownerId: number | undefined) =>
    ownerId !== undefined
      ? playerColor(colorByPlayerId.get(ownerId) ?? 0)
      : UNCLAIMED_TERRITORY_COLOR;
  const fillColorOf = (id: number) => ownerColor(displayOwnerOf(id));
  const view = { scaleX, scaleY, offsetX, offsetY };
  const trackedCaptures = trackCaptures(canvas, {
    territories,
    visibleSet,
    ownerOf: displayOwnerOf,
    colorOf: ownerColor,
    pointById: pathPointById,
    vertexRadius: VERTEX_RADIUS,
    ready: imageRef.current !== null,
    animate: !areAnimationsDisabled(),
  });
  const captures = heatMap ? new Map<number, Capture>() : trackedCaptures;
  const now = areAnimationsDisabled() ? 0 : animationNow();
  const frame: ModifierFrame = {
    ctx,
    shown: trackModifiers(canvas, params, {
      visibleSet,
      cracking,
      ownerOf,
      fillColorOf,
      ready: imageRef.current !== null,
    }),
    toScreen,
    scaleX,
    radius: VERTEX_RADIUS * scaleX,
    uiScale,
    now,
    captures,
  };

  const fillColors = new Map<number, string>();
  const tintedFillColors = new Map<number, string>();
  const ripples = new Map<number, Ripple>();
  if (regions) {
    for (const t of territories) {
      if (!regions.shapes.has(t.id)) continue;
      if (cracking.has(t.id)) continue;
      const color =
        heatMap?.get(t.id) ??
        (visibleSet && !visibleSet.has(t.id)
          ? UNCLAIMED_TERRITORY_COLOR
          : fillColorOf(t.id));
      const tint = STATE_STYLE[nodeState(t.id)].tint;
      fillColors.set(t.id, color);
      tintedFillColors.set(t.id, lighten(color, tint));
      const capture = captures.get(t.id);
      if (capture) ripples.set(t.id, regionRipple(regions, t, capture, tint));
    }
  }

  const image = imageRef.current;
  const minified = scaleX * dpr < 1;
  const smoothed =
    image !== null &&
    !minified &&
    drawSmoothImage(
      ctx,
      {
        image,
        revision: 0,
        tiles: tileLayer,
        fill: regions && {
          labels: regions.fillLabels,
          colors: tintedFillColors,
          ripples,
        },
      },
      offsetX,
      offsetY,
      scaleX,
    );
  if (!smoothed) {
    const drawLayer = (layer: CanvasImageSource) => {
      ctx.imageSmoothingEnabled = minified;
      ctx.drawImage(layer, offsetX, offsetY, imgW * scaleX, imgH * scaleY);
      ctx.imageSmoothingEnabled = true;
    };
    if (image) drawLayer(image);
    if (tileLayer) drawLayer(tileLayer);
    if (regions) drawLayer(regionFillLayer(regions, tintedFillColors, ripples));
  }

  if (frame.shown.supply.size > 0) {
    drawSupplyLines(
      ctx,
      frame.shown.supply.values(),
      pathPointById,
      new Set(seaTerritories.map((t) => t.id)),
      toScreen,
      imgW,
      imgH,
      uiScale,
      forcedWraps,
    );
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(offsetX, offsetY, imgW * scaleX, imgH * scaleY);
  ctx.clip();
  const linkLayout = {
    pointById: pathPointById,
    toScreen,
    imgW,
    imgH,
    forcedWraps,
    vertexRadius: VERTEX_RADIUS,
    mapScale: scaleX,
    backdrop: { image: imageRef.current, regions, fillColors },
  };
  const spots: SwitchedLinkSpot[] = [];
  drawTimedLinks(ctx, timedLinks, linkLayout, spots);
  drawDirectionalLinks(ctx, directionalLinks, linkLayout, spots);
  drawSwitches(ctx, {
    switches,
    switchOn,
    spots,
    nodeState,
    toScreen,
    screenRadius: VERTEX_RADIUS * scaleX,
    uiScale,
    image: imageRef.current,
  });
  drawAnimations(
    ctx,
    toScreen,
    VERTEX_RADIUS * scaleX,
    imgW,
    imgH,
    forcedWraps,
  );

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
  const drawArrowSegment = (a: Point, b: Point, fade?: 'start' | 'end') => {
    drawFortifyPath(
      ctx,
      buildWrappedPathSegments([a, b], toScreen, imgW, imgH, forcedWraps),
      VERTEX_RADIUS * scaleX,
      fade,
    );
  };

  const drawPathRuns = (runs: number[][]) => {
    for (const run of runs) {
      if (run.length < 2) continue;
      const worldPath = run
        .map((id) => pathPointById.get(id))
        .filter((p): p is Point => !!p);
      if (worldPath.length !== run.length) continue;
      for (let i = 0; i < worldPath.length - 1; i++) {
        if (isPortalHop(run[i], run[i + 1], portalTerritoryIds, portalsEnabled))
          continue;
        drawArrowSegment(
          worldPath[i],
          worldPath[i + 1],
          fadeForPair(run[i], run[i + 1]),
        );
      }
    }
  };

  drawPathRuns(fortifyPathTerritoryIds);
  drawPathRuns(attackPathTerritoryIds);
  drawPathRuns(sailPathTerritoryIds);

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

  const continentGroups = new Map<number, Territory[]>();
  for (const t of territories) {
    if (t.continentId < 0) continue;
    const list = continentGroups.get(t.continentId);
    if (list) list.push(t);
    else continentGroups.set(t.continentId, [t]);
  }

  const toxinByTerritoryId = new Map(
    displayedToxinTerritories.map((t) => [t.id, t]),
  );
  const continentBonusOwnerOf = (group: Territory[]) => {
    const owners = group
      .filter((t) => !radiationById.has(t.id) && !toxinByTerritoryId.has(t.id))
      .map((t) => frozenOwnerRef.current.get(t.id) ?? ownerOf(t.id)?.ownerId);
    const [ownerId, ...otherOwnerIds] = new Set(
      owners.filter((id) => id !== undefined),
    );
    const owned = owners.filter((id) => id === ownerId).length;
    return otherOwnerIds.length === 0 && owned * 2 > owners.length
      ? ownerId
      : undefined;
  };

  const continentHullPad = (VERTEX_RADIUS + 30) * scaleX;
  const continentShapesById = regions
    ? continentShapes(regions, territories)
    : null;
  const continentLineWidth = (width: number) =>
    Math.max(
      width * uiScale,
      regions ? (regions.borderWidth + 1) * 1.1 * scaleX : 0,
    );
  if (bonusesOpen) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = continentLineWidth(5);
    ctx.lineJoin = 'round';
    for (const [continentGroupId, group] of continentGroups) {
      const shape = continentShapesById?.get(continentGroupId);
      if (shape) outlineContinentRegion(ctx, shape, view, true);
      else strokeContinentOutline(ctx, group, toScreen, continentHullPad, true);
    }
    ctx.restore();
  } else if (continentsEnabled) {
    ctx.save();
    ctx.lineWidth = continentLineWidth(3);
    ctx.lineJoin = 'round';
    const ownedShapes: { shape: RegionShape; color: string }[] = [];
    for (const [continentGroupId, group] of continentGroups) {
      if (visibleSet && group.some((t) => !visibleSet.has(t.id))) continue;
      const ownerId = continentBonusOwnerOf(group);
      if (ownerId === undefined) continue;
      const color = lighten(
        playerColor(colorByPlayerId.get(ownerId) ?? 0),
        STATE_STYLE.hovered.tint,
      );
      ctx.strokeStyle = color;
      const shape = continentShapesById?.get(continentGroupId);
      if (shape) {
        outlineContinentRegion(ctx, shape, view, false);
        ownedShapes.push({ shape, color });
      } else
        strokeContinentOutline(ctx, group, toScreen, continentHullPad, false);
    }
    for (const { shape, color } of ownedShapes)
      strokeSharedBorders(
        ctx,
        shape,
        ownedShapes
          .filter((other) => other.color !== color)
          .map((other) => other.shape),
        color,
        view,
      );
    ctx.restore();
  }

  if (gameMode === 'continent' && continentId !== null) {
    const targetTerritories = territories.filter(
      (t) => t.continentId === continentId,
    );
    if (targetTerritories.length > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = continentLineWidth(3.5);
      ctx.lineJoin = 'round';
      const shape = continentShapesById?.get(continentId);
      if (shape) outlineContinentRegion(ctx, shape, view, false);
      else
        strokeContinentOutline(
          ctx,
          targetTerritories,
          toScreen,
          continentHullPad,
          false,
        );
      ctx.restore();
    }
  }

  drawHills(frame, territoryById);

  for (const s of seaTerritories) {
    const isVisible = visibleSet === null || visibleSet.has(s.id);
    const p = toScreen(s);
    const hexRadius = VERTEX_RADIUS * scaleX * SEA_SIZE_MULTIPLIER;
    const seaShape = regions?.shapes.get(s.id);
    const seaStyle = STATE_STYLE[nodeState(s.id)];
    if (isVisible && seaShape && seaStyle !== STATE_STYLE.normal)
      strokeRegion(
        ctx,
        seaShape,
        seaStyle.stroke,
        seaStyle.width * uiScale,
        view,
      );
    if (isVisible && !seaShape) {
      ctx.beginPath();
      hexagonPath(ctx, p.x, p.y, hexRadius);
      ctx.fillStyle = SEA_COLOR;
      ctx.fill();
      ctx.strokeStyle = seaStyle.stroke;
      ctx.lineWidth = seaStyle.width * uiScale;
      ctx.stroke();
    }
    drawShips(frame, s.id, p, hexRadius);
    drawFog(frame, s.id, p, hexRadius);
  }

  for (const t of territories) {
    if (cracking.has(t.id)) continue;
    const isVisible = visibleSet === null || visibleSet.has(t.id);
    const p = toScreen(t);
    const shape = regions?.shapes.get(t.id);
    const style = STATE_STYLE[nodeState(t.id)];
    const owner = isVisible ? ownerOf(t.id) : undefined;

    drawUnderModifiers(frame, t.id, p);
    if (isVisible && shape && style !== STATE_STYLE.normal)
      strokeRegion(ctx, shape, style.stroke, style.width * uiScale, view);
    drawOverModifiers(frame, t.id, p);

    if (owner && !heatMap) {
      const fillColor = fillColorOf(t.id);
      const troops =
        isMyTurn && attackPendingConquest && t.id === attackEndTerritoryId
          ? (frozenTroopsRef.current.has(t.id) ? 0 : owner.troops) +
            attackMoveTroops
          : isMyTurn && attackPendingConquest && t.id === attackStartTerritoryId
            ? owner.troops - attackMoveTroops
            : deployPanelOpen && t.id === selectedTerritoryId
              ? owner.troops + deployTroops
              : fortifyPanelOpen && t.id === fortifyEndTerritoryId
                ? owner.troops + fortifyTroops
                : fortifyPanelOpen && t.id === fortifyStartTerritoryId
                  ? owner.troops - fortifyTroops
                  : (frozenTroopsRef.current.get(t.id) ?? owner.troops);
      const fullyClickable = shape && !owner.isCapital;
      const fontSize = VERTEX_RADIUS * scaleX * (fullyClickable ? 1.25 : 1);
      ctx.font = `bold ${fontSize}px ${CANVAS_FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      const text = formatTroops(troops);
      const metrics = ctx.measureText(text);
      const baselineY =
        p.y +
        (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) /
          2;
      const textColor = contrastTextColor(fillColor);
      if (style !== STATE_STYLE.normal) {
        ctx.lineJoin = 'round';
        ctx.strokeStyle = textColor === '#ffffff' ? '#000000' : '#ffffff';
        ctx.lineWidth = fontSize * 0.15;
        ctx.strokeText(text, p.x, baselineY);
      }
      ctx.fillStyle = textColor;
      ctx.fillText(text, p.x, baselineY);
    }

    drawFog(frame, t.id, p, VERTEX_RADIUS * scaleX);
    if (!isVisible && style !== STATE_STYLE.normal) {
      if (shape) {
        strokeRegion(ctx, shape, style.stroke, style.width * uiScale, view);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, VERTEX_RADIUS * scaleX, 0, Math.PI * 2);
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = style.width * uiScale;
        ctx.stroke();
      }
    }

    const inSelectedCombo =
      cardsOpen &&
      cardByTerritoryId.has(t.id) &&
      (selectedCombo?.cards.some((c) => c.territoryId === t.id) ?? false);
    if (inSelectedCombo) {
      ctx.beginPath();
      if (owner?.isCapital) {
        const half = (VERTEX_RADIUS + 6) * scaleX;
        ctx.rect(p.x - half, p.y - half, half * 2, half * 2);
      } else {
        ctx.arc(p.x, p.y, (VERTEX_RADIUS + 6) * scaleX, 0, Math.PI * 2);
      }
      ctx.strokeStyle = '#e3a33b';
      ctx.lineWidth = 3 * uiScale;
      ctx.stroke();
    }
    drawCardBadge(frame, t.id, p, cardImagesRef.current, placeNames);

    if (bonusesOpen && !placeNames.territories.has(t.id)) {
      const idText = `#${t.id + 1}`;
      ctx.font = `bold ${11 * uiScale}px ${CANVAS_FONT_FAMILY}`;
      const padX = 4 * uiScale;
      const boxW = ctx.measureText(idText).width + padX * 2;
      const boxH = 15 * uiScale;
      const boxX = p.x - boxW / 2;
      const boxY = p.y + VERTEX_RADIUS * scaleX + 4 * uiScale;

      ctx.fillStyle = 'rgba(20, 20, 20, 0.85)';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1 * uiScale;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 4 * uiScale);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(idText, p.x, boxY + boxH / 2 + 1 * uiScale);
    }
  }

  for (const tile of unlockTiles) {
    const p = toScreen(tile);
    const state = nodeState(tile.id);
    const highlighted = state === 'hovered' || state === 'selected';
    ctx.beginPath();
    ctx.arc(
      p.x,
      p.y,
      VERTEX_RADIUS * scaleX * (highlighted ? 0.35 : 0.2),
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = highlighted ? '#ffffff' : '#bbbbbb';
    ctx.fill();
  }

  drawTerritoryNames(
    ctx,
    territories,
    seaTerritories,
    placeNames,
    toScreen,
    scaleX,
    VERTEX_RADIUS * scaleX,
  );

  if (bonusesOpen) {
    const showStats = !showReplay && ownedTerritoryIds.size > 0;
    for (const [continentGroupId, group] of continentGroups) {
      const screenPoints = group.map((t) => toScreen(t));
      const cx =
        screenPoints.reduce((s, p) => s + p.x, 0) / screenPoints.length;
      const cy =
        screenPoints.reduce((s, p) => s + p.y, 0) / screenPoints.length;
      const label =
        placeNames.continents.get(continentGroupId) ??
        `#${continentGroupId + 1}`;
      const text = `${label}:+${bonuses[continentGroupId] ?? 0}`;
      const owned = group.filter((t) => ownedTerritoryIds.has(t.id)).length;
      const statsText = `${owned}/${group.length} (${Math.round((owned / group.length) * 100)}%)`;
      const mainFont = `bold ${34 * uiScale}px ${CANVAS_FONT_FAMILY}`;
      const statsFont = `bold ${13 * uiScale}px ${CANVAS_FONT_FAMILY}`;

      ctx.font = mainFont;
      const mainWidth = ctx.measureText(text).width;
      ctx.font = statsFont;
      const statsWidth = ctx.measureText(statsText).width;
      const paddingX = 10 * uiScale;
      const mainH = 42 * uiScale;
      const statsH = showStats ? 16 * uiScale : 0;
      const boxW =
        (showStats ? Math.max(mainWidth, statsWidth) : mainWidth) +
        paddingX * 2;
      const boxH = mainH + statsH;
      const boxX = cx - boxW / 2;
      const boxY = cy - boxH / 2;

      ctx.fillStyle = 'rgba(20, 20, 20, 0.85)';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 * uiScale;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 10 * uiScale);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = mainFont;
      ctx.fillText(text, cx, boxY + mainH / 2 + 1 * uiScale);
      if (showStats) {
        ctx.font = statsFont;
        ctx.fillText(statsText, cx, boxY + mainH + statsH / 2 - 4 * uiScale);
      }
    }
  }

  if (endCard) {
    const sinceStart = animationNow() - endCard.startedAt;
    if (sinceStart < END_CARD_SHOWN_MS)
      drawEndCard(
        ctx,
        size.w,
        size.h,
        endCard.card,
        areAnimationsDisabled() ? END_CARD_SETTLED_MS : sinceStart,
        endCard.logo,
      );
  }
}
