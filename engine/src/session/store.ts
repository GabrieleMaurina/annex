import { endTakeover, startTakeover } from '../bots/takeover';
import { callbacks } from '../callbacks';
import {
  checkGameEnd,
  endAbandonedGame,
  HUMANS_ABANDONED_GRACE_MS,
} from '../game/end';
import { addHostCandidate, recomputeHost } from '../game/host';
import { assignRandomColor, maxTeam } from '../game/mechanics';
import { gameResultsStats, gameState, gameSummary } from '../game/state';
import { clearTurnTimer } from '../game/turns';
import { filterGameStateForViewer } from '../game/world/visibility';
import { Game, HOME_ROOM, Player } from '../types';
import { playersById } from './players';

export const games = new Map<string, Game>();

type BotTurnHook = (game: Game) => void;
let botTurnHook: BotTurnHook | null = null;
export function setBotTurnHook(hook: BotTurnHook): void {
  botTurnHook = hook;
}

const DESTROY_GRACE_MS = 5000;
const pendingInactiveDestroy = new Map<string, NodeJS.Timeout>();
const pendingEndedDestroy = new Map<string, NodeJS.Timeout>();
const pendingLobbyDestroy = new Map<string, NodeJS.Timeout>();
const pendingAbandonEnd = new Map<string, NodeJS.Timeout>();

function scheduleDestroy(
  pending: Map<string, NodeJS.Timeout>,
  gameName: string,
  check: () => void,
  grace = DESTROY_GRACE_MS,
) {
  if (pending.has(gameName)) return;
  const timer = setTimeout(() => {
    pending.delete(gameName);
    check();
  }, grace);
  pending.set(gameName, timer);
}

function hasActivePlayer(game: Game) {
  return game.playerIds.some((id) => {
    if (game.surrenderedIds.has(id)) return false;
    const member = playersById.get(id);
    return !member?.isBot && (member?.connected ?? false);
  });
}

function evictGameMembers(game: Game) {
  for (const id of [...game.playerIds, ...game.spectatorIds]) {
    const member = playersById.get(id);
    if (!member || member.gameName !== game.name) continue;
    member.gameName = null;
    callbacks.onRoomChanged(id, null);
  }
}

function hasActiveLobbyMember(game: Game) {
  return [...game.playerIds, ...game.spectatorIds].some((id) => {
    const member = playersById.get(id);
    return !member?.isBot && (member?.connected ?? false);
  });
}

function evictBotPlayers(game: Game) {
  for (const id of game.playerIds) {
    const member = playersById.get(id);
    if (member?.isBot) playersById.delete(id);
  }
}

export function destroyIfLobbyAbandoned(game: Game) {
  if (game.state !== 'lobby' || hasActiveLobbyMember(game)) return;

  scheduleDestroy(pendingLobbyDestroy, game.name, () => {
    const current = games.get(game.name);
    if (!current || current.state !== 'lobby' || hasActiveLobbyMember(current))
      return;

    games.delete(current.name);
    evictBotPlayers(current);
    evictGameMembers(current);
    broadcastHomeGames();
  });
}

export function destroyIfInactive(game: Game) {
  if (game.state !== 'playing' || hasActivePlayer(game)) return;

  scheduleDestroy(pendingInactiveDestroy, game.name, () => {
    const current = games.get(game.name);
    if (!current || current.state !== 'playing' || hasActivePlayer(current))
      return;

    clearTurnTimer(current.name);
    endAbandonedGame(current);
    games.delete(current.name);
    evictGameMembers(current);
    broadcastHomeGames();
  });
}

function hasEndedGameViewer(game: Game) {
  return [...game.playerIds, ...game.spectatorIds].some((id) => {
    const member = playersById.get(id);
    return !member?.isBot && member?.connected && member.gameName === game.name;
  });
}

