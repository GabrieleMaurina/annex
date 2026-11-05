import { contrastTextColor, playerColor } from '../../../lib/palette';
import type { CardSymbol, GameState } from '../../../lib/types';
import {
  areAnimationsDisabled,
  drawFogCloud,
  drawPortal,
  drawRadiationCloud,
  drawScaled,
  drawToxinCloud,
  ENTRENCHED_OCTAGON_SCALE,
  fillWithRipple,
  markerRipple,
  traceOctagon,
  trackPresence,
  type Capture,
  type Look,
  type Shown,
} from '../../animations';
import type { PlaceNames, Territory } from '../../mapData';
import type { RailEdge } from '../../supplyLines';
import {
  CANVAS_FONT_FAMILY,
  ENTRENCHED_OCTAGON_FILL,
  ENTRENCHED_OCTAGON_STROKE,
  HILL_BASE,
  HILL_FILL,
  HILL_HALF_WIDTH,
  HILL_HEIGHT,
  HILL_STROKE,
  STATE_STYLE,
  type Point,
} from '../helpers';
import type { DrawCanvasParams } from './drawCanvas';

const ANTI_NUKE_COLOR = '#22d3ee';

interface MarkerData {
  color: string;
  stroke: string;
  width: number;
}

interface ToxinData {
  permanent: boolean;
  roundsRemaining: number;
}

interface ShipData {
  seaId: number;
  index: number;
  count: number;
  color: string;
  ships: number;
}

interface CardData {
  symbol: CardSymbol;
  territoryId: number;
}

interface ModifierData {
  portal: null;
  radiation: null;
  fog: null;
  entrench: null;
  toxin: ToxinData;
  marker: MarkerData;
  antiNuke: null;
  hill: null;
  card: CardData;
  cardPill: null;
  ship: ShipData;
  supply: RailEdge;
}

type ModifierLooks = {
  [K in keyof ModifierData]: Map<string, Look<ModifierData[K]>>;
};

export type ShownModifiers = {
  [K in keyof ModifierData]: Map<string, Shown<ModifierData[K]>>;
};

interface ModifierScene {
  visibleSet: Set<number> | null;
  cracking: Set<number>;
  ownerOf: (id: number) => GameState['territories'][number] | undefined;
  fillColorOf: (id: number) => string;
  ready: boolean;
}

export interface ModifierFrame {
  ctx: CanvasRenderingContext2D;
  shown: ShownModifiers;
  toScreen: (p: Point) => Point;
  scaleX: number;
  radius: number;
  uiScale: number;
  now: number;
  captures: Map<number, Capture>;
}

function look(state: string): Look<null> {
  return { state, data: null };
}

function newLooks(): ModifierLooks {
  return {
    portal: new Map(),
    radiation: new Map(),
    fog: new Map(),
    entrench: new Map(),
    toxin: new Map(),
    marker: new Map(),
    antiNuke: new Map(),
    hill: new Map(),
    card: new Map(),
    cardPill: new Map(),
    ship: new Map(),
    supply: new Map(),
  };
}

