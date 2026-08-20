import { maps } from '../../maps';
import { Game } from '../../types';

const COLOR_COUNT = 20;

function colorBound(game: Game) {
  return Math.min(COLOR_COUNT, game.playerIds.length + 3);
}

export function maxTeam(game: Game) {
  return Math.max(0, game.playerIds.length - 1);
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

export function assignTerritories(game: Game) {
  const map = maps.get(game.mapName)!;
  const territoryIds = shuffle(map.territories.map((t) => t.id));
  const playerCount = game.playerIds.length;
  const base = Math.floor(territoryIds.length / playerCount);
  const remainder = territoryIds.length % playerCount;

  let index = 0;
  game.playerIds.forEach((playerId, i) => {
    const count = base + (i >= playerCount - remainder ? 1 : 0);
    const owned = territoryIds.slice(index, index + count);
    index += count;

    for (const territoryId of owned) {
      game.territoryOwners.set(territoryId, playerId);
      game.territoryTroops.set(territoryId, 1);
    }

    let remainingTroops = count * 2;
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

export function calculateDeployTroops(game: Game, playerId: number): number {
  const map = maps.get(game.mapName)!;
  const territoryCount = [...game.territoryOwners.values()].filter(
    (ownerId) => ownerId === playerId,
  ).length;
  const territoryTroops = Math.max(3, Math.floor(territoryCount / 3));

  const continents = new Map<number, number[]>();
  for (const territory of map.territories) {
    const list = continents.get(territory.continentId);
    if (list) list.push(territory.id);
    else continents.set(territory.continentId, [territory.id]);
  }

  let bonusTroops = 0;
  for (const [continentId, territoryIds] of continents) {
    const controlsAll = territoryIds.every(
      (id) => game.territoryOwners.get(id) === playerId,
    );
    if (controlsAll) bonusTroops += map.bonuses[continentId] ?? 0;
  }

  if (game.gameMode === 'Capitals') {
    const capitalsControlled = [...game.capitalTerritoryIds].filter(
      (id) => game.territoryOwners.get(id) === playerId,
    ).length;
    bonusTroops += capitalsControlled * 2;
  }

  return territoryTroops + bonusTroops;
}

export function assignRandomColor(game: Game, playerId: number) {
  const bound = colorBound(game);
  const used = new Set(game.playerColors.values());
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
  const bound = colorBound(game);
  const current = game.playerColors.get(playerId) ?? 0;
  const usedByOthers = new Set(
    [...game.playerColors.entries()]
      .filter(([id]) => id !== playerId)
      .map(([, index]) => index),
  );
  for (let step = 1; step <= bound; step++) {
    const candidate = (current + step) % bound;
    if (!usedByOthers.has(candidate)) {
      game.playerColors.set(playerId, candidate);
      return;
    }
  }
}
