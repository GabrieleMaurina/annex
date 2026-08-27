import { Server, Socket } from 'socket.io';
import { defaultMapName, maps } from '../../maps';
import { containsProfanity } from '../../profanity';
import {
  Alliances,
  Blitz,
  Bounties,
  CardsMode,
  DefenceDice,
  Entrenchments,
  FogOfWar,
  Fortification,
  Game,
  GameMode,
  HOME_ROOM,
  Placement,
  Player,
  Portals,
  Radiations,
  Starvation,
  SupplyLines,
  Toxins,
  TurnDuration,
  TurnTroops,
  Visibility,
} from '../../types';
import { isInteger, isObject } from '../../validate';
import { initializeContinent } from '../logic/continent';
import { checkGameEnd, computeGameEndWinnerIds } from '../logic/end';
import { addHostCandidate, recomputeHost } from '../logic/host';
import {
  assignRandomColor,
  assignTerritories,
  assignTerritoryOwners,
  compactTeams,
  cycleColor,
  interleaveTeams,
  maxTeam,
  ownsAnyTerritory,
  shuffle,
  teamCount,
} from '../logic/mechanics';
import { initializePortals } from '../logic/portals';
import { buildCardDeck } from '../logic/progression/cards';
import { assignMissions } from '../logic/progression/missions';
import { emptyPlayerStats } from '../logic/progression/stats';
import { initializeRadiation } from '../logic/radiation/radiation';
import { snapshotTerritories } from '../logic/replay';
import { gameState } from '../logic/state';
import {
  broadcastHomeGames,
  broadcastMissions,
  destroyIfInactive,
  gameRoomName,
  games,
  removePlayerFromGame,
  respondWithGameState,
  sendGameResults,
  sendGameState,
  sendPlayerCards,
} from '../logic/store';
import {
  advanceTurnPhase,
  beginNextSpecialPhase,
  forceEndTurnImpl,
  pauseTurnTimer,
  resumeTurnTimer,
} from '../logic/turns';

const MAX_GAME_NAME_LENGTH = 20;