function collectTerritoryLooks(
  looks: ModifierLooks,
  params: DrawCanvasParams,
  scene: ModifierScene,
) {
  const {
    territories,
    regions,
    nodeState,
    displayedToxinTerritories,
    radiationById,
    radiationUpcomingById,
    antiNukeById,
    portalTerritoryIds,
    portalsEnabled,
    cardByTerritoryId,
    ownedTerritoryIds,
  } = params;
  const { visibleSet, cracking, ownerOf, fillColorOf } = scene;
  const toxinById = new Map(displayedToxinTerritories.map((t) => [t.id, t]));
  for (const t of territories) {
    if (cracking.has(t.id)) continue;
    const key = String(t.id);
    const visible = visibleSet === null || visibleSet.has(t.id);
    const owner = ownerOf(t.id);
    const toxin = toxinById.get(t.id);
    const radiated = radiationById.has(t.id);
    if (portalTerritoryIds.includes(t.id))
      looks.portal.set(key, look(portalsEnabled ? 'open' : 'closed'));
    if (radiated) looks.radiation.set(key, look('active'));
    else if (radiationUpcomingById.has(t.id) && !(visible && toxin))
      looks.radiation.set(key, look('upcoming'));
    const card = cardByTerritoryId.get(t.id);
    if (card?.symbol && card.territoryId !== null) {
      looks.card.set(key, {
        state: 'card',
        data: { symbol: card.symbol, territoryId: card.territoryId },
      });
      if (ownedTerritoryIds.has(t.id)) looks.cardPill.set(key, look('pill'));
    }
    if (!visible) {
      looks.fog.set(key, look('fog'));
      continue;
    }
    if (owner && owner.entrenchedTurns > 0) looks.entrench.set(key, look('on'));
    if (toxin)
      looks.toxin.set(key, {
        state: 'toxin',
        data: {
          permanent: toxin.permanent,
          roundsRemaining: toxin.roundsRemaining,
        },
      });
    const shape = regions?.shapes.has(t.id);
    if (!toxin && !radiated && (!shape || owner?.isCapital)) {
      const style = shape ? STATE_STYLE.normal : STATE_STYLE[nodeState(t.id)];
      looks.marker.set(key, {
        state: owner?.isCapital ? 'square' : 'circle',
        data: {
          color: fillColorOf(t.id),
          stroke: style.stroke,
          width: style.width,
        },
      });
    }
    if (antiNukeById.has(t.id)) looks.antiNuke.set(key, look('on'));
  }
}

function collectMapLooks(
  looks: ModifierLooks,
  params: DrawCanvasParams,
  visibleSet: Set<number> | null,
) {
  const {
    seaTerritories,
    seas,
    players,
    hillTerritoryIds,
    supplyLineEdgesByPlayer,
    frozenSeaShipsRef,
  } = params;
  const colorByPlayerId = new Map(players.map((pl) => [pl.id, pl.color]));
  for (const id of hillTerritoryIds) looks.hill.set(String(id), look('hill'));
  const seaShipsById = new Map(seas.map((s) => [s.id, s.ships]));
  for (const s of seaTerritories) {
    if (visibleSet && !visibleSet.has(s.id)) {
      looks.fog.set(String(s.id), look('fog'));
      continue;
    }
    const ships = (
      frozenSeaShipsRef.current.get(s.id) ??
      seaShipsById.get(s.id) ??
      []
    ).filter((b) => b.ships > 0);
    ships.forEach((b, index) =>
      looks.ship.set(`${s.id}:${b.playerId}`, {
        state: 'ship',
        data: {
          seaId: s.id,
          index,
          count: ships.length,
          color: playerColor(colorByPlayerId.get(b.playerId) ?? 0),
          ships: b.ships,
        },
      }),
    );
  }
  for (const [playerId, edges] of supplyLineEdgesByPlayer)
    for (const edge of edges) {
      const low = Math.min(edge.fromId, edge.toId);
      const high = Math.max(edge.fromId, edge.toId);
      looks.supply.set(`${playerId}:${low}:${high}`, {
        state: 'rail',
        data: edge,
      });
    }
}

export function trackModifiers(
  canvas: HTMLCanvasElement,
  params: DrawCanvasParams,
  scene: ModifierScene,
): ShownModifiers {
  const looks = newLooks();
  if (scene.ready) {
    collectTerritoryLooks(looks, params, scene);
    collectMapLooks(looks, params, scene.visibleSet);
  }
  const animate = !areAnimationsDisabled();
  const track = <T>(kind: string, kindLooks: Map<string, Look<T>>) =>
    trackPresence(canvas, kind, kindLooks, animate);
  return {
    portal: track('portal', looks.portal),
    radiation: track('radiation', looks.radiation),
    fog: track('fog', looks.fog),
    entrench: track('entrench', looks.entrench),
    toxin: track('toxin', looks.toxin),
    marker: track('marker', looks.marker),
    antiNuke: track('antiNuke', looks.antiNuke),
    hill: track('hill', looks.hill),
    card: track('card', looks.card),
    cardPill: track('cardPill', looks.cardPill),
    ship: track('ship', looks.ship),
    supply: track('supply', looks.supply),
  };
}

