import { getGameMap } from '../maps/maps';
import { playersById } from '../session/players';
import { DEFAULT_PLAYER_ODDS, Game } from '../types';
import { isInteger } from '../util/validate';
import { recordReplayFrame } from './replay';
import {
  connectedFortifyTerritories,
  ownedTerritoryClusters,
} from './world/connectivity';

export const COLOR_COUNT = 20;

function colorBound(playerCount: number) {
  return Math.min(COLOR_COUNT, playerCount + 3);
}

export function nextFreeColor(
  current: number,
  usedByOthers: Set<number>,
  playerCount: number,
): number {
  const bound = colorBound(playerCount);
  for (let step = 1; step <= bound; step++) {
    const candidate = (current + step) % bound;
    if (!usedByOthers.has(candidate)) return candidate;
  }
  return current;
}

export function supremacyTerritoriesToWin(game: Game): number | null {
  const fraction =
    game.gameMode === 'supremacy 3/4'
      ? 3 / 4
      : game.gameMode === 'supremacy 2/3'
        ? 2 / 3
        : null;
  if (fraction === null) return null;
  return Math.ceil(availableTerritoryCount(game) * fraction);
}

export function availableTerritoryCount(game: Game): number {
  const permanentToxinCount = [...game.territoryToxins.values()].filter(
    (toxin) => toxin.permanent,
  ).length;
  return (
    getGameMap(game).territories.length -
    game.radiationTerritoryIds.size -
    permanentToxinCount
  );
}

export function ownsAnyTerritory(game: Game, playerId: number): boolean {
  for (const ownerId of game.territoryOwners.values()) {
    if (ownerId === playerId) return true;
  }
  return false;
}

export function ownedTerritoryIds(game: Game, playerId: number): number[] {
  return [...game.territoryOwners.entries()]
    .filter(([, ownerId]) => ownerId === playerId)
    .map(([territoryId]) => territoryId);
}

export function teamCount(game: Game) {
  return new Set(game.playerIds.map((id) => game.playerTeams.get(id) ?? 0))
    .size;
}

export function compactTeams(game: Game) {
  const usedTeams = [
    ...new Set(game.playerIds.map((id) => game.playerTeams.get(id) ?? 0)),
  ].sort((a, b) => a - b);
  const remap = new Map(usedTeams.map((team, index) => [team, index]));
  for (const id of game.playerIds) {
    const oldTeam = game.playerTeams.get(id) ?? 0;
    game.playerTeams.set(id, remap.get(oldTeam)!);
  }
}

export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function isValidCycle(order: number[], playerTeams: Map<number, number>) {
  const n = order.length;
  for (let i = 0; i < n; i++) {
    const a = playerTeams.get(order[i]) ?? 0;
    const b = playerTeams.get(order[(i + 1) % n]) ?? 0;
    if (a === b) return false;
  }
  return true;
}

function fixWrapAround(order: number[], playerTeams: Map<number, number>) {
  const n = order.length;
  if (n < 3) return;
  const teamAt = (i: number) => playerTeams.get(order[i]) ?? 0;
  if (teamAt(0) !== teamAt(n - 1)) return;

  for (let i = n - 2; i >= 1; i--) {
    const swapped = [...order];
    [swapped[i], swapped[n - 1]] = [swapped[n - 1], swapped[i]];
    if (isValidCycle(swapped, playerTeams)) {
      order.splice(0, n, ...swapped);
      return;
    }
  }
}

interface TeamQueue {
  team: number;
  queue: number[];
}

export function interleaveTeams(game: Game): number[] {
  const byTeam = new Map<number, number[]>();
  for (const id of game.playerIds) {
    const team = game.playerTeams.get(id) ?? 0;
    const list = byTeam.get(team);
    if (list) list.push(id);
    else byTeam.set(team, [id]);
  }

  const queues: TeamQueue[] = [...byTeam.entries()].map(([team, players]) => ({
    team,
    queue: shuffle(players),
  }));

  const total = game.playerIds.length;
  const order: number[] = [];
  let firstTeam: number | null = null;
  let lastTeam: number | null = null;
  while (order.length < total) {
    const nonEmpty: TeamQueue[] = queues.filter((q) => q.queue.length > 0);
    const avoid: (number | null)[] =
      order.length === total - 1 ? [lastTeam, firstTeam] : [lastTeam];

    let pool: TeamQueue[] = nonEmpty.filter((q) => !avoid.includes(q.team));
    if (pool.length === 0) pool = nonEmpty.filter((q) => q.team !== lastTeam);
    if (pool.length === 0) pool = nonEmpty;

    const maxRemaining = Math.max(...pool.map((q) => q.queue.length));
    const tied = pool.filter((q) => q.queue.length === maxRemaining);
    const chosen = tied[Math.floor(Math.random() * tied.length)];
    order.push(chosen.queue.shift()!);
    if (firstTeam === null) firstTeam = chosen.team;
    lastTeam = chosen.team;
  }

  fixWrapAround(order, game.playerTeams);
  return order;
}

