import { Server, Socket } from 'socket.io';
import { defaultMapName, maps } from './maps';
import {
  CardsMode,
  DiceRandomness,
  Game,
  GameMode,
  HOME_ROOM,
  Player,
  TurnDuration,
} from './types';

const games = new Map<string, Game>();

const MAX_GAME_NAME_LENGTH = 20;
const COLOR_COUNT = 20;

const GAME_MODE_VALUES: GameMode[] = [
  'World Domination',
  'Capital Conquest',
  'Team Deathmatch',
];
const DICE_RANDOMNESS_VALUES: DiceRandomness[] = ['Balanced', 'True'];
const DEFENCE_DICE_VALUES = [2, 3];
const CARDS_VALUES: CardsMode[] = ['Fixed', 'Progressive', 'Exponential'];
const TURN_DURATION_VALUES: TurnDuration[] = [60, 90, 120, 150, 180, 300];

interface GameSettings {
  name?: string;
  mapName?: string;
  slots?: number;
  bannedPlayerIds?: number[];
  playerTeam?: { playerId: number; team: number };
  gameMode?: GameMode;
  diceRandomness?: DiceRandomness;
  defenceDice?: 2 | 3;
  cards?: CardsMode;
  turnDuration?: TurnDuration;
}

type GameResponse =
  | { ok: true; game: ReturnType<typeof gameState> }
  | { ok: false; error: string };

export function gameRoomName(name: string): string {
  return `game-${name}`;
}

function gameSummary(game: Game) {
  return {
    name: game.name,
    mapName: game.mapName,
    playerCount: game.playerIds.length,
    slots: game.slots,
    phase: game.phase,
    spectatorCount: game.spectatorIds.length,
  };
}

function toSummaries(ids: number[], playersById: Map<number, Player>) {
  return ids
    .map((id) => playersById.get(id))
    .filter((player): player is Player => !!player)
    .map((player) => ({ id: player.id, name: player.name }));
}

function maxTeam(game: Game) {
  return Math.max(0, game.playerIds.length - 2);
}

