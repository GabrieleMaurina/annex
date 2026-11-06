import { alliedIds } from '../../game/alliances';
import { defenceDiceFor } from '../../game/combat/dice';
import { calculateDeployTroopsBreakdown } from '../../game/mechanics';
import { closedTiles, unlockCost } from '../../game/tiles/unlock';
import { withPortalEdges } from '../../game/world/portals';
import {
  flippedSwitchesKey,
  gameMapAtRound,
  getGameMap,
} from '../../maps/maps';
import {
  BotPersonality,
  BotProfile,
  Game,
  GameMap,
  LockedTile,
  TurnPhase,
} from '../../types';
import { difficultyParams } from '../difficulty';
import { troopsPerDefender } from '../features/combat';
import { finisherMode } from '../features/finisher';
import { DuelFocus, duelFocus } from '../features/mode/duel';
import { shippedSeaIdsOf } from '../features/navy';
import {
  neighborStackFocus,
  NEUTRAL_STACK_FOCUS,
} from '../features/stackStyle';
import { buildStanding, playerStrengths, Standing } from '../features/standing';
import { isHazardTerritory } from '../features/territory';
import { publicIncomes, withPublicIntel } from '../intel';
import { erraticStyle } from '../personality/erratic';
import { getWeights } from '../personality/registry';
import { policeStrongestPreference } from '../personality/specialists/police';
import { BotStyle, DifficultyParams, Weights } from '../types';
import { BotView, getBotView, isVisible } from '../view';
import { isPlanFresh, MapTopology, TurnPlan } from './turnPlan';

export interface PlanContext {
  game: Game;
  map: GameMap;
  botId: number;
  personality: BotPersonality;
  view: BotView;
  weights: Weights;
  params: DifficultyParams;
  neighbors: Map<number, number[]>;
  horizonNeighbors: Map<number, number[]>;
  attackers: Map<number, number[]>;
  horizonAttackers: Map<number, number[]>;
  routeNeighbors: Map<number, number[]>;
  closedTileIds: Set<number>;
  unlockCost: number;
  seaLinks: Map<number, number[]>;
  shippedSeaIds: Set<number>;
  continentTerritories: Map<number, number[]>;
  territoryContinent: Map<number, number>;
  friendlyIds: Set<number>;
  preTurnOpponents: Map<number, number>;
  standing: Standing;
  duel: DuelFocus;
  finisher: boolean;
  stackFocus: number;
  income: number;
}

const FINISHER_DEPTH = 40;
const INCOME_INTEL = 1;
const FULL_INTEL = 2;

export function planDepth(ctx: PlanContext): number {
  return ctx.finisher
    ? Math.max(ctx.params.maxPlanDepth, FINISHER_DEPTH)
    : ctx.params.maxPlanDepth;
}

function landNeighbors(game: Game, map: GameMap): Map<number, number[]> {
  const seaIds = new Set(map.seaTerritories.map((t) => t.id));
  return new Map(
    map.territories.map((territory) => [
      territory.id,
      withPortalEdges(
        territory.neighbors.filter((n) => !seaIds.has(n)),
        territory.id,
        game.portalTerritoryIds,
        game.portalsEnabled,
      ),
    ]),
  );
}

const PLACEMENT_PHASES: TurnPhase[] = ['territory', 'troop', 'capital'];

function othersMoveThisRound(game: Game, botId: number): boolean {
  const owners = new Set(game.territoryOwners.values());
  return game.playerIds
    .slice(game.playerIds.indexOf(botId) + 1)
    .some((id) => owners.has(id));
}