export function initialTroopsFor(game: Game, playerId: number): number {
  return (
    (game.odds === 'on' ? game.playerOdds.get(playerId)?.troops : null) ??
    game.initialTroops
  );
}

export function minTroopsFor(game: Game, playerId: number): number {
  return (
    (game.odds === 'on' ? game.playerOdds.get(playerId)?.minTroops : null) ??
    game.minTroops
  );
}

export function turnOrderBonus(index: number): number {
  if (index < 3) return 0;
  if (index < 5) return index - 2;
  return 3 + Math.floor((index - 5) / 4);
}

export function startingPoolBonus(game: Game, index: number): number {
  return game.gameMode !== 'capitals' && game.placement === 'custom'
    ? turnOrderBonus(index)
    : 0;
}

function firstTurnBonus(
  game: Pick<Game, 'gameMode' | 'placement'>,
  index: number,
): number {
  return game.gameMode !== 'capitals' && game.placement !== 'custom'
    ? turnOrderBonus(index)
    : 0;
}

function territoryWeights(game: Game): number[] {
  return game.playerIds.map(
    (id) =>
      (game.odds === 'on' ? game.playerOdds.get(id)?.territories : undefined) ??
      DEFAULT_PLAYER_ODDS.territories,
  );
}

export function territoryQuotas(game: Game, total: number): number[] {
  const weights = territoryWeights(game);
  const count = weights.length;
  if (weights.every((w) => w === weights[0]) || total < count) {
    const base = Math.floor(total / count);
    const remainder = total % count;
    return weights.map((_, i) => base + (i >= count - remainder ? 1 : 0));
  }
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  const exact = weights.map((w) => (total * w) / weightSum);
  const quotas = exact.map((share) => Math.max(1, Math.floor(share)));
  const indices = weights.map((_, i) => i);
  let surplus = quotas.reduce((sum, q) => sum + q, 0) - total;
  while (surplus > 0) {
    const donors = indices.filter((i) => quotas[i] > 1);
    const donor = donors.reduce((a, b) =>
      quotas[b] - exact[b] > quotas[a] - exact[a] ? b : a,
    );
    quotas[donor]--;
    surplus--;
  }
  for (; surplus < 0; surplus++) {
    const taker = indices.reduce((a, b) =>
      exact[b] - quotas[b] > exact[a] - quotas[a] ? b : a,
    );
    quotas[taker]++;
  }
  return quotas;
}

export function claimQuota(game: Game, playerId: number): number {
  const total =
    getGameMap(game).territories.length - game.radiationTerritoryIds.size;
  return territoryQuotas(game, total)[game.playerIds.indexOf(playerId)];
}

export function needsClaim(game: Game, playerId: number): boolean {
  if (game.deathOrder.includes(playerId)) return false;
  if (game.odds === 'off' || game.placement !== 'custom') return true;
  return ownedTerritoryIds(game, playerId).length < claimQuota(game, playerId);
}

function splitTerritoriesAmongPlayers(game: Game): number[][] {
  const map = getGameMap(game);
  const territoryIds = shuffle(
    map.territories
      .map((t) => t.id)
      .filter((id) => !game.radiationTerritoryIds.has(id)),
  );
  const quotas = territoryQuotas(game, territoryIds.length);
  const groups: number[][] = [];
  let index = 0;
  quotas.forEach((count) => {
    groups.push(territoryIds.slice(index, index + count));
    index += count;
  });
  return groups;
}

export function assignTerritoryOwners(game: Game): number[][] {
  const groups = splitTerritoriesAmongPlayers(game);
  game.playerIds.forEach((playerId, i) => {
    for (const territoryId of groups[i]) {
      game.territoryOwners.set(territoryId, playerId);
      game.territoryTroops.set(territoryId, 1);
    }
  });
  return groups;
}

export function assignTerritories(game: Game) {
  const groups = assignTerritoryOwners(game);
  game.playerIds.forEach((_, i) => {
    const owned = groups[i];
    let remainingTroops =
      owned.length * (initialTroopsFor(game, game.playerIds[i]) - 1);
    while (remainingTroops > 0) {
      const territoryId = owned[Math.floor(Math.random() * owned.length)];
      game.territoryTroops.set(
        territoryId,
        (game.territoryTroops.get(territoryId) ?? 0) + 1,
      );
      remainingTroops--;
    }
  });
}

