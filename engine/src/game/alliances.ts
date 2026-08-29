import { AllianceViewState, Game } from '../types';

export const ALLIANCE_REQUEST_TIMEOUT_MS = 60_000;
export const ALLIANCE_REQUEST_COOLDOWN_MS = 60_000;

export function pairKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function areAllied(game: Game, a: number, b: number): boolean {
  return game.allianceIds.has(pairKey(a, b));
}

function isTeammate(game: Game, a: number, b: number): boolean {
  return (
    game.gameMode === 'Team Deathmatch' &&
    a !== b &&
    (game.playerTeams.get(a) ?? 0) === (game.playerTeams.get(b) ?? 0)
  );
}

export function alliedIds(game: Game, playerId: number): Set<number> {
  const ids = new Set<number>();
  for (const otherId of game.playerIds) {
    if (otherId === playerId) continue;
    if (
      areAllied(game, playerId, otherId) ||
      isTeammate(game, playerId, otherId)
    )
      ids.add(otherId);
  }
  return ids;
}

export function emojiTargetAllowed(
  game: Game,
  senderId: number,
  targetId: number,
): boolean {
  if (game.gameMode !== 'Team Deathmatch' && game.alliances !== 'on')
    return true;
  return alliedIds(game, senderId).has(targetId);
}

export function allianceViewState(
  game: Game,
  viewerId: number,
  otherId: number,
): AllianceViewState {
  if (areAllied(game, viewerId, otherId)) return 'allied';
  const request = game.allianceRequests.get(pairKey(viewerId, otherId));
  if (request)
    return request.fromId === viewerId ? 'requestSent' : 'requestReceived';
  return 'none';
}

function directionalKey(fromId: number, toId: number): string {
  return `${fromId}->${toId}`;
}

export function startAllianceCooldown(
  game: Game,
  blockedFromId: number,
  towardId: number,
) {
  game.allianceCooldowns.set(
    directionalKey(blockedFromId, towardId),
    Date.now() + ALLIANCE_REQUEST_COOLDOWN_MS,
  );
}

export function allianceCooldownUntil(
  game: Game,
  fromId: number,
  toId: number,
): number | null {
  const until = game.allianceCooldowns.get(directionalKey(fromId, toId));
  if (until === undefined || until <= Date.now()) return null;
  return until;
}

export function allianceStatesForViewer(
  game: Game,
  viewerId: number,
): { playerId: number; state: AllianceViewState; cooldownUntil?: number }[] {
  if (!game.playerIds.includes(viewerId)) return [];
  return game.playerIds
    .filter((id) => id !== viewerId)
    .map((id) => {
      const state = allianceViewState(game, viewerId, id);
      const cooldownUntil =
        state === 'none' ? allianceCooldownUntil(game, viewerId, id) : null;
      return {
        playerId: id,
        state,
        ...(cooldownUntil !== null ? { cooldownUntil } : {}),
      };
    });
}

export function createAllianceRequest(
  game: Game,
  fromId: number,
  toId: number,
) {
  game.allianceRequests.set(pairKey(fromId, toId), { fromId, toId });
}

export function removeAllianceRequest(game: Game, a: number, b: number) {
  game.allianceRequests.delete(pairKey(a, b));
  clearAllianceRequestTimer(game.name, a, b);
}

export function formAlliance(game: Game, initiatorId: number, otherId: number) {
  game.allianceIds.add(pairKey(initiatorId, otherId));
  game.allianceInitiators.set(pairKey(initiatorId, otherId), initiatorId);
}

export function allianceInitiator(
  game: Game,
  a: number,
  b: number,
): number | undefined {
  return game.allianceInitiators.get(pairKey(a, b));
}

export function breakAlliance(game: Game, a: number, b: number) {
  game.allianceIds.delete(pairKey(a, b));
  game.allianceInitiators.delete(pairKey(a, b));
}

const requestTimers = new Map<string, NodeJS.Timeout>();

function timerKey(gameName: string, a: number, b: number): string {
  return `${gameName}:${pairKey(a, b)}`;
}

export function clearAllianceRequestTimer(
  gameName: string,
  a: number,
  b: number,
) {
  const key = timerKey(gameName, a, b);
  const timer = requestTimers.get(key);
  if (timer) clearTimeout(timer);
  requestTimers.delete(key);
}

export function scheduleAllianceRequestExpiry(
  game: Game,
  fromId: number,
  toId: number,
  onExpire: () => void,
) {
  const key = timerKey(game.name, fromId, toId);
  const timer = setTimeout(() => {
    requestTimers.delete(key);
    onExpire();
  }, ALLIANCE_REQUEST_TIMEOUT_MS);
  requestTimers.set(key, timer);
}