function horizonNeighborsOf(
  game: Game,
  map: GameMap,
  botId: number,
  neighbors: Map<number, number[]>,
  flippedSwitchIds: ReadonlySet<number>,
): Map<number, number[]> {
  if (
    map.timedConnections.length === 0 &&
    map.directionalConnections.length === 0
  )
    return neighbors;
  const next = landNeighbors(
    game,
    gameMapAtRound(game, game.roundNumber + 1, flippedSwitchIds),
  );
  if (
    !PLACEMENT_PHASES.includes(game.turnPhase) &&
    !othersMoveThisRound(game, botId)
  )
    return next;
  return new Map(
    [...next].map(([id, ids]) => [
      id,
      [...new Set([...ids, ...(neighbors.get(id) ?? [])])],
    ]),
  );
}

function reverseOf(
  map: GameMap,
  neighbors: Map<number, number[]>,
): Map<number, number[]> {
  if (map.directionalConnections.length === 0) return neighbors;
  const reverse = new Map<number, number[]>(
    [...neighbors.keys()].map((id) => [id, []]),
  );
  for (const [id, ids] of neighbors)
    for (const n of ids) reverse.get(n)?.push(id);
  return reverse;
}

function withClosedTiles(
  tiles: LockedTile[],
  neighbors: Map<number, number[]>,
): Map<number, number[]> {
  if (tiles.length === 0) return neighbors;
  const routes = new Map(neighbors);
  for (const tile of tiles) {
    routes.set(tile.id, tile.neighbors);
    for (const n of tile.neighbors)
      if (neighbors.has(n)) routes.set(n, [...routes.get(n)!, tile.id]);
  }
  return routes;
}

function buildTopology(
  game: Game,
  map: GameMap,
  botId: number,
  flippedSwitchIds: ReadonlySet<number> = game.flippedSwitchIds,
): MapTopology {
  const seaIds = new Set(map.seaTerritories.map((t) => t.id));
  const neighbors = landNeighbors(game, map);
  const seaLinks = new Map<number, number[]>();
  const continentTerritories = new Map<number, number[]>();
  const territoryContinent = new Map<number, number>();

  for (const sea of map.seaTerritories) seaLinks.set(sea.id, sea.neighbors);
  for (const territory of map.territories) {
    seaLinks.set(
      territory.id,
      territory.neighbors.filter((n) => seaIds.has(n)),
    );
    territoryContinent.set(territory.id, territory.continentId);
    if (territory.continentId < 0) continue;
    const list = continentTerritories.get(territory.continentId);
    if (list) list.push(territory.id);
    else continentTerritories.set(territory.continentId, [territory.id]);
  }

  const horizonNeighbors = horizonNeighborsOf(
    game,
    map,
    botId,
    neighbors,
    flippedSwitchIds,
  );
  const tiles = closedTiles(game);
  return {
    neighbors,
    horizonNeighbors,
    attackers: reverseOf(map, neighbors),
    horizonAttackers: reverseOf(map, horizonNeighbors),
    routeNeighbors: withClosedTiles(tiles, neighbors),
    closedTileIds: new Set(tiles.map((tile) => tile.id)),
    seaLinks,
    continentTerritories,
    territoryContinent,
    unlockedTiles: game.unlockedTileIds.size,
    flippedSwitches: flippedSwitchesKey(flippedSwitchIds),
  };
}

interface Focus {
  view: BotView;
  friendlyIds: Set<number>;
  preTurnOpponents: Map<number, number>;
  standing: Standing;
  duel: DuelFocus;
  finisher: boolean;
}

interface FocusCache extends Focus {
  game: Game;
  botId: number;
  roundNumber: number;
  turnPhase: string;
  ownedCount: number;
  flippedKey: string;
}

let focusCache: FocusCache | null = null;

function ownedCountOf(game: Game, botId: number): number {
  let count = 0;
  for (const ownerId of game.territoryOwners.values())
    if (ownerId === botId) count++;
  return count;
}

