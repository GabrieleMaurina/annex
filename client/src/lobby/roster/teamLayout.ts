export const MIN_SLOTS = 2;
export const MAX_SLOTS = 20;

export type TeamLayout = { slots: number; playerIds: number[] }[];

interface TeamsState {
  teamSlots: number[];
  players: { id: number; team: number }[];
}

export function teamLayout(game: TeamsState): TeamLayout {
  return game.teamSlots.map((slots, team) => ({
    slots,
    playerIds: game.players.filter((p) => p.team === team).map((p) => p.id),
  }));
}

export function moveToTeam(
  game: TeamsState,
  playerId: number,
  team: number,
): TeamLayout {
  const layout = teamLayout(game);
  const from = layout.find((t) => t.playerIds.includes(playerId))!;
  const to = layout[team];
  from.playerIds = from.playerIds.filter((id) => id !== playerId);
  if (to.playerIds.length >= to.slots) {
    if (from.slots > 1) from.slots--;
    to.slots++;
  }
  to.playerIds.push(playerId);
  return layout;
}