export function supplyHubTerritoryIds(game: Game, playerId: number): number[] {
  const ownedCapitals = [...game.capitalTerritoryIds].filter(
    (id) => game.territoryOwners.get(id) === playerId,
  );
  if (ownedCapitals.length > 0) return ownedCapitals;

  const clusters = ownedTerritoryClusters(game, playerId);
  if (clusters.length === 0) return [];

  let best: {
    totalTroops: number;
    size: number;
    maxTroops: number;
    minId: number;
    hubId: number;
  } | null = null;
  for (const cluster of clusters) {
    let totalTroops = 0;
    let maxTroops = -Infinity;
    let minId = Infinity;
    let hubId = -1;
    for (const id of cluster) {
      const troops = game.territoryTroops.get(id) ?? 0;
      totalTroops += troops;
      minId = Math.min(minId, id);
      if (troops > maxTroops || (troops === maxTroops && id < hubId)) {
        maxTroops = troops;
        hubId = id;
      }
    }
    if (
      best === null ||
      totalTroops > best.totalTroops ||
      (totalTroops === best.totalTroops &&
        (cluster.length > best.size ||
          (cluster.length === best.size &&
            (maxTroops > best.maxTroops ||
              (maxTroops === best.maxTroops && minId < best.minId)))))
    ) {
      best = { totalTroops, size: cluster.length, maxTroops, minId, hubId };
    }
  }
  return [best!.hubId];
}

export interface TroopDeposit {
  territoryId: number;
  troops: number;
}

export const MAX_TERRITORY_TROOPS = 1_000_000;

export function deployableTroops(
  troopsToDeploy: number,
  territoryTroops: number,
): number {
  return Math.max(
    0,
    Math.min(troopsToDeploy, MAX_TERRITORY_TROOPS - territoryTroops),
  );
}

export function deployTargetIds(game: Game, playerId: number): number[] {
  const owned = ownedTerritoryIds(game, playerId);
  if (game.supplyLines !== 'on') return owned;
  const supplied = connectedFortifyTerritories(
    game,
    playerId,
    supplyHubTerritoryIds(game, playerId),
  );
  return owned.filter((id) => supplied.has(id));
}

export function deployCapacity(game: Game, playerId: number): number {
  return deployTargetIds(game, playerId).reduce(
    (sum, id) =>
      sum +
      Math.max(0, MAX_TERRITORY_TROOPS - (game.territoryTroops.get(id) ?? 0)),
    0,
  );
}

export function awardDeployTroops(
  game: Game,
  playerId: number,
  troops: number,
): number {
  const capacity = deployCapacity(game, playerId);
  game.troopsToDeploy = Math.min(game.troopsToDeploy, capacity);
  const awarded = Math.max(0, Math.min(troops, capacity - game.troopsToDeploy));
  game.troopsToDeploy += awarded;
  return awarded;
}

export function addTroopsCapped(
  game: Game,
  territoryId: number,
  troops: number,
): number {
  const current = game.territoryTroops.get(territoryId) ?? 0;
  const added = Math.max(0, Math.min(troops, MAX_TERRITORY_TROOPS - current));
  game.territoryTroops.set(territoryId, current + added);
  return added;
}

export function depositTroopsOnOwnedTerritory(
  game: Game,
  playerId: number,
  territoryId: unknown,
  troops: unknown,
): TroopDeposit | { error: string } {
  if (!isInteger(territoryId)) return { error: 'territory not owned' };
  if (game.territoryOwners.get(territoryId) !== playerId)
    return { error: 'territory not owned' };
  if (!isInteger(troops)) return { error: 'invalid troops' };
  if (troops < 1 || troops > game.troopsToDeploy)
    return { error: 'invalid troops' };
  if (
    (game.territoryTroops.get(territoryId) ?? 0) + troops >
    MAX_TERRITORY_TROOPS
  )
    return { error: 'territory troop cap exceeded' };
  if (
    game.supplyLines === 'on' &&
    !connectedFortifyTerritories(
      game,
      playerId,
      supplyHubTerritoryIds(game, playerId),
    ).has(territoryId)
  )
    return { error: 'territory not connected to supply hub' };

  game.territoryTroops.set(
    territoryId,
    (game.territoryTroops.get(territoryId) ?? 0) + troops,
  );
  recordReplayFrame(game, { type: 'deploy', territoryId, troops, playerId });
  game.troopsToDeploy -= troops;
  game.selectedTerritoryId = null;
  return { territoryId, troops };
}

export interface DeployTroopsBreakdown {
  territories: number;
  bonuses: number;
  capitals: number;
  roundTroops: number;
  bounties: number;
  turnOrder: number;
}

