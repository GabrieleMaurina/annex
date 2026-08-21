import { Server, Socket } from 'socket.io';
import { defaultMapName, maps } from '../../maps';
import {
  Blitz,
  CardsMode,
  DefenceDice,
  Game,
  GameMode,
  HOME_ROOM,
  Player,
  TurnDuration,
} from '../../types';
import { isInteger, isObject } from '../../validate';
import { buildCardDeck } from '../logic/cards';
import { checkGameEnd } from '../logic/end';
import { addHostCandidate, recomputeHost } from '../logic/host';
import {
  assignRandomColor,
  assignTerritories,
  compactTeams,
  cycleColor,
  interleaveTeams,
  maxTeam,
  ownsAnyTerritory,
  shuffle,
  teamCount,
} from '../logic/mechanics';
import { snapshotTerritories } from '../logic/replay';
import { gameState } from '../logic/state';
import { emptyPlayerStats } from '../logic/stats';
import {
  destroyIfInactive,
  gameRoomName,
  games,
  removePlayerFromGame,
} from '../logic/store';
import {
  advanceTurnPhase,
  forceEndTurn,
  pauseTurnTimer,
  resumeTurnTimer,
  startCapitalPlacement,
  startTurns,
} from '../logic/turns';

const MAX_GAME_NAME_LENGTH = 20;

