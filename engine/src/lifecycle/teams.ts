import { Game } from '../types';
import { isInteger } from '../util/validate';

const MIN_TEAMS = 2;
export const MIN_SLOTS = 2;
export const MAX_SLOTS = 20;

function teamSize(game: Game, team: number) {
  return game.playerIds.filter((id) => (game.playerTeams.get(id) ?? 0) === team)
    .length;
}

function emptySlots(game: Game, team: number) {
  return game.teamSlots[team] - teamSize(game, team);
}

export function hasRoom(game: Game, team: unknown): team is number {
  return (
    isInteger(team) &&
    team >= 0 &&
    team < game.teamSlots.length &&
    emptySlots(game, team) > 0
  );
}

export function openTeam(game: Game) {
  let best = -1;
  game.teamSlots.forEach((_, team) => {
    if (!hasRoom(game, team)) return;
    if (best === -1 || teamSize(game, team) < teamSize(game, best)) best = team;
  });
  return best;
}

export function resetTeams(game: Game) {
  if (game.gameMode !== 'team deathmatch') {
    game.teamSlots = [game.slots];
    game.playerIds.forEach((id) => game.playerTeams.set(id, 0));
    return;
  }
  game.teamSlots = [Math.ceil(game.slots / 2), Math.floor(game.slots / 2)];
  game.playerIds.forEach((id, i) => game.playerTeams.set(id, i % 2));
}

function spareSlots(game: Game, team: number) {
  return Math.min(emptySlots(game, team), game.teamSlots[team] - 1);
}

export function resizeTeams(game: Game, slots: number): boolean {
  if (game.gameMode !== 'team deathmatch') {
    game.teamSlots = [slots];
    return true;
  }
  const teams = game.teamSlots.map((_, team) => team);
  let total = game.teamSlots.reduce((sum, count) => sum + count, 0);
  const spare = teams.reduce((sum, team) => sum + spareSlots(game, team), 0);
  if (total - slots > spare) return false;
  for (; total < slots; total++) {
    const team = teams.reduce((a, b) =>
      game.teamSlots[b] < game.teamSlots[a] ? b : a,
    );
    game.teamSlots[team]++;
  }
  for (; total > slots; total--) {
    const team = teams.reduce((a, b) =>
      spareSlots(game, b) > spareSlots(game, a) ? b : a,
    );
    game.teamSlots[team]--;
  }
  return true;
}

export function setTeams(game: Game, teams: unknown): boolean {
  if (
    game.gameMode !== 'team deathmatch' ||
    !Array.isArray(teams) ||
    teams.length < MIN_TEAMS
  )
    return false;

  const seen = new Set<number>();
  let total = 0;
  for (const team of teams) {
    if (typeof team !== 'object' || team === null) return false;
    const { slots, playerIds } = team as Record<string, unknown>;
    if (
      !isInteger(slots) ||
      slots < 1 ||
      !Array.isArray(playerIds) ||
      playerIds.length > slots
    )
      return false;
    for (const id of playerIds) {
      if (!isInteger(id) || !game.playerIds.includes(id) || seen.has(id))
        return false;
      seen.add(id);
    }
    total += slots;
  }
  if (
    seen.size !== game.playerIds.length ||
    total < MIN_SLOTS ||
    total > MAX_SLOTS
  )
    return false;

  const layout = teams as { slots: number; playerIds: number[] }[];
  game.slots = total;
  game.teamSlots = layout.map((team) => team.slots);
  layout.forEach((team, index) =>
    team.playerIds.forEach((id) => game.playerTeams.set(id, index)),
  );
  return true;
}