const GAME_MODE_VALUES: GameMode[] = [
  'Supremacy',
  'Supremacy 3/4',
  'Supremacy 2/3',
  'Capitals',
  'Team Deathmatch',
  'Continent',
  '5-Turn',
  '10-Turn',
  'Assassin',
  'Mission',
  'Player Kills',
  'Troop Kills',
];
const BLITZ_VALUES: Blitz[] = ['Balanced', 'True'];
const DEFENCE_DICE_VALUES: DefenceDice[] = [2, 3];
const CARDS_VALUES: CardsMode[] = [
  'Constant',
  'Linear',
  'Exponential',
  'Linear Per Player',
  'Exponential Per Player',
];
const PLACEMENT_VALUES: Placement[] = ['Random', 'Semi', 'Custom'];
const FORTIFICATION_VALUES: Fortification[] = [
  'Connected',
  'Neighboring',
  'Unrestricted',
];
const ENTRENCHMENTS_VALUES: Entrenchments[] = ['off', 'on'];
const TOXINS_VALUES: Toxins[] = ['off', 'temporary', 'permanent'];
const PORTALS_VALUES: Portals[] = ['off', 'static', 'dynamic'];
const RADIATIONS_VALUES: Radiations[] = [
  'off',
  'static',
  'dynamic',
  'expanding',
];
const STARVATION_VALUES: Starvation[] = [
  'off',
  'territory',
  'total',
  'percent',
];
const TURN_TROOPS_VALUES: TurnTroops[] = ['off', 'on'];
const BOUNTIES_VALUES: Bounties[] = ['off', 'on'];
const SUPPLY_LINES_VALUES: SupplyLines[] = ['off', 'on'];
const FOG_OF_WAR_VALUES: FogOfWar[] = ['off', 'on'];
const ALLIANCES_VALUES: Alliances[] = ['off', 'on'];
const TURN_DURATION_VALUES: TurnDuration[] = [60, 90, 120, 150, 180, 300];
const VISIBILITY_VALUES: Visibility[] = ['public', 'private'];
const MAX_PASSWORD_LENGTH = 50;

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
        continentId: null,
        blitz: 'Balanced',
        defenceDice: 2,
        cards: 'Constant',
        placement: 'Random',
        fortification: 'Connected',
        entrenchments: 'off',
        toxins: 'off',
        portals: 'off',
        portalTerritoryIds: [],
        portalsEnabled: false,
        radiations: 'off',
        radiationTerritoryIds: new Set(),
        radiationUpcomingTerritoryIds: new Set(),
        starvation: 'off',
        turnTroops: 'off',
        bounties: 'off',
        supplyLines: 'off',
        fogOfWar: 'off',
        alliances: 'off',
        allianceIds: new Set(),
        allianceRequests: new Map(),
        allianceCooldowns: new Map(),
        allianceInitiators: new Map(),
        turnDuration: 120,
        password: null,
        visibility: 'public',
        turnNumber: 0,
        turnPlayerIndex: 0,
        turnPhase: 'deploy',
        troopsToDeploy: 0,
        remainingSpecialPhases: [],
        placementTroopPools: new Map(),
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
        passwordExemptIds: new Set([player.id]),
        territoryOwners: new Map(),
        territoryTroops: new Map(),
        territoryEntrenchment: new Map(),
        territoryToxins: new Map(),
        capitalTerritoryIds: new Set(),
        playerMissions: new Map(),
        hostPriority: [player.id],
        substituteFor: new Map(),
        surrenderedIds: new Set(),
        winnerIds: [],
        deck: [],
        playerCards: new Map(),
        conqueredThisTurn: false,
        cardSetsPlayed: new Map(),
        cardsLastSetValue: new Map(),
        stats: new Map(),
        deathOrder: [],
        teamDeathOrder: [],
        finalRanking: [],
        replayInitial: [],
        replayInitialRadiation: [],
        replayFrames: [],
        logs: new Map(),
      };
      games.set(game.name, game);
      player.gameName = game.name;
      assignRandomColor(game, player.id);

      socket.leave(HOME_ROOM);
      socket.join(gameRoomName(game.name));
      broadcastHomeGames(io, playersById);
      respondWithGameState(io, playersById, game, player.id, callback);
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

      if (!game.passwordExemptIds.has(player.id) && game.password !== null) {
        const password = isObject(data) ? data.password : undefined;
        if (password !== game.password)
          return callback({ ok: false, error: 'invalid password' });
      }
      game.passwordExemptIds.add(player.id);

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
      broadcastHomeGames(io, playersById);
      respondWithGameState(io, playersById, game, player.id, callback);
    },
  );

  socket.on('game:requestState', () => {
    const player = playersBySocket.get(socket.id);
    if (!player || !player.gameName) return;
    const game = games.get(player.gameName);
    if (!game) return;
    sendGameState(io, playersById, game, player.id);
  });

  socket.on('game:requestResults', () => {
    const player = playersBySocket.get(socket.id);
    if (!player || !player.gameName) return;
    const game = games.get(player.gameName);
    if (!game || game.state !== 'ended') return;
    sendGameResults(io, playersById, game, player.id);
  });

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
        if (game.gameMode === 'Team Deathmatch') game.alliances = 'off';
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
        if (game.defenceDice !== 2) game.entrenchments = 'off';
      }

      if (settings.cards !== undefined) {
        if (!(CARDS_VALUES as unknown[]).includes(settings.cards))
          return callback({ ok: false, error: 'invalid cards' });
        game.cards = settings.cards as CardsMode;
      }

      if (settings.placement !== undefined) {
        if (!(PLACEMENT_VALUES as unknown[]).includes(settings.placement))
          return callback({ ok: false, error: 'invalid placement' });
        game.placement = settings.placement as Placement;
      }

      if (settings.fortification !== undefined) {
        if (
          !(FORTIFICATION_VALUES as unknown[]).includes(settings.fortification)
        )
          return callback({ ok: false, error: 'invalid fortification' });
        game.fortification = settings.fortification as Fortification;
      }

      if (settings.entrenchments !== undefined) {
        if (
          !(ENTRENCHMENTS_VALUES as unknown[]).includes(settings.entrenchments)
        )
          return callback({ ok: false, error: 'invalid entrenchments' });
        if (settings.entrenchments === 'on' && game.defenceDice !== 2)
          return callback({ ok: false, error: 'invalid entrenchments' });
        game.entrenchments = settings.entrenchments as Entrenchments;
      }

      if (settings.toxins !== undefined) {
        if (!(TOXINS_VALUES as unknown[]).includes(settings.toxins))
          return callback({ ok: false, error: 'invalid toxins' });
        game.toxins = settings.toxins as Toxins;
      }

      if (settings.portals !== undefined) {
        if (!(PORTALS_VALUES as unknown[]).includes(settings.portals))
          return callback({ ok: false, error: 'invalid portals' });
        game.portals = settings.portals as Portals;
      }

      if (settings.radiations !== undefined) {
        if (!(RADIATIONS_VALUES as unknown[]).includes(settings.radiations))
          return callback({ ok: false, error: 'invalid radiations' });
        game.radiations = settings.radiations as Radiations;
      }

      if (settings.starvation !== undefined) {
        if (!(STARVATION_VALUES as unknown[]).includes(settings.starvation))
          return callback({ ok: false, error: 'invalid starvation' });
        game.starvation = settings.starvation as Starvation;
      }

      if (settings.turnTroops !== undefined) {
        if (!(TURN_TROOPS_VALUES as unknown[]).includes(settings.turnTroops))
          return callback({ ok: false, error: 'invalid turn troops' });
        game.turnTroops = settings.turnTroops as TurnTroops;
      }

      if (settings.bounties !== undefined) {
        if (!(BOUNTIES_VALUES as unknown[]).includes(settings.bounties))
          return callback({ ok: false, error: 'invalid bounties' });
        game.bounties = settings.bounties as Bounties;
      }

      if (settings.supplyLines !== undefined) {
        if (!(SUPPLY_LINES_VALUES as unknown[]).includes(settings.supplyLines))
          return callback({ ok: false, error: 'invalid supply lines' });
        game.supplyLines = settings.supplyLines as SupplyLines;
      }

      if (settings.fogOfWar !== undefined) {
        if (!(FOG_OF_WAR_VALUES as unknown[]).includes(settings.fogOfWar))
          return callback({ ok: false, error: 'invalid fog of war' });
        game.fogOfWar = settings.fogOfWar as FogOfWar;
      }

      if (settings.alliances !== undefined) {
        if (!(ALLIANCES_VALUES as unknown[]).includes(settings.alliances))
          return callback({ ok: false, error: 'invalid alliances' });
        if (settings.alliances === 'on' && game.gameMode === 'Team Deathmatch')
          return callback({ ok: false, error: 'invalid alliances' });
        game.alliances = settings.alliances as Alliances;
      }

      if (settings.turnDuration !== undefined) {
        if (
          !(TURN_DURATION_VALUES as unknown[]).includes(settings.turnDuration)
        )
          return callback({ ok: false, error: 'invalid turn duration' });
        game.turnDuration = settings.turnDuration as TurnDuration;
      }

      if (settings.password !== undefined) {
        if (settings.password === null) {
          game.password = null;
        } else {
          if (typeof settings.password !== 'string')
            return callback({ ok: false, error: 'invalid password' });
          const trimmedPassword = settings.password.trim();
          if (!trimmedPassword || trimmedPassword.length > MAX_PASSWORD_LENGTH)
            return callback({ ok: false, error: 'invalid password' });
          game.password = trimmedPassword;
        }
      }

      if (settings.visibility !== undefined) {
        if (!(VISIBILITY_VALUES as unknown[]).includes(settings.visibility))
          return callback({ ok: false, error: 'invalid visibility' });
        game.visibility = settings.visibility as Visibility;
      }

      broadcastHomeGames(io, playersById);
      respondWithGameState(io, playersById, game, player.id, callback);
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
    if (game.gameMode === 'Team Deathmatch' && game.alliances === 'on')
      return callback({
        ok: false,
        error: 'alliances not allowed in team deathmatch',
      });

    for (const ownerId of game.substituteFor.values()) {
      const owner = playersById.get(ownerId);
      if (owner && owner.gameName === game.name) owner.gameName = null;
    }
    game.substituteFor.clear();

    if (game.gameMode === 'Team Deathmatch') {
      compactTeams(game);
      game.playerIds = interleaveTeams(game);
    } else {
      game.playerIds = shuffle(game.playerIds);
    }
    initializeRadiation(game);
    game.replayInitialRadiation = [...game.radiationTerritoryIds];
    initializePortals(game);
    initializeContinent(game);
    if (game.placement === 'Random') {
      assignTerritories(game);
    } else if (game.placement === 'Semi') {
      assignTerritoryOwners(game);
    }
    if (game.gameMode === 'Assassin') {
      game.playerMissions = assignMissions(game, ['assassinate']);
    } else if (game.gameMode === 'Mission') {
      game.playerMissions = assignMissions(game);
    } else {
      game.playerMissions = new Map();
    }
    broadcastMissions(io, game, playersById);
    game.replayInitial = snapshotTerritories(game);
    game.replayFrames = [];
    const map = maps.get(game.mapName)!;
    game.deck = buildCardDeck(map.territories.map((t) => t.id));
    game.playerCards = new Map(game.playerIds.map((id) => [id, []]));
    for (const id of game.playerIds) {
      sendPlayerCards(io, playersById, game, id);
    }
    game.cardSetsPlayed = new Map();
    game.cardsLastSetValue = new Map();
    game.stats = new Map(game.playerIds.map((id) => [id, emptyPlayerStats()]));
    game.deathOrder = [];
    game.teamDeathOrder = [];
    if (game.placement !== 'Custom') {
      for (const id of game.playerIds) {
        if (!ownsAnyTerritory(game, id)) game.deathOrder.push(id);
      }
    }
    game.state = 'playing';
    game.remainingSpecialPhases = [
      ...(game.placement === 'Custom' ? (['territory'] as const) : []),
      ...(game.placement !== 'Random' ? (['troop'] as const) : []),
      ...(game.gameMode === 'Capitals' ? (['capital'] as const) : []),
    ];
    beginNextSpecialPhase(game, io, playersById);
    broadcastHomeGames(io, playersById);
    respondWithGameState(io, playersById, game, player.id, callback);
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
    respondWithGameState(io, playersById, game, player.id, callback);
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
    if (
      game.turnPhase === 'territory' ||
      game.turnPhase === 'troop' ||
      game.turnPhase === 'capital'
    )
      return callback({
        ok: false,
        error: `cannot skip ${game.turnPhase} phase`,
      });
    if (game.turnPhase === 'deploy') {
      if (game.troopsToDeploy > 0)
        return callback({ ok: false, error: 'cannot skip deploy phase' });
      if ((game.playerCards.get(player.id)?.length ?? 0) >= 5)
        return callback({ ok: false, error: 'must play a card set' });
    }
    if (game.turnPhase === 'attack' && game.attackConquestMinTroops !== null)
      return callback({ ok: false, error: 'pending conquest move' });

    advanceTurnPhase(game, io, playersById);
    respondWithGameState(io, playersById, game, player.id, callback);
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

    if (game.paused) resumeTurnTimer(game, io, playersById);
    else pauseTurnTimer(game);

    respondWithGameState(io, playersById, game, player.id, callback);
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
    if (game.turnPhase !== 'territory' && !ownsAnyTerritory(game, player.id))
      return callback({ ok: false, error: 'already eliminated' });

    game.surrenderedIds.add(player.id);
    if (!game.deathOrder.includes(player.id)) game.deathOrder.push(player.id);
    const wasTheirTurn = game.playerIds[game.turnPlayerIndex] === player.id;
    if (wasTheirTurn) {
      const endsGame = computeGameEndWinnerIds(game) !== null;
      forceEndTurnImpl(game, io, playersById, endsGame);
    }
    checkGameEnd(game, io, playersById, wasTheirTurn);
    recomputeHost(game, playersById);
    destroyIfInactive(game, playersById, io);
    broadcastHomeGames(io, playersById);

    respondWithGameState(io, playersById, game, player.id, callback);
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
    if (containsProfanity(trimmed)) return;

    const payload = { id: player.id, name: player.name, message: trimmed };
    io.to(gameRoomName(game.name)).emit('game:chatMessage', payload);
  });
}
