import { alliedIds } from '../../game/alliances';
import { withPortalEdges } from '../../game/world/portals';
import { getGameMap } from '../../maps/maps';
import { BotPersonality, BotProfile, Game, GameMap } from '../../types';
import { difficultyParams } from '../difficulty';
import { defenceDiceFor } from '../features/combat';
import { finisherMode } from '../features/finisher';
import { DuelFocus, duelFocus } from '../features/mode/duel';
import { shippedSeaIdsOf } from '../features/navy';
import { buildStanding, playerStrengths, Standing } from '../features/standing';
import { getWeights } from '../personality/registry';
import { DifficultyParams, Weights } from '../types';
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
  seaLinks: Map<number, number[]>;
  shippedSeaIds: Set<number>;
  continentTerritories: Map<number, number[]>;
  territoryContinent: Map<number, number>;
  friendlyIds: Set<number>;
  preTurnOpponents: Map<number, number>;
  standing: Standing;
  duel: DuelFocus;
  finisher: boolean;
}

const FINISHER_DEPTH = 40;

export function planDepth(ctx: PlanContext): number {
  return ctx.finisher
    ? Math.max(ctx.params.maxPlanDepth, FINISHER_DEPTH)
    : ctx.params.maxPlanDepth;
}

function buildTopology(game: Game, map: GameMap): MapTopology {
  const seaIds = new Set(map.seaTerritories.map((t) => t.id));
  const neighbors = new Map<number, number[]>();
  const seaLinks = new Map<number, number[]>();
  const continentTerritories = new Map<number, number[]>();
  const territoryContinent = new Map<number, number>();

  for (const sea of map.seaTerritories) seaLinks.set(sea.id, sea.neighbors);
  for (const territory of map.territories) {
    seaLinks.set(
      territory.id,
      territory.neighbors.filter((n) => seaIds.has(n)),
    );
    neighbors.set(
      territory.id,
      withPortalEdges(
        territory.neighbors.filter((n) => !seaIds.has(n)),
        territory.id,
        game.portalTerritoryIds,
        game.portalsEnabled,
      ),
    );
    territoryContinent.set(territory.id, territory.continentId);
    if (territory.continentId < 0) continue;
    const list = continentTerritories.get(territory.continentId);
    if (list) list.push(territory.id);
    else continentTerritories.set(territory.continentId, [territory.id]);
  }

  return { neighbors, seaLinks, continentTerritories, territoryContinent };
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
  continentTerritories: Map<number, number[]>,
  bonuses: number[],
  weights: Weights,
  params: DifficultyParams,
): Focus {
  const friendlyIds = alliedIds(game, botId);
  const view = getBotView(game, botId);
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
  );
  const duel = duelFocus(game, botId, friendlyIds, weights, params);
  const finisher =
    params.maxPlanDepth > 0 && finisherMode(game, botId, friendlyIds);
  return { view, friendlyIds, preTurnOpponents, standing, duel, finisher };
}

function cachedFocus(
  game: Game,
  botId: number,
  continentTerritories: Map<number, number[]>,
  bonuses: number[],
  weights: Weights,
  params: DifficultyParams,
): Focus {
  const cache = focusCache;
  const ownedCount = ownedCountOf(game, botId);
  if (
    cache &&
    game.turnPhase === 'attack' &&
    cache.game === game &&
    cache.botId === botId &&
    cache.roundNumber === game.roundNumber &&
    cache.turnPhase === game.turnPhase &&
    cache.ownedCount === ownedCount
  )
    return cache;
  const focus = computeFocus(
    game,
    botId,
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
    ...focus,
  };
  return focus;
}

export function buildContext(
  game: Game,
  botId: number,
  botProfile: BotProfile,
  cachedPlan: TurnPlan | null,
): PlanContext {
  const map = getGameMap(game);
  const topology =
    isPlanFresh(cachedPlan, game, botId) && cachedPlan.topology
      ? cachedPlan.topology
      : buildTopology(game, map);

  const weights = getWeights(botProfile.personality);
  const params = difficultyParams(botProfile.difficulty);

  const focus = cachedFocus(
    game,
    botId,
    topology.continentTerritories,
    map.bonuses,
    weights,
    params,
  );

  return {
    game,
    map,
    botId,
    personality: botProfile.personality,
    view: focus.view,
    weights,
    params,
    neighbors: topology.neighbors,
    seaLinks: topology.seaLinks,
    shippedSeaIds: shippedSeaIdsOf(game, botId),
    continentTerritories: topology.continentTerritories,
    territoryContinent: topology.territoryContinent,
    friendlyIds: focus.friendlyIds,
    preTurnOpponents: focus.preTurnOpponents,
    standing: focus.standing,
    duel: focus.duel,
    finisher: focus.finisher,
  };
}

export function neighborsOf(ctx: PlanContext, territoryId: number): number[] {
  return ctx.neighbors.get(territoryId) ?? [];
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

export interface SimState {
  owners: Map<number, number>;
  troops: Map<number, number>;
  damageByPlayer: Map<number, number>;
  conquestsByPlayer: Map<number, number>;
  conquered: boolean;
  troopsLost: number;
}

export function snapshotState(ctx: PlanContext): SimState {
  const owners = new Map<number, number>();
  const troops = new Map<number, number>();
  for (const territory of ctx.map.territories) {
    if (!isVisible(ctx.view, territory.id)) continue;
    const ownerId = ctx.game.territoryOwners.get(territory.id);
    if (ownerId !== undefined) owners.set(territory.id, ownerId);
    troops.set(territory.id, ctx.game.territoryTroops.get(territory.id) ?? 0);
  }
  return {
    owners,
    troops,
    damageByPlayer: new Map(),
    conquestsByPlayer: new Map(),
    conquered: false,
    troopsLost: 0,
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
  return neighborsOf(ctx, territoryId).some(
    (n) =>
      state.owners.get(n) !== ctx.botId && !isFriendlyTerritory(ctx, state, n),
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

export function hostileNeighborsOf(
  ctx: PlanContext,
  state: SimState,
  territoryId: number,
): number[] {
  return neighborsOf(ctx, territoryId).filter((n) => {
    const ownerId = state.owners.get(n);
    if (ownerId === undefined) return !isHazard(ctx, n);
    return !isFriendly(ctx, ownerId) && !isHazard(ctx, n);
  });
}

export function strongestThreatAt(
  ctx: PlanContext,
  state: SimState,
  territoryId: number,
): number {
  let worst = 0;
  for (const n of neighborsOf(ctx, territoryId)) {
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
      for (const n of neighborsOf(ctx, current)) {
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

export function heldContinentBonus(
  ctx: PlanContext,
  state: SimState,
  playerId: number,
): number {
  let total = 0;
  for (const [continentId, territoryIds] of ctx.continentTerritories) {
    if (territoryIds.every((id) => state.owners.get(id) === playerId))
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
    .filter((id) => troopsIn(state, id) >= minTroops)
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
      for (const n of neighborsOf(ctx, current)) {
        if (n === cut || !clusterSet.has(n) || seen.has(n)) continue;
        seen.add(n);
        queue.push(n);
      }
    }
    if (seen.size < remaining.length) chokepoints.push(cut);
  }
  return chokepoints;
}