export function territoryIncome(
  game: Pick<Game, 'minTroops' | 'troopsPerTerritory'>,
  territoryCount: number,
  minTroops = game.minTroops,
): number {
  return Math.max(
    minTroops,
    Math.floor(territoryCount * game.troopsPerTerritory),
  );
}

export function continentHolderId(
  owners: (number | undefined)[],
): number | null {
  const holder = owners.find((ownerId) => ownerId !== undefined);
  if (holder === undefined) return null;
  const owned = owners.filter((ownerId) => ownerId === holder).length;
  const controlsContinent =
    owned * 2 > owners.length &&
    owners.every((ownerId) => ownerId === undefined || ownerId === holder);
  return controlsContinent ? holder : null;
}

export function heldContinentIds(game: Game, playerId: number): number[] {
  const continents = new Map<number, number[]>();
  for (const territory of getGameMap(game).territories) {
    if (territory.continentId < 0) continue;
    const list = continents.get(territory.continentId);
    if (list) list.push(territory.id);
    else continents.set(territory.continentId, [territory.id]);
  }

  const held: number[] = [];
  for (const [continentId, territoryIds] of continents) {
    const owners = territoryIds
      .filter(
        (id) =>
          !game.radiationTerritoryIds.has(id) && !game.territoryToxins.has(id),
      )
      .map((id) => game.territoryOwners.get(id));
    if (continentHolderId(owners) === playerId) held.push(continentId);
  }
  return held;
}

export type DeploySettings = Pick<
  Game,
  | 'minTroops'
  | 'troopsPerTerritory'
  | 'continents'
  | 'gameMode'
  | 'roundTroops'
  | 'bounties'
  | 'placement'
>;

export interface DeployFacts {
  minTroops?: number;
  roundNumber: number;
  playerIndex: number;
  territoryCount: number;
  heldBonuses: number;
  capitalsControlled: number;
  kills: number;
}

export function deployBreakdownFor(
  settings: DeploySettings,
  facts: DeployFacts,
): DeployTroopsBreakdown {
  return {
    territories: territoryIncome(
      settings,
      facts.territoryCount,
      facts.minTroops,
    ),
    bonuses: settings.continents === 'off' ? 0 : facts.heldBonuses,
    capitals:
      settings.gameMode === 'capitals' ? facts.capitalsControlled * 2 : 0,
    roundTroops: settings.roundTroops === 'on' ? facts.roundNumber + 1 : 0,
    bounties: settings.bounties === 'on' ? facts.kills * 10 : 0,
    turnOrder:
      facts.roundNumber === 0 ? firstTurnBonus(settings, facts.playerIndex) : 0,
  };
}

export function calculateDeployTroopsBreakdown(
  game: Game,
  playerId: number,
): DeployTroopsBreakdown {
  const map = getGameMap(game);
  let heldBonuses = 0;
  if (game.continents !== 'off') {
    for (const continentId of heldContinentIds(game, playerId))
      heldBonuses += map.bonuses[continentId] ?? 0;
  }

  return deployBreakdownFor(game, {
    minTroops: minTroopsFor(game, playerId),
    roundNumber: game.roundNumber,
    playerIndex: game.playerIds.indexOf(playerId),
    territoryCount: [...game.territoryOwners.values()].filter(
      (ownerId) => ownerId === playerId,
    ).length,
    heldBonuses,
    capitalsControlled: [...game.capitalTerritoryIds].filter(
      (id) => game.territoryOwners.get(id) === playerId,
    ).length,
    kills: game.stats.get(playerId)?.playersKilled.length ?? 0,
  });
}

export function assignRandomColor(game: Game, playerId: number) {
  const bound = colorBound(game.playerIds.length);
  const used = new Set(game.playerColors.values());
  const preferred = playersById
    .get(playerId)
    ?.preferredColors.find((color) => color < bound && !used.has(color));
  if (preferred !== undefined) {
    game.playerColors.set(playerId, preferred);
    return;
  }
  const available = [];
  for (let i = 0; i < bound; i++) {
    if (!used.has(i)) available.push(i);
  }
  const pool =
    available.length > 0
      ? available
      : Array.from({ length: bound }, (_, i) => i);
  game.playerColors.set(
    playerId,
    pool[Math.floor(Math.random() * pool.length)],
  );
}

export function cycleColor(game: Game, playerId: number) {
  const usedByOthers = new Set(
    [...game.playerColors.entries()]
      .filter(([id]) => id !== playerId)
      .map(([, index]) => index),
  );
  game.playerColors.set(
    playerId,
    nextFreeColor(
      game.playerColors.get(playerId) ?? 0,
      usedByOthers,
      game.playerIds.length,
    ),
  );
}