export function destroyIfEnded(game: Game) {
  if (game.state !== 'ended' || hasEndedGameViewer(game)) return;

  scheduleDestroy(pendingEndedDestroy, game.name, () => {
    const current = games.get(game.name);
    if (!current || current.state !== 'ended' || hasEndedGameViewer(current))
      return;

    games.delete(current.name);
    evictGameMembers(current);
    broadcastHomeGames();
  });
}

export function scheduleAbandonEnd(game: Game) {
  if (game.state !== 'playing' || hasActivePlayer(game)) return;

  scheduleDestroy(
    pendingAbandonEnd,
    game.name,
    () => {
      const current = games.get(game.name);
      if (!current || current.state !== 'playing' || hasActivePlayer(current))
        return;

      checkGameEnd(current);
      const ended = games.get(game.name);
      if (ended && ended.state === 'ended') {
        broadcastGameState(ended);
        destroyIfEnded(ended);
      }
    },
    HUMANS_ABANDONED_GRACE_MS,
  );
}

export function removePlayerFromGame(game: Game, playerId: number) {
  const idx = game.playerIds.indexOf(playerId);
  game.playerIds = game.playerIds.filter((id) => id !== playerId);
  game.playerTeams.delete(playerId);
  game.playerColors.delete(playerId);

  if (
    idx !== -1 &&
    game.state === 'lobby' &&
    game.playerIds.length < game.slots &&
    game.spectatorIds.length > 0
  ) {
    const promotedId = game.spectatorIds.shift()!;
    game.playerIds.splice(idx, 0, promotedId);
    game.playerTeams.set(promotedId, 0);
    assignRandomColor(game, promotedId);
    addHostCandidate(game, promotedId);
  }

  if (game.playerIds.length === 0) {
    clearTurnTimer(game.name);
    games.delete(game.name);
    return;
  }

  const cap = maxTeam(game);
  for (const id of game.playerIds) {
    if ((game.playerTeams.get(id) ?? 0) > cap) game.playerTeams.set(id, 0);
  }

  recomputeHost(game);
}

function cementSubstitute(game: Game, ownerId: number): boolean {
  for (const [substituteId, owner] of game.substituteFor) {
    if (owner === ownerId) {
      game.substituteFor.delete(substituteId);
      return true;
    }
  }
  return false;
}

function handleLobbyDisconnect(game: Game, player: Player) {
  const playerId = player.id;
  const subIndex = game.spectatorIds.findIndex(
    (id) => playersById.get(id)?.connected,
  );
  if (subIndex === -1) {
    player.gameName = null;
    game.lobbyDeparted.set(playerId, {
      team: game.playerTeams.get(playerId) ?? 0,
      color: game.playerColors.get(playerId) ?? 0,
    });
    removePlayerFromGame(game, playerId);
    return;
  }

  const ownerId = game.substituteFor.get(playerId) ?? playerId;
  game.substituteFor.delete(playerId);

  const idx = game.playerIds.indexOf(playerId);
  const substituteId = game.spectatorIds.splice(subIndex, 1)[0];
  game.playerIds[idx] = substituteId;

  const team = game.playerTeams.get(playerId) ?? 0;
  game.playerTeams.set(substituteId, team);
  game.playerTeams.delete(playerId);

  const color = game.playerColors.get(playerId);
  if (color !== undefined) game.playerColors.set(substituteId, color);
  game.playerColors.delete(playerId);

  addHostCandidate(game, substituteId);
  game.substituteFor.set(substituteId, ownerId);
  recomputeHost(game);
}

export function reclaimSubstitutedSeat(game: Game, ownerId: number) {
  const entry = [...game.substituteFor.entries()].find(
    ([, owner]) => owner === ownerId,
  );
  if (!entry) return;

  const [substituteId] = entry;
  game.substituteFor.delete(substituteId);

  const idx = game.playerIds.indexOf(substituteId);
  if (idx === -1) return;

  game.playerIds[idx] = ownerId;
  game.playerTeams.delete(substituteId);
  game.playerColors.delete(substituteId);
  game.spectatorIds.unshift(substituteId);

  recomputeHost(game);
}

