import { withUnlockedTiles } from 'engine';
import type { CardSymbol, GameState } from '../../../lib/types';
import {
  createAnimationScope,
  inAnimationScope,
  pruneAnimations,
  renderStill,
} from '../../animations';
import { drawEndCard, END_CARD_MS, type EndCard } from '../../endCard/endCard';
import { createCamera } from '../../GameMap/camera';
import {
  drawGameMapCanvas,
  type DrawCanvasParams,
} from '../../GameMap/draw/drawCanvas';
import { CANVAS_FONT_FAMILY } from '../../GameMap/helpers';
import { mapGraphAt, unlockedMap } from '../../GameMap/hooks/view/useMapGraph';
import { computeSupplyLineEdges } from '../../supplyLines';
import { switchesOnAfter } from '../../switches/switches';
import {
  conquestArrowAt,
  groupSeaShips,
  switchFlipsAt,
  unlockedTilesAt,
  type ReplayData,
} from '../replay';
import { startFrameEffects } from './clipEffects';
import type { ClipScene } from './clipScene';

export interface ClipSize {
  w: number;
  h: number;
}

export interface ClipSession {
  timeline: (
    indices: number[],
    durations: number[],
    endCard: EndCard | null,
    animate: boolean,
  ) => void;
  stillAt: (index: number, showRound: boolean) => void;
  begin: (position: number, showRound: boolean) => void;
  play: (position: number, offsetMs: number, showRound: boolean) => void;
}

interface PendingEffect {
  time: number;
  run: () => void;
}

const TIMELINE_START_MS = 1000;
const MAX_EFFECTS_PER_STEP = 40;
const EFFECT_SPREAD_MS = 800;
const OPENED_CACHE_SIZE = 2;

function even(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}

export function clipSize(scene: ClipScene, width: number): ClipSize {
  const w = even(Math.min(width, scene.imgDims.w));
  return { w, h: even((w * scene.imgDims.h) / scene.imgDims.w) };
}

function drawRoundLabel(
  ctx: CanvasRenderingContext2D,
  size: ClipSize,
  round: number,
) {
  const fontSize = Math.round(size.h * 0.05);
  const pad = fontSize * 0.5;
  const margin = size.h * 0.02;
  const text = String(round);
  ctx.font = `bold ${fontSize}px ${CANVAS_FONT_FAMILY}`;
  const width = ctx.measureText(text).width + pad * 2;
  const height = fontSize + pad * 2;
  ctx.fillStyle = 'rgba(20, 20, 20, 0.85)';
  ctx.beginPath();
  ctx.roundRect(margin, margin, width, height, pad);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, margin + pad, margin + height / 2);
}

