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

function capitalOwnersKey(game: Game): string {
  return [...game.capitalTerritoryIds]
    .sort((a, b) => a - b)
    .map((id) => `${id}:${game.territoryOwners.get(id) ?? ''}`)
    .join(',');
}

export function trackCapitalOwners(
  game: Game,
  roundNumber: number,
  turnPlayerIndex: number,
): void {
  if (game.gameMode !== 'capitals') return;
  const key = capitalOwnersKey(game);
  if (key === game.capitalOwnersKey) return;
  game.capitalOwnersKey = key;
  game.capitalStandoffStart = { roundNumber, turnPlayerIndex };
}

function capitalStandoffTurnsLeft(
  game: Game,
  turnPlayerIndex: number,
): number | null {
  const start = game.capitalStandoffStart;
  if (start === null) return null;
  const seats = game.playerIds.length;
  const endTurn =
    (start.roundNumber + game.capitalStandoff) * seats + start.turnPlayerIndex;
  return endTurn - (game.roundNumber * seats + turnPlayerIndex);
}

export function capitalStandoffRoundsLeft(game: Game): number | null {
  if (game.state !== 'playing') return null;
  const turnsLeft = capitalStandoffTurnsLeft(game, game.turnPlayerIndex);
  return turnsLeft === null
    ? null
    : Math.ceil(turnsLeft / game.playerIds.length);
}

export function stalemateReason(
  game: Game,
  nextTurnPlayerIndex: number,
): DrawReason | null {
  if (game.roundNumber >= game.maxRounds) return 'max rounds';
  if (playedMs(game) >= game.maxDuration * 60_000) return 'max duration';
  const standoffTurnsLeft = capitalStandoffTurnsLeft(game, nextTurnPlayerIndex);
  if (standoffTurnsLeft !== null && standoffTurnsLeft <= 0)
    return 'capital standoff';
  return null;
}