function computeFocus(
  game: Game,
  botId: number,
  personality: BotPersonality,
  continentTerritories: Map<number, number[]>,
  bonuses: number[],
  weights: Weights,
  params: DifficultyParams,
): Focus {
  const friendlyIds = alliedIds(game, botId);
  const fogged = getBotView(game, botId);
  const intel = params.intel - (personality === 'balanced' ? 0 : 1);
  const incomes =
    intel >= INCOME_INTEL && fogged.visibleIds !== null
      ? publicIncomes(game, botId)
      : null;
  const view =
    incomes && intel >= FULL_INTEL
      ? withPublicIntel(game, fogged, incomes, continentTerritories, bonuses)
      : fogged;
  const opponentTerritories = new Map<number, number>();
  const visibleOpponentTerritories = new Map<number, number>();
  for (const [id, ownerId] of game.territoryOwners) {
    if (ownerId === botId || friendlyIds.has(ownerId)) continue;
    opponentTerritories.set(
      ownerId,
      (opponentTerritories.get(ownerId) ?? 0) + 1,
    );
    if (isVisible(view, id))
      visibleOpponentTerritories.set(
        ownerId,
        (visibleOpponentTerritories.get(ownerId) ?? 0) + 1,
      );
  }
  const preTurnOpponents = new Map(
    [...opponentTerritories].filter(
      ([id, count]) => visibleOpponentTerritories.get(id) === count,
    ),
  );
  const standing = buildStanding(
    game,
    view,
    botId,
    friendlyIds,
    continentTerritories,
    bonuses,
    incomes,
    personality === 'police' ? policeStrongestPreference : 0,
  );
  const duel = duelFocus(game, botId, friendlyIds, weights, params);
  const finisher =
    params.maxPlanDepth > 0 && finisherMode(game, botId, friendlyIds);
  return { view, friendlyIds, preTurnOpponents, standing, duel, finisher };
}

function cachedFocus(
  game: Game,
  botId: number,
  personality: BotPersonality,
  continentTerritories: Map<number, number[]>,
  bonuses: number[],
  weights: Weights,
  params: DifficultyParams,
): Focus {
  const cache = focusCache;
  const ownedCount = ownedCountOf(game, botId);
  const flippedKey = flippedSwitchesKey(game.flippedSwitchIds);
  if (
    cache &&
    game.turnPhase === 'attack' &&
    cache.game === game &&
    cache.botId === botId &&
    cache.roundNumber === game.roundNumber &&
    cache.turnPhase === game.turnPhase &&
    cache.ownedCount === ownedCount &&
    cache.flippedKey === flippedKey
  )
    return cache;
  const focus = computeFocus(
    game,
    botId,
    personality,
    continentTerritories,
    bonuses,
    weights,
    params,
  );
  focusCache = {
    game,
    botId,
    roundNumber: game.roundNumber,
    turnPhase: game.turnPhase,
    ownedCount,
    flippedKey,
    ...focus,
  };
  return focus;
}

function incomeOf(game: Game, botId: number): number {
  const breakdown = calculateDeployTroopsBreakdown(game, botId);
  return Math.max(
    1,
    breakdown.territories +
      breakdown.bonuses +
      breakdown.capitals +
      breakdown.roundTroops +
      breakdown.bounties,
  );
}

function styleOf(
  botProfile: BotProfile,
  cachedPlan: TurnPlan | null,
  game: Game,
  botId: number,
): BotStyle {
  if (botProfile.personality !== 'erratic')
    return {
      personality: botProfile.personality,
      weights: getWeights(botProfile.personality),
    };
  return isPlanFresh(cachedPlan, game, botId) && cachedPlan.style
    ? cachedPlan.style
    : erraticStyle();
}

function planningMap(game: Game, gameMap: GameMap): GameMap {
  return game.continents !== 'off'
    ? gameMap
    : { ...gameMap, bonuses: gameMap.bonuses.map(() => 0) };
}