const GAME_MODE_VALUES: GameMode[] = [
  'Supremacy',
  'Capitals',
  'Team Deathmatch',
];
const BLITZ_VALUES: Blitz[] = ['Balanced', 'True'];
const DEFENCE_DICE_VALUES: DefenceDice[] = [2, 3];
const CARDS_VALUES: CardsMode[] = ['Constant', 'Linear', 'Exponential'];
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
    (data: unknown, callback: (response: GameResponse) => void) => {
      if (typeof callback !== 'function') return;
      const player = playersBySocket.get(socket.id);
      if (!player) return callback({ ok: false, error: 'not identified' });
      if (player.gameName)
        return callback({ ok: false, error: 'already in a game' });

      const settings: Record<string, unknown> = isObject(data) ? data : {};

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
        gameMode: 'Supremacy',
        blitz: 'Balanced',
        defenceDice: 2,
        cards: 'Constant',
        turnDuration: 120,
        turnNumber: 0,
        turnPlayerIndex: 0,
        turnPhase: 'deploy',
        troopsToDeploy: 0,
        turnStartedAt: 0,
        paused: false,
        pausedAt: null,
        selectedTerritoryId: null,
        fortifyStartTerritoryId: null,
        fortifyEndTerritoryId: null,
        attackStartTerritoryId: null,
        attackEndTerritoryId: null,
        attackConquestMinTroops: null,
        playerIds: [player.id],
        spectatorIds: [],
        playerTeams: new Map([[player.id, 0]]),
        playerColors: new Map(),
        bannedIds: new Set(),
        territoryOwners: new Map(),
        territoryTroops: new Map(),
        capitalTerritoryIds: new Set(),
        hostPriority: [player.id],
        surrenderedIds: new Set(),
        winnerIds: [],
        deck: [],
        playerCards: new Map(),
        conqueredThisTurn: false,
        cardSetsPlayed: 0,
        cardsLastSetValue: 0,
        stats: new Map(),
        deathOrder: [],
        teamDeathOrder: [],
        finalRanking: [],
        replayInitial: [],
        replayFrames: [],
        connectivitySnapshotTaken: false,
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
    (data: unknown, callback: (response: GameResponse) => void) => {
      if (typeof callback !== 'function') return;
      const player = playersBySocket.get(socket.id);
      if (!player) return callback({ ok: false, error: 'not identified' });
      if (player.gameName)
        return callback({ ok: false, error: 'already in a game' });

      const gameName = isObject(data) ? data.gameName : undefined;
      if (typeof gameName !== 'string')
        return callback({ ok: false, error: 'game not found' });

      const game = games.get(gameName);
      if (!game) return callback({ ok: false, error: 'game not found' });
      if (game.bannedIds.has(player.id))
        return callback({ ok: false, error: 'banned from this game' });

      if (game.playerIds.includes(player.id)) {
        recomputeHost(game, playersById);
      } else if (game.state === 'lobby' && game.playerIds.length < game.slots) {
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
    (data: unknown, callback: (response: GameResponse) => void) => {
      if (typeof callback !== 'function') return;
      const player = playersBySocket.get(socket.id);
      if (!player || !player.gameName)
        return callback({ ok: false, error: 'not in a game' });

      const game = games.get(player.gameName);
      if (!game) return callback({ ok: false, error: 'game not found' });
      if (game.hostId !== player.id)
        return callback({ ok: false, error: 'not the host' });
      if (game.state !== 'lobby')
        return callback({ ok: false, error: 'game already started' });

      const settings: Record<string, unknown> = isObject(data) ? data : {};

      if (settings.mapName !== undefined) {
        if (typeof settings.mapName !== 'string' || !maps.has(settings.mapName))
          return callback({ ok: false, error: 'invalid map' });
        game.mapName = settings.mapName;
      }

      if (settings.gameMode !== undefined) {
        if (!(GAME_MODE_VALUES as unknown[]).includes(settings.gameMode))
          return callback({ ok: false, error: 'invalid game mode' });
        game.gameMode = settings.gameMode as GameMode;
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

        const newBannedIds = new Set<number>(
          settings.bannedPlayerIds.filter(
            (id): id is number => isInteger(id) && id !== player.id,
          ),
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
        const playerTeam = settings.playerTeam;
        if (!isObject(playerTeam))
          return callback({ ok: false, error: 'invalid team' });

        const { playerId, team } = playerTeam;
        if (
          !isInteger(playerId) ||
          !game.playerIds.includes(playerId) ||
          !isInteger(team) ||
          team < 0 ||
          team > maxTeam(game)
        ) {
          return callback({ ok: false, error: 'invalid team' });
        }
        game.playerTeams.set(playerId, team);
      }

      if (settings.slots !== undefined) {
        if (
          !isInteger(settings.slots) ||
          settings.slots < 2 ||
          settings.slots < game.playerIds.length ||
          settings.slots > 20
        ) {
          return callback({ ok: false, error: 'invalid slots' });
        }
        game.slots = settings.slots;
      }

      if (settings.blitz !== undefined) {
        if (!(BLITZ_VALUES as unknown[]).includes(settings.blitz))
          return callback({ ok: false, error: 'invalid blitz' });
        game.blitz = settings.blitz as Blitz;
      }

      if (settings.defenceDice !== undefined) {
        if (!(DEFENCE_DICE_VALUES as unknown[]).includes(settings.defenceDice))
          return callback({ ok: false, error: 'invalid defence dice' });
        game.defenceDice = settings.defenceDice as DefenceDice;
      }

      if (settings.cards !== undefined) {
        if (!(CARDS_VALUES as unknown[]).includes(settings.cards))
          return callback({ ok: false, error: 'invalid cards' });
        game.cards = settings.cards as CardsMode;
      }

      if (settings.turnDuration !== undefined) {
        if (
          !(TURN_DURATION_VALUES as unknown[]).includes(settings.turnDuration)
        )
          return callback({ ok: false, error: 'invalid turn duration' });
        game.turnDuration = settings.turnDuration as TurnDuration;
      }

      callback({ ok: true, game: gameState(game, playersById) });
    },
  );

  socket.on('game:start', (callback: (response: GameResponse) => void) => {
    if (typeof callback !== 'function') return;
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
    game.replayInitial = snapshotTerritories(game);
    game.replayFrames = [];
    const map = maps.get(game.mapName)!;
    game.deck = buildCardDeck(map.territories.map((t) => t.id));
    game.playerCards = new Map(game.playerIds.map((id) => [id, []]));
    game.cardSetsPlayed = 0;
    game.cardsLastSetValue = 0;
    game.stats = new Map(game.playerIds.map((id) => [id, emptyPlayerStats()]));
    game.deathOrder = [];
    game.teamDeathOrder = [];
    for (const id of game.playerIds) {
      if (!ownsAnyTerritory(game, id)) game.deathOrder.push(id);
    }
    game.state = 'playing';
    if (game.gameMode === 'Capitals') {
      startCapitalPlacement(game, io);
    } else {
      startTurns(game, io);
    }
    callback({ ok: true, game: gameState(game, playersById) });
  });

  socket.on('game:cycleColor', (callback: (response: GameResponse) => void) => {
    if (typeof callback !== 'function') return;
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
    if (typeof callback !== 'function') return;
    const player = playersBySocket.get(socket.id);
    if (!player || !player.gameName)
      return callback({ ok: false, error: 'not in a game' });

    const game = games.get(player.gameName);
    if (!game) return callback({ ok: false, error: 'game not found' });
    if (game.state !== 'playing')
      return callback({ ok: false, error: 'game not started' });
    if (game.paused) return callback({ ok: false, error: 'game paused' });
    if (game.playerIds[game.turnPlayerIndex] !== player.id)
      return callback({ ok: false, error: 'not your turn' });
    if (game.turnPhase === 'capital')
      return callback({ ok: false, error: 'cannot skip capital phase' });
    if (game.turnPhase === 'deploy') {
      if (game.troopsToDeploy > 0)
        return callback({ ok: false, error: 'cannot skip deploy phase' });
      if ((game.playerCards.get(player.id)?.length ?? 0) >= 5)
        return callback({ ok: false, error: 'must play a card set' });
    }
    if (game.turnPhase === 'attack' && game.attackConquestMinTroops !== null)
      return callback({ ok: false, error: 'pending conquest move' });

    advanceTurnPhase(game, io);
    callback({ ok: true, game: gameState(game, playersById) });
  });

  socket.on('game:pause', (callback: (response: GameResponse) => void) => {
    if (typeof callback !== 'function') return;
    const player = playersBySocket.get(socket.id);
    if (!player || !player.gameName)
      return callback({ ok: false, error: 'not in a game' });

    const game = games.get(player.gameName);
    if (!game) return callback({ ok: false, error: 'game not found' });
    if (game.hostId !== player.id)
      return callback({ ok: false, error: 'not the host' });
    if (game.state !== 'playing')
      return callback({ ok: false, error: 'game not started' });

    if (game.paused) resumeTurnTimer(game, io);
    else pauseTurnTimer(game);

    callback({ ok: true, game: gameState(game, playersById) });
  });

  socket.on('game:surrender', (callback: (response: GameResponse) => void) => {
    if (typeof callback !== 'function') return;
    const player = playersBySocket.get(socket.id);
    if (!player || !player.gameName)
      return callback({ ok: false, error: 'not in a game' });

    const game = games.get(player.gameName);
    if (!game) return callback({ ok: false, error: 'game not found' });
    if (game.state !== 'playing')
      return callback({ ok: false, error: 'game not started' });
    if (!game.playerIds.includes(player.id))
      return callback({ ok: false, error: 'not a player' });
    if (![...game.territoryOwners.values()].includes(player.id))
      return callback({ ok: false, error: 'already eliminated' });

    game.surrenderedIds.add(player.id);
    if (!game.deathOrder.includes(player.id)) game.deathOrder.push(player.id);
    const wasTheirTurn = game.playerIds[game.turnPlayerIndex] === player.id;
    player.gameName = null;
    socket.leave(gameRoomName(game.name));
    socket.join(HOME_ROOM);
    if (wasTheirTurn) forceEndTurn(game, io);
    checkGameEnd(game, wasTheirTurn);
    recomputeHost(game, playersById);
    destroyIfInactive(game, playersById, io);

    callback({ ok: true, game: gameState(game, playersById) });
  });

  socket.on('game:chat', (data: unknown) => {
    const player = playersBySocket.get(socket.id);
    if (!player || !player.gameName) return;

    const game = games.get(player.gameName);
    if (!game) return;

    const message = isObject(data) ? data.message : undefined;
    if (typeof message !== 'string') return;
    const trimmed = message.trim();
    if (!trimmed) return;

    const payload = { id: player.id, name: player.name, message: trimmed };
    io.to(gameRoomName(game.name)).emit('game:chatMessage', payload);
  });
}