export function leaveGame(player: Player, permanent: boolean) {
  const gameName = player.gameName;
  leaveGameImpl(player, permanent);
  if (!gameName) return;
  broadcastHomeGames();
  const game = games.get(gameName);
  if (game) broadcastGameState(game);
}

function leaveGameImpl(player: Player, permanent: boolean) {
  if (!player.gameName) return;
  const game = games.get(player.gameName);
  if (!game) {
    player.gameName = null;
    return;
  }

  if (game.spectatorIds.includes(player.id)) {
    if (!permanent) {
      destroyIfLobbyAbandoned(game);
      return;
    }
    player.gameName = null;
    game.spectatorIds = game.spectatorIds.filter((id) => id !== player.id);
    if (game.state === 'ended') destroyIfEnded(game);
    destroyIfLobbyAbandoned(game);
    return;
  }

  if (game.state === 'playing') {
    if (game.surrenderedIds.has(player.id) && player.connected)
      player.gameName = null;
    else if (!player.connected) startTakeover(game, player);
    checkGameEnd(game);
    recomputeHost(game);
    scheduleAbandonEnd(game);
    destroyIfInactive(game);
    destroyIfEnded(game);
    return;
  }

  if (game.state === 'ended') {
    if (player.connected) player.gameName = null;
    destroyIfEnded(game);
    return;
  }

  if (!permanent) {
    if (game.playerIds.includes(player.id)) handleLobbyDisconnect(game, player);
    else recomputeHost(game);
    if (games.has(game.name)) destroyIfLobbyAbandoned(game);
    return;
  }

  player.gameName = null;
  if (!game.playerIds.includes(player.id)) {
    cementSubstitute(game, player.id);
    return;
  }
  removePlayerFromGame(game, player.id);
  if (games.has(game.name)) destroyIfLobbyAbandoned(game);
}

export function handleReconnect(player: Player) {
  if (!player.gameName) return;
  const game = games.get(player.gameName);
  if (!game) return;

  if (game.state === 'lobby') {
    reclaimSubstitutedSeat(game, player.id);
    if (
      !game.playerIds.includes(player.id) &&
      !game.spectatorIds.includes(player.id)
    )
      game.spectatorIds.push(player.id);
  }

  if (hasActivePlayer(game)) game.humansAbandonedAt = null;

  recomputeHost(game);
  sendGeneratedMapIfAny(game, player.id);
  broadcastHomeGames();
  broadcastGameState(game);
}

export function listGameSummaries() {
  return [...games.values()].map((game) => gameSummary(game));
}

export function playerGameName(playerId: number): string | null {
  return playersById.get(playerId)?.gameName ?? null;
}

export function playerGameState(playerId: number): Game['state'] | null {
  const name = playersById.get(playerId)?.gameName;
  if (!name) return null;
  return games.get(name)?.state ?? null;
}

export function broadcastHomeGames() {
  const summaries = listGameSummaries();
  for (const player of playersById.values()) {
    if (player.gameName === null && player.connected && !player.isBot)
      callbacks.onHomeGames(player.id, summaries);
  }
}

export function broadcastMissions(game: Game) {
  for (const [playerId, mission] of game.playerMissions) {
    callbacks.onMission(playerId, { mission });
  }
}

export function sendPlayerMission(game: Game, playerId: number) {
  const mission = game.playerMissions.get(playerId);
  if (mission) callbacks.onMission(playerId, { mission });
}

export function sendPlayerCards(game: Game, playerId: number) {
  callbacks.onCards(playerId, { cards: game.playerCards.get(playerId) ?? [] });
}

export function sendPlayerLogs(game: Game, playerId: number) {
  callbacks.onLogs(playerId, { entries: game.logs.get(playerId) ?? [] });
}

export function sendGameResults(game: Game, playerId: number) {
  callbacks.onResults(playerId, { stats: gameResultsStats(game) });
}