export function buildContext(
  game: Game,
  botId: number,
  botProfile: BotProfile,
  cachedPlan: TurnPlan | null,
): PlanContext {
  const map = planningMap(game, getGameMap(game));
  const topology =
    isPlanFresh(cachedPlan, game, botId) &&
    cachedPlan.topology?.unlockedTiles === game.unlockedTileIds.size &&
    cachedPlan.topology.flippedSwitches ===
      flippedSwitchesKey(game.flippedSwitchIds)
      ? cachedPlan.topology
      : buildTopology(game, map, botId);

  const { personality, weights } = styleOf(botProfile, cachedPlan, game, botId);
  const params = difficultyParams(botProfile.difficulty);

  const focus = cachedFocus(
    game,
    botId,
    personality,
    topology.continentTerritories,
    map.bonuses,
    weights,
    params,
  );
  const adaptive =
    botProfile.personality === 'balanced' && params.adaptivePlanning;
  const stackFocus = !adaptive
    ? NEUTRAL_STACK_FOCUS
    : isPlanFresh(cachedPlan, game, botId) &&
        cachedPlan.stackFocus !== undefined
      ? cachedPlan.stackFocus
      : neighborStackFocus(
          game,
          focus.view,
          botId,
          focus.friendlyIds,
          topology.neighbors,
        );

  return {
    game,
    map,
    botId,
    personality,
    view: focus.view,
    weights,
    params,
    neighbors: topology.neighbors,
    horizonNeighbors: topology.horizonNeighbors,
    attackers: topology.attackers,
    horizonAttackers: topology.horizonAttackers,
    routeNeighbors: topology.routeNeighbors,
    closedTileIds: topology.closedTileIds,
    unlockCost: unlockCost(game, botId),
    seaLinks: topology.seaLinks,
    shippedSeaIds: shippedSeaIdsOf(game, botId),
    continentTerritories: topology.continentTerritories,
    territoryContinent: topology.territoryContinent,
    friendlyIds: focus.friendlyIds,
    preTurnOpponents: focus.preTurnOpponents,
    standing: focus.standing,
    duel: focus.duel,
    finisher: focus.finisher,
    stackFocus,
    income: incomeOf(game, botId),
  };
}

export function withFlippedSwitch(
  ctx: PlanContext,
  flippedSwitchIds: ReadonlySet<number>,
): PlanContext {
  const map = planningMap(
    ctx.game,
    gameMapAtRound(ctx.game, ctx.game.roundNumber, flippedSwitchIds),
  );
  const topology = buildTopology(ctx.game, map, ctx.botId, flippedSwitchIds);
  return {
    ...ctx,
    map,
    neighbors: topology.neighbors,
    horizonNeighbors: topology.horizonNeighbors,
    attackers: topology.attackers,
    horizonAttackers: topology.horizonAttackers,
    routeNeighbors: topology.routeNeighbors,
  };
}

const horizons = new WeakMap<PlanContext, PlanContext>();

export function horizonOf(ctx: PlanContext): PlanContext {
  if (ctx.horizonNeighbors === ctx.neighbors) return ctx;
  let horizon = horizons.get(ctx);
  if (!horizon) {
    horizon = {
      ...ctx,
      neighbors: ctx.horizonNeighbors,
      attackers: ctx.horizonAttackers,
    };
    horizons.set(ctx, horizon);
  }
  return horizon;
}

export function isStrategist(ctx: PlanContext): boolean {
  return ctx.personality === 'balanced' && ctx.params.strategist;
}

export function timesCards(ctx: PlanContext): boolean {
  return ctx.params.cardTiming;
}

export function neighborsOf(ctx: PlanContext, territoryId: number): number[] {
  return ctx.neighbors.get(territoryId) ?? [];
}

export function routeNeighborsOf(
  ctx: PlanContext,
  territoryId: number,
): number[] {
  return ctx.routeNeighbors.get(territoryId) ?? [];
}

export function attackersOf(ctx: PlanContext, territoryId: number): number[] {
  return ctx.attackers.get(territoryId) ?? [];
}