function colorBound(game: Game) {
  return Math.min(COLOR_COUNT, game.playerIds.length + 3);
}

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function assignTerritories(game: Game) {
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

    let remainingTroops = count * 3 - count;
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

function territoryStats(game: Game) {
  const stats = new Map<
    number,
    { territoryCount: number; troopCount: number }
  >();
  for (const [territoryId, ownerId] of game.territoryOwners) {
    const entry = stats.get(ownerId) ?? { territoryCount: 0, troopCount: 0 };
    entry.territoryCount++;
    entry.troopCount += game.territoryTroops.get(territoryId) ?? 0;
    stats.set(ownerId, entry);
  }
  return stats;
}

function assignRandomColor(game: Game, playerId: number) {
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

function cycleColor(game: Game, playerId: number) {
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

function gameState(game: Game, playersById: Map<number, Player>) {
  const stats = territoryStats(game);
  return {
    name: game.name,
    mapName: game.mapName,
    slots: game.slots,
    hostId: game.hostId,
    phase: game.phase,
    gameMode: game.gameMode,
    diceRandomness: game.diceRandomness,
    defenceDice: game.defenceDice,
    cards: game.cards,
    turnDuration: game.turnDuration,
    players: toSummaries(game.playerIds, playersById).map((player) => ({
      ...player,
      team: game.playerTeams.get(player.id) ?? 0,
      color: game.playerColors.get(player.id) ?? 0,
      territoryCount: stats.get(player.id)?.territoryCount ?? 0,
      troopCount: stats.get(player.id)?.troopCount ?? 0,
    })),
    spectators: toSummaries(game.spectatorIds, playersById),
    bannedPlayers: toSummaries([...game.bannedIds], playersById),
    territories: [...game.territoryOwners.entries()].map(([id, ownerId]) => ({
      id,
      ownerId,
      troops: game.territoryTroops.get(id) ?? 0,
    })),
  };
}

function removePlayerFromGame(game: Game, playerId: number) {
  game.playerIds = game.playerIds.filter((id) => id !== playerId);
  game.playerTeams.delete(playerId);
  game.playerColors.delete(playerId);

  if (
    game.phase === 'lobby' &&
    game.playerIds.length < game.slots &&
    game.spectatorIds.length > 0
  ) {
    const promotedId = game.spectatorIds.shift()!;
    game.playerIds.push(promotedId);
    game.playerTeams.set(promotedId, 0);
    assignRandomColor(game, promotedId);
  }

  if (game.playerIds.length === 0) {
    games.delete(game.name);
    return;
  }

  if (game.hostId === playerId) {
    game.hostId = game.playerIds[0];
  }

  const cap = maxTeam(game);
  for (const id of game.playerIds) {
    if ((game.playerTeams.get(id) ?? 0) > cap) game.playerTeams.set(id, 0);
  }
}

export function leaveGame(player: Player) {
  if (!player.gameName) return;
  const game = games.get(player.gameName);
  player.gameName = null;
  if (!game) return;

  if (game.spectatorIds.includes(player.id)) {
    game.spectatorIds = game.spectatorIds.filter((id) => id !== player.id);
    return;
  }
  removePlayerFromGame(game, player.id);
}

export function listGameSummaries() {
  return [...games.values()].map(gameSummary);
}

export function broadcastGameStates(
  io: Server,
  playersById: Map<number, Player>,
) {
  for (const game of games.values()) {
    io.to(gameRoomName(game.name)).emit(
      'game:state',
      gameState(game, playersById),
    );
  }
}

export function registerGameHandlers(
  io: Server,
  socket: Socket,
  playersBySocket: Map<string, Player>,
  playersById: Map<number, Player>,
) {
  socket.on('game:create', (callback: (response: GameResponse) => void) => {
    const player = playersBySocket.get(socket.id);
    if (!player) return callback({ ok: false, error: 'not identified' });
    if (player.gameName)
      return callback({ ok: false, error: 'already in a game' });

    const name = `Game with ${player.name}`;
    if (games.has(name))
      return callback({ ok: false, error: 'game name already in use' });

    const game: Game = {
      name,
      mapName: defaultMapName,
      slots: 2,
      hostId: player.id,
      phase: 'lobby',
      gameMode: 'World Domination',
      diceRandomness: 'Balanced',
      defenceDice: 2,
      cards: 'Fixed',
      turnDuration: 120,
      playerIds: [player.id],
      spectatorIds: [],
      playerTeams: new Map([[player.id, 0]]),
      playerColors: new Map(),
      bannedIds: new Set(),
      territoryOwners: new Map(),
      territoryTroops: new Map(),
    };
    games.set(game.name, game);
    player.gameName = game.name;
    assignRandomColor(game, player.id);

    socket.leave(HOME_ROOM);
    socket.join(gameRoomName(game.name));
    callback({ ok: true, game: gameState(game, playersById) });
  });

  socket.on(
    'game:join',
    (
      { gameName }: { gameName: string },
      callback: (response: GameResponse) => void,
    ) => {
      const player = playersBySocket.get(socket.id);
      if (!player) return callback({ ok: false, error: 'not identified' });
      if (player.gameName)
        return callback({ ok: false, error: 'already in a game' });

      const game = games.get(gameName);
      if (!game) return callback({ ok: false, error: 'game not found' });
      if (game.bannedIds.has(player.id))
        return callback({ ok: false, error: 'banned from this game' });

      if (game.phase === 'lobby' && game.playerIds.length < game.slots) {
        game.playerIds.push(player.id);
        game.playerTeams.set(player.id, 0);
        assignRandomColor(game, player.id);
      } else {
        game.spectatorIds.push(player.id);
      }
      player.gameName = game.name;

      socket.leave(HOME_ROOM);
      socket.join(gameRoomName(game.name));
      callback({ ok: true, game: gameState(game, playersById) });
    },
  );

  socket.on(
    'game:settings',
    (settings: GameSettings, callback: (response: GameResponse) => void) => {
      const player = playersBySocket.get(socket.id);
      if (!player || !player.gameName)
        return callback({ ok: false, error: 'not in a game' });

      const game = games.get(player.gameName);
      if (!game) return callback({ ok: false, error: 'game not found' });
      if (game.hostId !== player.id)
        return callback({ ok: false, error: 'not the host' });

      if (settings.mapName !== undefined) {
        if (!maps.has(settings.mapName))
          return callback({ ok: false, error: 'invalid map' });
        game.mapName = settings.mapName;
      }

      if (settings.gameMode !== undefined) {
        if (!GAME_MODE_VALUES.includes(settings.gameMode))
          return callback({ ok: false, error: 'invalid game mode' });
        game.gameMode = settings.gameMode;
      }

      if (settings.name !== undefined) {
        const trimmedName = settings.name.trim();
        if (!trimmedName || trimmedName.length > MAX_GAME_NAME_LENGTH)
          return callback({ ok: false, error: 'invalid name' });

        if (trimmedName !== game.name) {
          if (games.has(trimmedName))
            return callback({ ok: false, error: 'game name already in use' });

          const oldRoom = gameRoomName(game.name);
          const newRoom = gameRoomName(trimmedName);
          games.delete(game.name);
          for (const id of [...game.playerIds, ...game.spectatorIds]) {
            const member = playersById.get(id);
            if (member) member.gameName = trimmedName;
            const memberSocket =
              member && io.sockets.sockets.get(member.socketId);
            memberSocket?.leave(oldRoom);
            memberSocket?.join(newRoom);
          }
          game.name = trimmedName;
          games.set(game.name, game);
        }
      }

      if (settings.bannedPlayerIds !== undefined) {
        const newBannedIds = new Set(
          settings.bannedPlayerIds.filter((id) => id !== player.id),
        );

        for (const id of newBannedIds) {
          if (game.bannedIds.has(id)) continue;
          const isPlayer = game.playerIds.includes(id);
          const isSpectator = game.spectatorIds.includes(id);
          if (!isPlayer && !isSpectator) continue;

          const kicked = playersById.get(id);
          if (!kicked) continue;
          kicked.gameName = null;
          const kickedSocket = io.sockets.sockets.get(kicked.socketId);
          kickedSocket?.leave(gameRoomName(game.name));
          kickedSocket?.join(HOME_ROOM);
          kickedSocket?.emit('game:kicked', { gameName: game.name });

          if (isPlayer) {
            removePlayerFromGame(game, id);
          } else {
            game.spectatorIds = game.spectatorIds.filter((s) => s !== id);
          }
        }

        game.bannedIds = newBannedIds;
      }

      if (settings.playerTeam !== undefined) {
        const { playerId, team } = settings.playerTeam;
        if (
          !game.playerIds.includes(playerId) ||
          !Number.isInteger(team) ||
          team < 0 ||
          team > maxTeam(game)
        ) {
          return callback({ ok: false, error: 'invalid team' });
        }
        game.playerTeams.set(playerId, team);
      }

      if (settings.slots !== undefined) {
        if (
          !Number.isFinite(settings.slots) ||
          settings.slots < 2 ||
          settings.slots < game.playerIds.length ||
          settings.slots > 20
        ) {
          return callback({ ok: false, error: 'invalid slots' });
        }
        game.slots = settings.slots;
      }

      if (settings.diceRandomness !== undefined) {
        if (!DICE_RANDOMNESS_VALUES.includes(settings.diceRandomness))
          return callback({ ok: false, error: 'invalid dice randomness' });
        game.diceRandomness = settings.diceRandomness;
      }

      if (settings.defenceDice !== undefined) {
        if (!DEFENCE_DICE_VALUES.includes(settings.defenceDice))
          return callback({ ok: false, error: 'invalid defence dice' });
        game.defenceDice = settings.defenceDice;
      }

      if (settings.cards !== undefined) {
        if (!CARDS_VALUES.includes(settings.cards))
          return callback({ ok: false, error: 'invalid cards' });
        game.cards = settings.cards;
      }

      if (settings.turnDuration !== undefined) {
        if (!TURN_DURATION_VALUES.includes(settings.turnDuration))
          return callback({ ok: false, error: 'invalid turn duration' });
        game.turnDuration = settings.turnDuration;
      }

      callback({ ok: true, game: gameState(game, playersById) });
    },
  );

  socket.on('game:start', (callback: (response: GameResponse) => void) => {
    const player = playersBySocket.get(socket.id);
    if (!player || !player.gameName)
      return callback({ ok: false, error: 'not in a game' });

    const game = games.get(player.gameName);
    if (!game) return callback({ ok: false, error: 'game not found' });
    if (game.hostId !== player.id)
      return callback({ ok: false, error: 'not the host' });
    if (game.phase !== 'lobby')
      return callback({ ok: false, error: 'already started' });
    if (game.playerIds.length < 2)
      return callback({ ok: false, error: 'not enough players' });

    game.playerIds = shuffle(game.playerIds);
    assignTerritories(game);
    game.phase = 'playing';
    callback({ ok: true, game: gameState(game, playersById) });
  });

  socket.on('game:cycleColor', (callback: (response: GameResponse) => void) => {
    const player = playersBySocket.get(socket.id);
    if (!player || !player.gameName)
      return callback({ ok: false, error: 'not in a game' });

    const game = games.get(player.gameName);
    if (!game) return callback({ ok: false, error: 'game not found' });
    if (!game.playerIds.includes(player.id))
      return callback({ ok: false, error: 'not a player' });
    if (game.phase !== 'lobby')
      return callback({ ok: false, error: 'game already started' });

    cycleColor(game, player.id);
    callback({ ok: true, game: gameState(game, playersById) });
  });

  socket.on('game:chat', ({ message }: { message: string }) => {
    const player = playersBySocket.get(socket.id);
    if (!player || !player.gameName) return;

    const game = games.get(player.gameName);
    if (!game) return;

    if (typeof message !== 'string') return;
    const trimmed = message.trim();
    if (!trimmed) return;

    const payload = { id: player.id, name: player.name, message: trimmed };
    io.to(gameRoomName(game.name)).emit('game:chatMessage', payload);
  });
}