export function broadcastGameResults(game: Game) {
  for (const viewerId of [...game.playerIds, ...game.spectatorIds]) {
    sendGameResults(game, viewerId);
  }
}

export function sendGeneratedMapIfAny(game: Game, playerId: number) {
  if (!game.generatedMap) return;
  callbacks.onMapGenerated(playerId, {
    name: game.mapName,
    displayName: game.generatedMap.displayName,
    territories: game.generatedMap.territories,
    bonuses: game.generatedMap.bonuses,
    imageSrc: game.generatedMap.imageSrc,
  });
}

export function sendGameState(game: Game, playerId: number) {
  callbacks.onGameState(
    playerId,
    filterGameStateForViewer(gameState(game), game, playerId),
  );
}

export function broadcastGameState(game: Game) {
  const base = gameState(game);
  for (const viewerId of [...game.playerIds, ...game.spectatorIds]) {
    callbacks.onGameState(
      viewerId,
      filterGameStateForViewer(base, game, viewerId),
    );
  }
  botTurnHook?.(game);
}

export function broadcastGameStateExcept(game: Game, excludePlayerId: number) {
  const base = gameState(game);
  for (const viewerId of [...game.playerIds, ...game.spectatorIds]) {
    if (viewerId === excludePlayerId) continue;
    callbacks.onGameState(
      viewerId,
      filterGameStateForViewer(base, game, viewerId),
    );
  }
  botTurnHook?.(game);
}

export function broadcastSelected(game: Game, territoryId: number) {
  for (const viewerId of [...game.playerIds, ...game.spectatorIds]) {
    callbacks.onSelected(viewerId, { territoryId });
  }
}

export function respondGameState(
  game: Game,
  playerId: number,
): { ok: true; game: ReturnType<typeof gameState> } {
  const response = {
    ok: true as const,
    game: filterGameStateForViewer(gameState(game), game, playerId),
  };
  broadcastGameStateExcept(game, playerId);
  return response;
}

export function respondWithGameState(
  game: Game,
  playerId: number,
  callback: (response: {
    ok: true;
    game: ReturnType<typeof gameState>;
  }) => void,
) {
  callback({
    ok: true,
    game: filterGameStateForViewer(gameState(game), game, playerId),
  });
  broadcastGameStateExcept(game, playerId);
}

export function resyncPlayer(
  playerId: number,
  room: string,
): { id: number; gameName: string | null; name: string } {
  const player = playersById.get(playerId);
  if (!player) return { id: playerId, gameName: null, name: '' };
  player.connected = true;
  endTakeover(player);

  if (room !== (player.gameName ?? HOME_ROOM)) leaveGame(player, true);

  const game = player.gameName ? games.get(player.gameName) : undefined;
  if (game && game.playerIds.includes(player.id)) {
    if (game.state === 'playing') sendPlayerCards(game, player.id);
    if (game.state === 'playing' || game.state === 'ended')
      sendPlayerMission(game, player.id);
  }
  if (
    game &&
    (game.playerIds.includes(player.id) ||
      game.spectatorIds.includes(player.id)) &&
    (game.state === 'playing' || game.state === 'ended')
  ) {
    sendPlayerLogs(game, player.id);
  }
  if (
    game &&
    game.state === 'ended' &&
    (game.playerIds.includes(player.id) ||
      game.spectatorIds.includes(player.id))
  ) {
    sendGameResults(game, player.id);
  }

  handleReconnect(player);

  if (!player.gameName) callbacks.onHomeGames(player.id, listGameSummaries());

  return { id: player.id, gameName: player.gameName, name: player.name };
}

export function setName(playerId: number, name: string): void {
  const player = playersById.get(playerId);
  if (player) player.name = name;
}

export function disconnect(playerId: number): void {
  const player = playersById.get(playerId);
  if (!player) return;
  player.connected = false;
  leaveGame(player, false);
}