const touchingMaps = new WeakMap<
  Map<number, number[]>,
  Map<number, number[]>
>();

export function touchingOf(ctx: PlanContext, territoryId: number): number[] {
  if (ctx.attackers === ctx.neighbors) return neighborsOf(ctx, territoryId);
  let touching = touchingMaps.get(ctx.attackers);
  if (!touching) {
    touching = new Map(
      [...ctx.neighbors].map(([id, ids]) => [
        id,
        [...new Set([...ids, ...attackersOf(ctx, id)])],
      ]),
    );
    touchingMaps.set(ctx.attackers, touching);
  }
  return touching.get(territoryId) ?? [];
}

export function bonusOf(ctx: PlanContext, continentId: number): number {
  return ctx.map.bonuses[continentId] ?? 0;
}

export function isFriendly(ctx: PlanContext, playerId: number): boolean {
  return playerId === ctx.botId || ctx.friendlyIds.has(playerId);
}

export function isHazard(ctx: PlanContext, territoryId: number): boolean {
  if (!isVisible(ctx.view, territoryId)) return false;
  return (
    ctx.game.territoryToxins.has(territoryId) ||
    ctx.game.radiationTerritoryIds.has(territoryId)
  );
}

export function defenceDiceAt(ctx: PlanContext, territoryId: number): number {
  return defenceDiceFor(ctx.game, territoryId);
}

export function troopsPerDefenderAt(
  ctx: PlanContext,
  territoryId: number,
): number {
  return troopsPerDefender(ctx.game, defenceDiceAt(ctx, territoryId));
}

export interface SimState {
  owners: Map<number, number>;
  troops: Map<number, number>;
  damageByPlayer: Map<number, number>;
  conquestsByPlayer: Map<number, number>;
  conquered: boolean;
  troopsLost: number;
  cards: number;
  setsCashed: number;
}

export function snapshotState(ctx: PlanContext): SimState {
  const owners = new Map<number, number>();
  const troops = new Map<number, number>();
  for (const territory of ctx.map.territories) {
    if (!isVisible(ctx.view, territory.id)) {
      const remembered = ctx.view.remembered.get(territory.id);
      if (!remembered) continue;
      owners.set(territory.id, remembered.ownerId);
      troops.set(territory.id, remembered.troops);
      continue;
    }
    const ownerId = ctx.game.territoryOwners.get(territory.id);
    if (ownerId !== undefined) owners.set(territory.id, ownerId);
    troops.set(territory.id, ctx.game.territoryTroops.get(territory.id) ?? 0);
  }
  return {
    owners,
    troops,
    damageByPlayer: new Map(),
    conquestsByPlayer: new Map(),
    conquered: ctx.game.conqueredThisTurn,
    troopsLost: 0,
    cards: ctx.game.playerCards.get(ctx.botId)?.length ?? 0,
    setsCashed: 0,
  };
}

export function cloneState(state: SimState): SimState {
  return {
    owners: new Map(state.owners),
    troops: new Map(state.troops),
    damageByPlayer: new Map(state.damageByPlayer),
    conquestsByPlayer: new Map(state.conquestsByPlayer),
    conquered: state.conquered,
    troopsLost: state.troopsLost,
    cards: state.cards,
    setsCashed: state.setsCashed,
  };
}

export function troopsIn(state: SimState, territoryId: number): number {
  return state.troops.get(territoryId) ?? 0;
}

export function ownedIds(state: SimState, playerId: number): number[] {
  const ids: number[] = [];
  for (const [id, ownerId] of state.owners) {
    if (ownerId === playerId) ids.push(id);
  }
  return ids;
}

export function isEnemyTerritory(
  ctx: PlanContext,
  state: SimState,
  territoryId: number,
): boolean {
  const ownerId = state.owners.get(territoryId);
  if (ownerId === undefined) return false;
  return !isFriendly(ctx, ownerId);
}

