import { Game } from '../../types';

export function isTeammate(game: Game, a: number, b: number): boolean {
  return (
    game.gameMode === 'Team Deathmatch' &&
    a !== b &&
    (game.playerTeams.get(a) ?? 0) === (game.playerTeams.get(b) ?? 0)
  );
}