export function drawHills(
  frame: ModifierFrame,
  territoryById: Map<number, Territory>,
) {
  const { ctx, radius: r, uiScale } = frame;
  for (const [key, hill] of frame.shown.hill) {
    const t = territoryById.get(Number(key));
    if (!t) continue;
    const p = frame.toScreen(t);
    drawScaled(ctx, p, hill.scale, () => {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - r * HILL_HEIGHT);
      ctx.lineTo(p.x + r * HILL_HALF_WIDTH, p.y + r * HILL_BASE);
      ctx.lineTo(p.x - r * HILL_HALF_WIDTH, p.y + r * HILL_BASE);
      ctx.closePath();
      ctx.fillStyle = HILL_FILL;
      ctx.fill();
      ctx.strokeStyle = HILL_STROKE;
      ctx.lineWidth = 2 * uiScale;
      ctx.lineJoin = 'round';
      ctx.stroke();
    });
  }
}

export function drawFog(
  frame: ModifierFrame,
  id: number,
  p: Point,
  radius: number,
) {
  const fog = frame.shown.fog.get(String(id));
  if (!fog) return;
  drawScaled(frame.ctx, p, fog.scale, () =>
    drawFogCloud(frame.ctx, p.x, p.y, radius, frame.now, id),
  );
}