export function isBotBorder(
  ctx: PlanContext,
  state: SimState,
  territoryId: number,
): boolean {
  if (state.owners.get(territoryId) !== ctx.botId) return false;
  return touchingOf(ctx, territoryId).some((n) =>
    isForeignTerritory(ctx, state, n),
  );
}

export function attacksOut(
  ctx: PlanContext,
  state: SimState,
  territoryId: number,
): boolean {
  return neighborsOf(ctx, territoryId).some((n) =>
    isForeignTerritory(ctx, state, n),
  );
}

function isForeignTerritory(
  ctx: PlanContext,
  state: SimState,
  territoryId: number,
): boolean {
  return (
    state.owners.get(territoryId) !== ctx.botId &&
    !isFriendlyTerritory(ctx, state, territoryId)
  );
}

function isFriendlyTerritory(
  ctx: PlanContext,
  state: SimState,
  territoryId: number,
): boolean {
  const ownerId = state.owners.get(territoryId);
  return ownerId !== undefined && isFriendly(ctx, ownerId);
}

function isHostileTerritory(
  ctx: PlanContext,
  state: SimState,
  territoryId: number,
): boolean {
  const ownerId = state.owners.get(territoryId);
  if (ownerId === undefined) return !isHazard(ctx, territoryId);
  return !isFriendly(ctx, ownerId) && !isHazard(ctx, territoryId);
}

export function hostileNeighborsOf(
  ctx: PlanContext,
  state: SimState,
  territoryId: number,
): number[] {
  return neighborsOf(ctx, territoryId).filter((n) =>
    isHostileTerritory(ctx, state, n),
  );
}

export function hostileAttackersOf(
  ctx: PlanContext,
  state: SimState,
  territoryId: number,
): number[] {
  return attackersOf(ctx, territoryId).filter((n) =>
    isHostileTerritory(ctx, state, n),
  );
}

export function strongestThreatAt(
  ctx: PlanContext,
  state: SimState,
  territoryId: number,
): number {
  let worst = 0;
  for (const n of attackersOf(ctx, territoryId)) {
    if (!isEnemyTerritory(ctx, state, n)) continue;
    const troops = troopsIn(state, n);
    if (troops > worst) worst = troops;
  }
  return worst;
}

