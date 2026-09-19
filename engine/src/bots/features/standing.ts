import { Game } from '../../types';
import { BotView } from '../view';

export type StandingRegime = 'duel' | 'triad' | 'multi';

export interface Standing {
  gangUp: number;
  preference: Map<number, number>;
}

const STANCE_SHIFT_START = 100;
const STANCE_SHIFT_END = 150;
const TROOP_STRENGTH = 0.5;
const BONUS_STRENGTH = 3;
const TRIAD_SIDES = 3;
const MULTI_MIN_SIDES = 4;

export function playerStrengths(
  owners: Map<number, number>,
  troops: Map<number, number>,
  continentTerritories: Map<number, number[]>,
  bonuses: number[],
  visible: Set<number> | null = null,
): Map<number, number> {
  const strengths = new Map<number, number>();
  const add = (playerId: number, amount: number) =>
    strengths.set(playerId, (strengths.get(playerId) ?? 0) + amount);
  const ownerAt = (territoryId: number) =>
    visible === null || visible.has(territoryId)
      ? owners.get(territoryId)
      : undefined;

  for (const [id, ownerId] of owners) {
    if (visible !== null && !visible.has(id)) continue;
    add(ownerId, 1 + TROOP_STRENGTH * (troops.get(id) ?? 0));
  }
  for (const [continentId, ids] of continentTerritories) {
    const first = ownerAt(ids[0]);
    if (first === undefined) continue;
    if (ids.every((id) => ownerAt(id) === first))
      add(first, BONUS_STRENGTH * (bonuses[continentId] ?? 0));
  }
  return strengths;
}

function weaknessBalance(mean: number, strength: number): number {
  const total = mean + strength;
  return total > 0 ? (mean - strength) / total : 0;
}

function regimeFor(sideCount: number): StandingRegime {
  if (sideCount >= MULTI_MIN_SIDES) return 'multi';
  return sideCount === TRIAD_SIDES ? 'triad' : 'duel';
}

function targetStance(
  game: Game,
  regime: StandingRegime,
  botIsLeader: boolean,
): number {
  if (regime === 'duel') return botIsLeader ? 1 : -1;
  if (regime !== 'triad' || botIsLeader) return 1;
  const progress =
    (game.roundNumber - STANCE_SHIFT_START) /
    (STANCE_SHIFT_END - STANCE_SHIFT_START);
  return Math.min(1, Math.max(-1, 2 * progress - 1));
}

export function antiLeaderActive(standing: Standing): boolean {
  return standing.gangUp > 0;
}

export function buildStanding(
  game: Game,
  view: BotView,
  botId: number,
  friendlyIds: Set<number>,
  continentTerritories: Map<number, number[]>,
  bonuses: number[],
): Standing {
  const teamMode = game.gameMode === 'Team Deathmatch';
  const sideOf = (playerId: number) =>
    teamMode ? (game.playerTeams.get(playerId) ?? 0) : playerId;
  const dead = new Set(game.deathOrder);
  const alivePlayers = game.playerIds.filter((id) => !dead.has(id));
  const aliveSides = new Set(alivePlayers.map(sideOf));
  const regime = regimeFor(aliveSides.size);
  const botSide = sideOf(botId);

  const strengths = playerStrengths(
    game.territoryOwners,
    game.territoryTroops,
    continentTerritories,
    bonuses,
    view.visibleIds,
  );
  const sideStrength = new Map<number, number>();
  for (const id of alivePlayers) {
    const strength = strengths.get(id);
    if (strength === undefined) continue;
    const side = sideOf(id);
    sideStrength.set(side, (sideStrength.get(side) ?? 0) + strength);
  }

  const standing: Standing = {
    gangUp: Math.max(0, -targetStance(game, regime, false)),
    preference: new Map(),
  };
  if (!aliveSides.has(botSide) || !sideStrength.has(botSide)) return standing;

  const botStrength = sideStrength.get(botSide)!;
  const friendSides = new Set([botSide, ...[...friendlyIds].map(sideOf)]);
  let strongestOther = 0;
  let targetTotal = 0;
  let targetCount = 0;
  for (const [side, strength] of sideStrength) {
    if (side === botSide) continue;
    if (strength > strongestOther) strongestOther = strength;
    if (friendSides.has(side)) continue;
    targetTotal += strength;
    targetCount++;
  }
  const stance = targetStance(game, regime, botStrength >= strongestOther);
  standing.gangUp = Math.max(0, -stance);

  if (regime === 'duel') {
    if (stance > 0)
      for (const id of alivePlayers)
        if (!friendSides.has(sideOf(id))) standing.preference.set(id, 1);
    return standing;
  }
  if (targetCount < 2) return standing;

  const mean = targetTotal / targetCount;
  for (const id of alivePlayers) {
    const side = sideOf(id);
    const strength = sideStrength.get(side);
    if (strength === undefined || friendSides.has(side)) continue;
    standing.preference.set(id, stance * weaknessBalance(mean, strength));
  }
  return standing;
}

export function targetPreference(
  standing: Standing,
  playerId: number | undefined,
): number {
  if (playerId === undefined) return 0;
  return standing.preference.get(playerId) ?? 0;
}
