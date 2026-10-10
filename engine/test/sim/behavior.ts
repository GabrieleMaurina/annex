import { playerStrengths } from '../../src/bots/features/standing';
import { getGameMap } from '../../src/maps/maps';
import { Game } from '../../src/types';

const RUNAWAY_RATIO = 1.5;
const MULTI_MIN_PLAYERS = 4;
const SMALL_STACK = 6;
const LARGE_STACK = 12;

export interface BehaviorStats {
  turns: number;
  smallStackTurns: number;
  largeStackTurns: number;
  concentration: number;
  runawayAttacks: number;
  leaderAttacks: number;
  territoryTurns: number;
  attacksReceived: number;
  bonusTurns: number;
}

export type BehaviorEntry = [string, BehaviorStats];

export function emptyBehavior(): BehaviorStats {
  return {
    turns: 0,
    smallStackTurns: 0,
    largeStackTurns: 0,
    concentration: 0,
    runawayAttacks: 0,
    leaderAttacks: 0,
    territoryTurns: 0,
    attacksReceived: 0,
    bonusTurns: 0,
  };
}

function continentTerritories(game: Game): Map<number, number[]> {
  const continents = new Map<number, number[]>();
  for (const territory of getGameMap(game).territories) {
    if (territory.continentId < 0) continue;
    const list = continents.get(territory.continentId);
    if (list) list.push(territory.id);
    else continents.set(territory.continentId, [territory.id]);
  }
  return continents;
}

export function runawayLeader(game: Game, playerId: number): number | null {
  if (game.gameMode === 'team deathmatch') return null;
  const dead = new Set(game.deathOrder);
  const alive = game.playerIds.filter((id) => !dead.has(id));
  if (alive.length < MULTI_MIN_PLAYERS) return null;
  const strengths = playerStrengths(
    game.territoryOwners,
    game.territoryTroops,
    continentTerritories(game),
    getGameMap(game).bonuses,
    game.troopsPerTerritory,
  );
  const [leader, second] = alive
    .map((id) => ({ id, strength: strengths.get(id) ?? 0 }))
    .sort((a, b) => b.strength - a.strength);
  if (leader.id === playerId) return null;
  if (leader.strength < RUNAWAY_RATIO * Math.max(1, second.strength))
    return null;
  return leader.id;
}

export function recordAttack(
  stats: BehaviorStats,
  game: Game,
  leaderId: number | null,
  targetId: number,
): void {
  if (leaderId === null) return;
  stats.runawayAttacks++;
  if (game.territoryOwners.get(targetId) === leaderId) stats.leaderAttacks++;
}

export function recordTurnEnd(
  stats: BehaviorStats,
  game: Game,
  playerId: number,
): void {
  let largest = 0;
  let total = 0;
  let owned = 0;
  for (const [id, ownerId] of game.territoryOwners) {
    if (ownerId !== playerId) continue;
    const troops = game.territoryTroops.get(id) ?? 0;
    largest = Math.max(largest, troops);
    total += troops;
    owned++;
  }
  if (owned < 2) return;
  stats.turns++;
  stats.territoryTurns += owned;
  const bonuses = getGameMap(game).bonuses;
  for (const [continentId, ids] of continentTerritories(game))
    if (
      (bonuses[continentId] ?? 0) > 0 &&
      ids.every((id) => game.territoryOwners.get(id) === playerId)
    ) {
      stats.bonusTurns++;
      break;
    }
  if (largest >= SMALL_STACK) stats.smallStackTurns++;
  if (largest >= LARGE_STACK) stats.largeStackTurns++;
  stats.concentration += largest / total;
}

export function mergeBehavior(
  all: BehaviorEntry[][],
): Map<string, BehaviorStats> {
  const merged = new Map<string, BehaviorStats>();
  for (const entries of all)
    for (const [key, stats] of entries) {
      const current = merged.get(key) ?? emptyBehavior();
      for (const field of Object.keys(stats) as (keyof BehaviorStats)[])
        current[field] += stats[field];
      merged.set(key, current);
    }
  return merged;
}

function percent(part: number, whole: number): string {
  return whole > 0 ? `${((100 * part) / whole).toFixed(1)}%` : 'n/a';
}

export function formatBehavior(
  behavior: Map<string, BehaviorStats>,
  keys: string[],
): string {
  const lines = [
    'behavior (per bot turn; runaway = 4+ alive and a leader with 1.5x the second strength):',
    [
      'bot',
      'turns',
      `stack>=${SMALL_STACK}`,
      `stack>=${LARGE_STACK}`,
      'concentration',
      'runaway attacks',
      'on leader',
      'hit per 100 held',
      'holds bonus',
    ].join('\t'),
  ];
  for (const key of keys) {
    const stats = behavior.get(key);
    if (!stats) continue;
    lines.push(
      [
        key,
        stats.turns,
        percent(stats.smallStackTurns, stats.turns),
        percent(stats.largeStackTurns, stats.turns),
        percent(stats.concentration, stats.turns),
        stats.runawayAttacks,
        percent(stats.leaderAttacks, stats.runawayAttacks),
        stats.territoryTurns > 0
          ? ((100 * stats.attacksReceived) / stats.territoryTurns).toFixed(2)
          : 'n/a',
        percent(stats.bonusTurns, stats.turns),
      ].join('\t'),
    );
  }
  return lines.join('\n');
}