export function drawShips(
  frame: ModifierFrame,
  seaId: number,
  p: Point,
  hexRadius: number,
) {
  const { ctx, radius, uiScale } = frame;
  const circleRadius = radius * 0.7;
  const triangleRadius = radius * 1.3;
  const dist = hexRadius + triangleRadius + 4 * uiScale;
  for (const { data, scale } of frame.shown.ship.values()) {
    if (data.seaId !== seaId) continue;
    const angle = (Math.PI * 2 * data.index) / data.count - Math.PI / 2;
    const center = {
      x: p.x + dist * Math.cos(angle),
      y: p.y + dist * Math.sin(angle),
    };
    drawScaled(ctx, center, scale, () => {
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(angle + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(triangleRadius, 0);
      ctx.lineTo(-triangleRadius * 0.6, triangleRadius * 0.7);
      ctx.lineTo(-triangleRadius * 0.6, -triangleRadius * 0.7);
      ctx.closePath();
      ctx.fillStyle = data.color;
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2 * uiScale;
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = contrastTextColor(data.color);
      ctx.font = `bold ${circleRadius}px ${CANVAS_FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      const text = String(data.ships);
      const metrics = ctx.measureText(text);
      ctx.fillText(
        text,
        center.x,
        center.y +
          (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) /
            2,
      );
    });
  }
}

export function drawUnderModifiers(frame: ModifierFrame, id: number, p: Point) {
  const { ctx, radius, now } = frame;
  const key = String(id);
  const portal = frame.shown.portal.get(key);
  if (portal)
    drawScaled(ctx, p, portal.scale, () =>
      drawPortal(ctx, p.x, p.y, radius, now, portal.state === 'open', id),
    );
  const radiation = frame.shown.radiation.get(key);
  if (radiation?.state === 'active')
    drawScaled(ctx, p, radiation.scale, () =>
      drawRadiationCloud(ctx, p.x, p.y, radius, now, false, id),
    );
}

export function drawOverModifiers(frame: ModifierFrame, id: number, p: Point) {
  const { ctx, radius, uiScale, now, shown } = frame;
  const key = String(id);
  const entrench = shown.entrench.get(key);
  if (entrench)
    drawScaled(ctx, p, entrench.scale, () => {
      traceOctagon(ctx, p.x, p.y, radius * ENTRENCHED_OCTAGON_SCALE);
      ctx.fillStyle = ENTRENCHED_OCTAGON_FILL;
      ctx.fill();
      ctx.strokeStyle = ENTRENCHED_OCTAGON_STROKE;
      ctx.lineWidth = 2 * uiScale;
      ctx.stroke();
    });

  const toxin = shown.toxin.get(key);
  if (toxin)
    drawScaled(ctx, p, toxin.scale, () =>
      drawToxinCloud(
        ctx,
        p.x,
        p.y,
        radius,
        now,
        toxin.data.permanent,
        toxin.data.roundsRemaining,
        id,
      ),
    );

  const marker = shown.marker.get(key);
  if (marker)
    drawScaled(ctx, p, marker.scale, () => {
      const path = new Path2D();
      if (marker.state === 'square')
        path.rect(p.x - radius, p.y - radius, radius * 2, radius * 2);
      else path.arc(p.x, p.y, radius, 0, Math.PI * 2);
      const ripple = markerRipple(frame.captures.get(id), p, radius);
      fillWithRipple(ctx, path, marker.data.color, ripple);
      ctx.strokeStyle = marker.data.stroke;
      ctx.lineWidth = marker.data.width * uiScale;
      ctx.stroke(path);
    });

  const radiation = shown.radiation.get(key);
  if (radiation?.state === 'upcoming')
    drawScaled(ctx, p, radiation.scale, () =>
      drawRadiationCloud(ctx, p.x, p.y, radius, now, true, id),
    );

  const antiNuke = shown.antiNuke.get(key);
  if (antiNuke)
    drawScaled(ctx, p, antiNuke.scale, () => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius + 3 * frame.scaleX, 0, Math.PI * 2);
      ctx.strokeStyle = ANTI_NUKE_COLOR;
      ctx.lineWidth = 2 * uiScale;
      ctx.setLineDash([4 * uiScale, 3 * uiScale]);
      ctx.stroke();
      ctx.setLineDash([]);
    });
}

export function drawCardBadge(
  frame: ModifierFrame,
  id: number,
  p: Point,
  cardImages: Record<CardSymbol, HTMLImageElement>,
  placeNames: PlaceNames,
) {
  const { ctx, uiScale } = frame;
  const badge = frame.shown.card.get(String(id));
  if (!badge) return;
  const img = cardImages[badge.data.symbol];
  if (!img.complete || img.naturalWidth === 0) return;
  const iconSize = 16 * uiScale;
  const textHeight = 11 * uiScale;
  const badgePad = 4 * uiScale;
  const badgeGap = 1 * uiScale;
  const cardText =
    placeNames.territories.get(badge.data.territoryId) ??
    `#${badge.data.territoryId + 1}`;
  ctx.font = `bold ${textHeight}px ${CANVAS_FONT_FAMILY}`;
  const textW = Math.max(iconSize, ctx.measureText(cardText).width);
  const badgeW = textW + badgePad * 2;
  const badgeH = iconSize + badgeGap + textHeight + badgePad * 2;
  const dist = frame.radius + 6 * frame.scaleX + badgeH / 2 + 4 * uiScale;
  const cx = p.x + dist * Math.SQRT1_2 + (textW - iconSize) / 2;
  const cy = p.y - dist * Math.SQRT1_2;

  drawScaled(ctx, { x: cx, y: cy }, badge.scale, () => {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1 * uiScale;
    ctx.beginPath();
    ctx.roundRect(
      cx - badgeW / 2,
      cy - badgeH / 2,
      badgeW,
      badgeH,
      4 * uiScale,
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
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(cardText, cx, cy + badgeH / 2 - badgePad * 0.6);

    const pill = frame.shown.cardPill.get(String(id));
    if (!pill) return;
    const pillText = '+2';
    ctx.font = `bold ${10 * uiScale}px ${CANVAS_FONT_FAMILY}`;
    const pillWidth = ctx.measureText(pillText).width + 6 * uiScale;
    const pillHeight = 12 * uiScale;
    const pillX = cx + badgeW / 2;
    const pillY = cy - badgeH / 2;
    drawScaled(ctx, { x: pillX, y: pillY }, pill.scale, () => {
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
      ctx.fillText(pillText, pillX, pillY + 3.5 * uiScale);
    });
  });
}
