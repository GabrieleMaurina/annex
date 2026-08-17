import { Server, Socket } from 'socket.io';
import { defaultMapName, maps } from '../maps';
import {
  CardsMode,
  DefenceDice,
  DiceRandomness,
  Game,
  GameMode,
  HOME_ROOM,
  Player,
  TurnDuration,
} from '../types';
import { addHostCandidate, recomputeHost } from './host';
import {
  assignRandomColor,
  assignTerritories,
  compactTeams,
  cycleColor,
  interleaveTeams,
  maxTeam,
  shuffle,
  teamCount,
} from './mechanics';
import { gameState } from './state';
import {
  destroyIfInactive,
  gameRoomName,
  games,
  removePlayerFromGame,
} from './store';
import { advanceTurnPhase, startTurns } from './turns';

const MAX_GAME_NAME_LENGTH = 20;

const GAME_MODE_VALUES: GameMode[] = [
  'World Domination',
  'Capital Conquest',
  'Team Deathmatch',
];
const DICE_RANDOMNESS_VALUES: DiceRandomness[] = ['Balanced', 'True'];
const DEFENCE_DICE_VALUES: DefenceDice[] = [2, 3];
const CARDS_VALUES: CardsMode[] = ['Fixed', 'Progressive', 'Exponential'];
const TURN_DURATION_VALUES: TurnDuration[] = [60, 90, 120, 150, 180, 300];

function validateGameName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (
    !trimmed ||
    trimmed.length > MAX_GAME_NAME_LENGTH ||
    trimmed === HOME_ROOM
  )
    return null;
  return trimmed;
}

interface GameSettings {
  name?: string;
  mapName?: string;
  slots?: number;
  bannedPlayerIds?: number[];
  playerTeam?: { playerId: number; team: number };
  gameMode?: GameMode;
  diceRandomness?: DiceRandomness;
  defenceDice?: DefenceDice;
  cards?: CardsMode;
  turnDuration?: TurnDuration;
}

type GameResponse =
  | { ok: true; game: ReturnType<typeof gameState> }
  | { ok: false; error: string };

export function registerGameHandlers(
  io: Server,
  socket: Socket,
  playersBySocket: Map<string, Player>,
  playersById: Map<number, Player>,
) {
  socket.on(
    'game:create',
    (
      settings: { name?: string },
      callback: (response: GameResponse) => void,
    ) => {
      if (typeof callback !== 'function') return;
      const player = playersBySocket.get(socket.id);
      if (!player) return callback({ ok: false, error: 'not identified' });
      if (player.gameName)
        return callback({ ok: false, error: 'already in a game' });

      let name = `Game with ${player.name}`;
      if (settings.name !== undefined) {
        const trimmedName = validateGameName(settings.name);
        if (!trimmedName) return callback({ ok: false, error: 'invalid name' });
        name = trimmedName;
      }

      if (games.has(name))
        return callback({ ok: false, error: 'game name already in use' });

      const game: Game = {
        name,
        mapName: defaultMapName,
        slots: 2,
        hostId: player.id,
        state: 'lobby',
        gameMode: 'World Domination',
        diceRandomness: 'Balanced',
        defenceDice: 2,
        cards: 'Fixed',
        turnDuration: 120,
        turnNumber: 0,
        turnPlayerIndex: 0,
        turnPhase: 'deploy',
        troopsToDeploy: 0,
        turnStartedAt: 0,
        selectedTerritoryId: null,
        fortifyStartTerritoryId: null,
        fortifyEndTerritoryId: null,
        playerIds: [player.id],
        spectatorIds: [],
        playerTeams: new Map([[player.id, 0]]),
        playerColors: new Map(),
        bannedIds: new Set(),
        territoryOwners: new Map(),
        territoryTroops: new Map(),
        hostPriority: [player.id],
        surrenderedIds: new Set(),
      };
      games.set(game.name, game);
      player.gameName = game.name;
      assignRandomColor(game, player.id);

      socket.leave(HOME_ROOM);
      socket.join(gameRoomName(game.name));
      callback({ ok: true, game: gameState(game, playersById) });
    },
  );

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

      if (game.state === 'lobby' && game.playerIds.length < game.slots) {
        game.playerIds.push(player.id);
        game.playerTeams.set(player.id, 0);
        assignRandomColor(game, player.id);
        addHostCandidate(game, player.id);
        recomputeHost(game, playersById);
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
      if (game.state !== 'lobby')
        return callback({ ok: false, error: 'game already started' });

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
        const trimmedName = validateGameName(settings.name);
        if (!trimmedName) return callback({ ok: false, error: 'invalid name' });

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
        if (!Array.isArray(settings.bannedPlayerIds))
          return callback({ ok: false, error: 'invalid banned players' });

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
            removePlayerFromGame(game, id, playersById);
          } else {
            game.spectatorIds = game.spectatorIds.filter((s) => s !== id);
          }
        }

        game.bannedIds = newBannedIds;
      }

      if (settings.playerTeam !== undefined) {
        if (
          typeof settings.playerTeam !== 'object' ||
          settings.playerTeam === null
        )
          return callback({ ok: false, error: 'invalid team' });

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
          !Number.isInteger(settings.slots) ||
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
    if (game.state !== 'lobby')
      return callback({ ok: false, error: 'already started' });
    if (game.playerIds.length < 2)
      return callback({ ok: false, error: 'not enough players' });
    if (game.gameMode === 'Team Deathmatch' && teamCount(game) < 2)
      return callback({ ok: false, error: 'not enough teams' });

    if (game.gameMode === 'Team Deathmatch') {
      compactTeams(game);
      game.playerIds = interleaveTeams(game);
    } else {
      game.playerIds = shuffle(game.playerIds);
    }
    assignTerritories(game);
    game.state = 'playing';
    startTurns(game);
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
    if (game.state !== 'lobby')
      return callback({ ok: false, error: 'game already started' });

    cycleColor(game, player.id);
    callback({ ok: true, game: gameState(game, playersById) });
  });

  socket.on('game:nextPhase', (callback: (response: GameResponse) => void) => {
    const player = playersBySocket.get(socket.id);
    if (!player || !player.gameName)
      return callback({ ok: false, error: 'not in a game' });

    const game = games.get(player.gameName);
    if (!game) return callback({ ok: false, error: 'game not found' });
    if (game.state !== 'playing')
      return callback({ ok: false, error: 'game not started' });
    if (game.playerIds[game.turnPlayerIndex] !== player.id)
      return callback({ ok: false, error: 'not your turn' });
    if (game.turnPhase === 'deploy')
      return callback({ ok: false, error: 'cannot skip deploy phase' });

    advanceTurnPhase(game);
    callback({ ok: true, game: gameState(game, playersById) });
  });

  socket.on('game:surrender', (callback: (response: GameResponse) => void) => {
    const player = playersBySocket.get(socket.id);
    if (!player || !player.gameName)
      return callback({ ok: false, error: 'not in a game' });

    const game = games.get(player.gameName);
    if (!game) return callback({ ok: false, error: 'game not found' });
    if (game.state !== 'playing')
      return callback({ ok: false, error: 'game not started' });
    if (!game.playerIds.includes(player.id))
      return callback({ ok: false, error: 'not a player' });

    game.surrenderedIds.add(player.id);
    player.gameName = null;
    socket.leave(gameRoomName(game.name));
    socket.join(HOME_ROOM);
    recomputeHost(game, playersById);
    destroyIfInactive(game, playersById, io);

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
