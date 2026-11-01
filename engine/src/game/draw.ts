import { playersById } from '../session/players';
import { DrawReason, Game } from '../types';

export function isLobbyBot(id: number): boolean {
  return id < 0;
}

function isConnected(game: Game, id: number): boolean {
  const member = playersById.get(id);
  return !!member?.connected && member.gameName === game.name;
}

export function drawCandidateIds(game: Game): number[] {
  return game.playerIds.filter(
    (id) =>
      !game.deathOrder.includes(id) &&
      (isLobbyBot(id) || isConnected(game, id)),
  );
}

export function drawVoterIds(game: Game): number[] {
  return drawCandidateIds(game).filter((id) => !isLobbyBot(id));
}

export function drawOffersOpen(game: Game): boolean {
  return (
    game.state === 'playing' &&
    !game.earlyWin &&
    game.roundNumber + 1 >= game.drawOfferRound
  );
}

export function activeDrawVoteIds(game: Game): number[] {
  if (game.earlyWin) return [];
  return drawVoterIds(game).filter((id) => game.drawVoteIds.has(id));
}

export function drawAgreed(game: Game): boolean {
  if (!drawOffersOpen(game) || drawCandidateIds(game).length < 2) return false;
  const voterIds = drawVoterIds(game);
  return (
    voterIds.length > 0 && voterIds.every((id) => game.drawVoteIds.has(id))
  );
}

function playedMs(game: Game): number {
  const now = Date.now();
  const pausedNow =
    game.paused && game.pausedAt !== null ? now - game.pausedAt : 0;
  return now - (game.startedAt ?? now) - game.pausedMs - pausedNow;
}

export function stalemateReason(game: Game): DrawReason | null {
  if (game.roundNumber >= game.maxRounds) return 'max rounds';
  if (playedMs(game) >= game.maxDuration * 60_000) return 'max duration';
  return null;
}