export function ownedClusters(ctx: PlanContext, state: SimState): number[][] {
  const owned = new Set(ownedIds(state, ctx.botId));
  const seen = new Set<number>();
  const clusters: number[][] = [];
  for (const start of owned) {
    if (seen.has(start)) continue;
    const cluster: number[] = [];
    const queue = [start];
    seen.add(start);
    while (queue.length > 0) {
      const current = queue.shift()!;
      cluster.push(current);
      for (const n of touchingOf(ctx, current)) {
        if (owned.has(n) && !seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

export function holdsContinent(
  ctx: PlanContext,
  state: SimState,
  territoryIds: number[],
  playerId: number,
): boolean {
  const counted = territoryIds.filter(
    (id) => !isHazardTerritory(ctx.game, ctx.view, id),
  );
  const owned = counted.filter((id) => state.owners.get(id) === playerId);
  return (
    owned.length * 2 > counted.length &&
    counted.every(
      (id) =>
        state.owners.get(id) === playerId ||
        (!state.owners.has(id) && isVisible(ctx.view, id)),
    )
  );
}

export function heldContinentBonus(
  ctx: PlanContext,
  state: SimState,
  playerId: number,
): number {
  let total = 0;
  for (const [continentId, territoryIds] of ctx.continentTerritories) {
    if (holdsContinent(ctx, state, territoryIds, playerId))
      total += bonusOf(ctx, continentId);
  }
  return total;
}

export function opponentIds(ctx: PlanContext, state: SimState): number[] {
  const ids = new Set<number>();
  for (const ownerId of state.owners.values()) {
    if (!isFriendly(ctx, ownerId)) ids.add(ownerId);
  }
  return [...ids];
}

function strengthsByPlayer(
  ctx: PlanContext,
  state: SimState,
  playerIds: number[],
): Map<number, number> {
  const all = playerStrengths(
    state.owners,
    state.troops,
    ctx.continentTerritories,
    ctx.map.bonuses,
    ctx.game.troopsPerTerritory,
  );
  return new Map(playerIds.map((id) => [id, all.get(id) ?? 0]));
}

export function strongestOpponent(
  ctx: PlanContext,
  state: SimState,
): { playerId: number; strength: number } | null {
  const ids = opponentIds(ctx, state);
  const strengths = strengthsByPlayer(ctx, state, ids);
  let best: { playerId: number; strength: number } | null = null;
  for (const id of ids) {
    const strength = strengths.get(id)!;
    if (!best || strength > best.strength) best = { playerId: id, strength };
  }
  return best;
}

export function rankedOpponents(
  ctx: PlanContext,
  state: SimState,
): { playerId: number; strength: number }[] {
  const ids = opponentIds(ctx, state);
  const strengths = strengthsByPlayer(ctx, state, ids);
  return ids
    .map((playerId) => ({
      playerId,
      strength: strengths.get(playerId)!,
    }))
    .sort((a, b) => b.strength - a.strength);
}

export function botBorderIds(ctx: PlanContext, state: SimState): number[] {
  return ownedIds(state, ctx.botId).filter((id) => isBotBorder(ctx, state, id));
}

export function mainCluster(ctx: PlanContext, state: SimState): number[] {
  const clusters = ownedClusters(ctx, state);
  if (clusters.length === 0) return [];
  return clusters.reduce((a, b) => (a.length >= b.length ? a : b));
}

export function frontierStacks(
  ctx: PlanContext,
  state: SimState,
  minTroops: number,
): number[] {
  return botBorderIds(ctx, state)
    .filter(
      (id) => troopsIn(state, id) >= minTroops && attacksOut(ctx, state, id),
    )
    .sort((a, b) => troopsIn(state, b) - troopsIn(state, a));
}

export function conquerablePath(
  ctx: PlanContext,
  state: SimState,
  fromId: number,
  toId: number,
  maxLength: number,
): number[] | null {
  const prev = new Map<number, number>();
  const visited = new Set<number>([fromId]);
  let frontier = [fromId];
  for (let depth = 0; depth < maxLength && frontier.length > 0; depth++) {
    const next: number[] = [];
    for (const current of frontier) {
      for (const n of neighborsOf(ctx, current)) {
        if (visited.has(n)) continue;
        if (n === toId) {
          const path = [toId];
          let node = current;
          while (node !== fromId) {
            path.unshift(node);
            node = prev.get(node)!;
          }
          return path.slice(0, -1);
        }
        const ownerId = state.owners.get(n);
        if (ownerId !== undefined && isFriendly(ctx, ownerId)) continue;
        if (isHazard(ctx, n)) continue;
        visited.add(n);
        prev.set(n, current);
        next.push(n);
      }
    }
    frontier = next;
  }
  return null;
}

export function ownedChokepoints(ctx: PlanContext, state: SimState): number[] {
  const cluster = mainCluster(ctx, state);
  if (cluster.length < 4) return [];
  const clusterSet = new Set(cluster);
  const chokepoints: number[] = [];
  for (const cut of cluster) {
    if (!isBotBorder(ctx, state, cut)) continue;
    const remaining = cluster.filter((id) => id !== cut);
    if (remaining.length === 0) continue;
    const seen = new Set<number>([remaining[0]]);
    const queue = [remaining[0]];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const n of touchingOf(ctx, current)) {
        if (n === cut || !clusterSet.has(n) || seen.has(n)) continue;
        seen.add(n);
        queue.push(n);
      }
    }
    if (seen.size < remaining.length) chokepoints.push(cut);
  }
  return chokepoints;
}
