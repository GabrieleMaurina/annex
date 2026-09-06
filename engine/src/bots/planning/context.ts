import { alliedIds } from '../../game/alliances';
import { withPortalEdges } from '../../game/world/portals';
import { getGameMap } from '../../maps/maps';
import { BotPersonality, BotProfile, Game, GameMap } from '../../types';
import { difficultyParams } from '../difficulty';
import { defenceDiceFor } from '../features/combat';
import { getWeights } from '../personality/registry';
import { DifficultyParams, Weights } from '../types';
import { BotView, getBotView, isVisible } from '../view';

export interface PlanContext {
  game: Game;
  map: GameMap;
  botId: number;
  personality: BotPersonality;
  view: BotView;
  weights: Weights;
  params: DifficultyParams;
  neighbors: Map<number, number[]>;
  continentTerritories: Map<number, number[]>;
  territoryContinent: Map<number, number>;
  friendlyIds: Set<number>;
  preTurnOpponents: Set<number>;
}

export function buildContext(
  game: Game,
  botId: number,
  botProfile: BotProfile,
): PlanContext {
  const map = getGameMap(game);
  const neighbors = new Map<number, number[]>();
  const continentTerritories = new Map<number, number[]>();
  const territoryContinent = new Map<number, number>();

  for (const territory of map.territories) {
    neighbors.set(
      territory.id,
      withPortalEdges(
        territory.neighbors,
        territory.id,
        game.portalTerritoryIds,
        game.portalsEnabled,
      ),
    );
    territoryContinent.set(territory.id, territory.continentId);
    const list = continentTerritories.get(territory.continentId);
    if (list) list.push(territory.id);
    else continentTerritories.set(territory.continentId, [territory.id]);
  }

  const friendlyIds = alliedIds(game, botId);
  const preTurnOpponents = new Set<number>();
  for (const ownerId of game.territoryOwners.values())
    if (ownerId !== botId && !friendlyIds.has(ownerId))
      preTurnOpponents.add(ownerId);

  return {
    game,
    map,
    botId,
    personality: botProfile.personality,
    view: getBotView(game, botId),
    weights: getWeights(botProfile.personality),
    params: difficultyParams(botProfile.difficulty),
    neighbors,
    continentTerritories,
    territoryContinent,
    friendlyIds,
    preTurnOpponents,
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
    conquered: false,
    troopsLost: 0,
  };
}

export function cloneState(state: SimState): SimState {
  return {
    owners: new Map(state.owners),
    troops: new Map(state.troops),
    damageByPlayer: new Map(state.damageByPlayer),
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

export function playerStrength(
  ctx: PlanContext,
  state: SimState,
  playerId: number,
): number {
  let territories = 0;
  let troops = 0;
  for (const [id, ownerId] of state.owners) {
    if (ownerId !== playerId) continue;
    territories++;
    troops += troopsIn(state, id);
  }
  return (
    territories + 3 * heldContinentBonus(ctx, state, playerId) + 0.5 * troops
  );
}

export function opponentIds(ctx: PlanContext, state: SimState): number[] {
  const ids = new Set<number>();
  for (const ownerId of state.owners.values()) {
    if (!isFriendly(ctx, ownerId)) ids.add(ownerId);
  }
  return [...ids];
}

export function strongestOpponent(
  ctx: PlanContext,
  state: SimState,
): { playerId: number; strength: number } | null {
  let best: { playerId: number; strength: number } | null = null;
  for (const id of opponentIds(ctx, state)) {
    const strength = playerStrength(ctx, state, id);
    if (!best || strength > best.strength) best = { playerId: id, strength };
  }
  return best;
}

export function rankedOpponents(
  ctx: PlanContext,
  state: SimState,
): { playerId: number; strength: number }[] {
  return opponentIds(ctx, state)
    .map((playerId) => ({
      playerId,
      strength: playerStrength(ctx, state, playerId),
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