export function createClipSession(
  scene: ClipScene,
  game: GameState,
  replay: ReplayData,
  canvas: HTMLCanvasElement,
  size: ClipSize,
): ClipSession {
  const camera = createCamera();
  const cardImages: Record<CardSymbol, HTMLImageElement> = {
    soldier: new Image(),
    humvee: new Image(),
    tank: new Image(),
  };
  const capitalIds = new Set(
    game.territories.filter((t) => t.isCapital).map((t) => t.id),
  );
  const vertexRadius = Math.max(scene.imgDims.w, scene.imgDims.h) / 100;
  const bonuses =
    game.continentBonuses.length > 0 ? game.continentBonuses : scene.bonuses;

  const openedCache = new Map<string, ReturnType<typeof unlockedMap>>();
  let drawn: { index: number; params: DrawCanvasParams; round: number } | null =
    null;
  let indices: number[] = [];
  let durations: number[] = [];
  let endCard: EndCard | null = null;
  let animate = true;
  let starts: number[] = [];
  let scope = createAnimationScope();
  let pending: PendingEffect[] = [];
  let entered = 0;

  function openedMap(unlockedTileIds: number[]) {
    const key = unlockedTileIds.join(',');
    let opened = openedCache.get(key);
    if (!opened) {
      opened = unlockedMap(
        scene.territories,
        scene.regions,
        scene.lockedTiles,
        new Set(unlockedTileIds),
      );
      if (openedCache.size >= OPENED_CACHE_SIZE)
        openedCache.delete(openedCache.keys().next().value!);
      openedCache.set(key, opened);
    }
    return opened;
  }

  function stateAt(
    index: number,
    openTerritories: ReturnType<typeof unlockedMap>['openTerritories'],
  ) {
    const frame = index <= 0 ? null : replay.frames[index - 1];
    const round = (frame ?? replay.frames[0])?.roundNumber ?? 0;
    const graph = mapGraphAt({
      openTerritories,
      timedConnections: scene.timedConnections,
      directionalConnections: scene.directionalConnections,
      switching: scene.switching,
      switchesOn: switchesOnAfter(
        scene.switching.switches,
        switchFlipsAt(replay, index),
      ),
      round,
    });
    const ownerById = new Map(
      (frame ? frame.territories : replay.initial).map((t) => [
        t.id,
        { ...t, isCapital: capitalIds.has(t.id) },
      ]),
    );
    const seas = groupSeaShips(frame ? frame.seaShips : []);
    return { frame, round, graph, ownerById, seas };
  }

  function paramsAt(index: number) {
    if (drawn?.index === index) return drawn;
    const opened = openedMap(unlockedTilesAt(replay, index));
    const { frame, round, graph, ownerById, seas } = stateAt(
      index,
      opened.openTerritories,
    );
    const supplyLineEdgesByPlayer =
      game.supplyLines === 'on' && graph.territories.length > 0
        ? computeSupplyLineEdges(
            [...graph.territories, ...scene.seaTerritories],
            seas,
            ownerById,
            game.portalTerritoryIds,
            game.portalsEnabled,
            scene.imgDims.w,
            scene.imgDims.h,
          )
        : new Map();
    const params: DrawCanvasParams = {
      canvasRef: { current: canvas },
      size,
      imgDims: scene.imgDims,
      camera,
      imageRef: { current: scene.image },
      supplyLineEdgesByPlayer,
      territories: opened.openTerritories,
      seaTerritories: scene.seaTerritories,
      seas,
      fortifyPathTerritoryIds: [],
      attackPathTerritoryIds: [],
      sailPathTerritoryIds: [],
      portalTerritoryIds: game.portalTerritoryIds,
      portalsEnabled: game.portalsEnabled,
      attackStartTerritoryId: null,
      attackEndTerritoryId: null,
      replayConquestArrow: conquestArrowAt(replay, index),
      bonusesOpen: false,
      gameMode: game.gameMode,
      continentId: game.continentId,
      hillTerritoryIds: game.hillTerritoryIds,
      players: game.players,
      displayedToxinTerritories: frame ? frame.toxinTerritories : [],
      radiationById: new Set(
        frame ? frame.radiationTerritories : replay.initialRadiation,
      ),
      antiNukeById: new Set(),
      visibleTerritoryIds: game.visibleTerritoryIds,
      frozenVisibleTerritoryIdsRef: { current: null },
      radiationUpcomingById: new Set(frame ? frame.radiationUpcoming : []),
      ownerById,
      frozenTerritoryDataRef: { current: new Map() },
      nodeState: () => 'normal',
      frozenOwnerRef: { current: new Map() },
      VERTEX_RADIUS: vertexRadius,
      isMyTurn: false,
      attackPendingConquest: false,
      attackMoveTroops: 0,
      deployPanelOpen: false,
      selectedTerritoryId: null,
      deployTroops: 0,
      fortifyPanelOpen: false,
      fortifyEndTerritoryId: null,
      fortifyTroops: 0,
      fortifyStartTerritoryId: null,
      frozenTroopsRef: { current: new Map() },
      frozenSeaShipsRef: { current: new Map() },
      cardByTerritoryId: new Map(),
      ownedTerritoryIds: new Set(),
      showReplay: true,
      continentsEnabled: game.continents !== 'off',
      cardsOpen: false,
      selectedCombo: undefined,
      cardImagesRef: { current: cardImages },
      bonuses,
      forcedWraps: scene.forcedWraps,
      regions: opened.regions,
      timedLinks: graph.timedLinks,
      directionalLinks: graph.directionalLinks,
      switches: scene.switching.switches,
      switchOn: graph.switchOn,
      unlockTiles: [],
      placeNames: scene.placeNames,
      pixelRatio: 1,
    };
    drawn = { index, params, round };
    return drawn;
  }

  function drawFrame(
    index: number,
    showRound: boolean,
    time: number | null,
    card: { card: EndCard; elapsed: number } | null,
  ) {
    const { params, round } = paramsAt(index);
    if (time === null) renderStill(() => drawGameMapCanvas(params));
    else
      inAnimationScope(scope, time, () => {
        pruneAnimations();
        drawGameMapCanvas(params);
      });
    const ctx = canvas.getContext('2d')!;
    if (showRound) drawRoundLabel(ctx, size, round);
    if (card)
      drawEndCard(ctx, size.w, size.h, card.card, card.elapsed, scene.logo);
  }

  function cardAt(position: number, elapsed: number) {
    return endCard && position === indices.length - 1
      ? { card: endCard, elapsed }
      : null;
  }

  function addPending(time: number, run: () => void) {
    pending.push({ time, run });
    pending.sort((a, b) => a.time - b.time);
  }

  function effectsFor(frameIndex: number, time: number) {
    const opened = withUnlockedTiles(
      scene.territories,
      scene.lockedTiles,
      new Set(unlockedTilesAt(replay, frameIndex)),
    );
    const { graph, ownerById, seas } = stateAt(frameIndex, opened);
    startFrameEffects(
      replay.frames[frameIndex].animation,
      conquestArrowAt(replay, frameIndex + 1) !== null,
      {
        game,
        territories: graph.territories,
        seaTerritories: scene.seaTerritories,
        seas,
        ownerById,
        lockedTiles: scene.lockedTiles,
      },
      (delay, run) => addPending(time + delay, run),
    );
  }

  function enqueue(position: number) {
    const from = indices[position - 1];
    const count = indices[position] - from;
    const picked = Math.min(count, MAX_EFFECTS_PER_STEP);
    const spread = Math.min(durations[position], EFFECT_SPREAD_MS);
    for (let i = 0; i < picked; i++) {
      const frameIndex = from + Math.floor((i * count) / picked);
      const time = starts[position] + (i / picked) * spread;
      addPending(time, () => effectsFor(frameIndex, time));
    }
  }

  function runPending(time: number) {
    while (pending.length > 0 && pending[0].time <= time) {
      const next = pending.shift()!;
      inAnimationScope(scope, next.time, next.run);
    }
  }

  return {
    timeline(nextIndices, nextDurations, nextEndCard, nextAnimate) {
      indices = nextIndices;
      durations = nextDurations;
      endCard = nextEndCard;
      animate = nextAnimate;
      let start = TIMELINE_START_MS;
      starts = nextDurations.map((duration) => {
        const current = start;
        start += duration;
        return current;
      });
    },
    stillAt(index, showRound) {
      drawFrame(index, showRound, null, null);
    },
    begin(position, showRound) {
      scope = createAnimationScope();
      pending = [];
      entered = position;
      drawFrame(
        indices[position],
        showRound,
        null,
        cardAt(position, END_CARD_MS),
      );
    },
    play(position, offsetMs, showRound) {
      if (!animate) {
        entered = Math.max(entered, position);
        drawFrame(
          indices[position],
          showRound,
          null,
          cardAt(position, offsetMs),
        );
        return;
      }
      for (let next = entered + 1; next <= position; next++) enqueue(next);
      entered = Math.max(entered, position);
      const time = starts[position] + offsetMs;
      runPending(time);
      drawFrame(indices[position], showRound, time, cardAt(position, offsetMs));
    },
  };
}
