import {
  FILL_VALUES,
  GAME_ENUMS,
  GENERATION_TYPES,
  MAP_ASPECTS,
  MAP_SIZES,
  TILE_SHAPES,
} from './users/preferences';

const int = { bsonType: 'number' };
const string = { bsonType: 'string' };
const bool = { bsonType: 'bool' };

function object(required: string[], properties: Record<string, unknown>) {
  return {
    bsonType: 'object',
    required,
    additionalProperties: false,
    properties,
  };
}

function array(items: unknown) {
  return { bsonType: 'array', items };
}

const territory = object(['id', 'ownerId', 'troops', 'entrenchedTurns'], {
  id: int,
  ownerId: int,
  troops: int,
  entrenchedTurns: int,
});

const toxinTerritory = object(['id', 'permanent', 'roundsRemaining'], {
  id: int,
  permanent: bool,
  roundsRemaining: int,
});

const seaShipsDelta = object(['seaTerritoryId', 'playerId', 'ships'], {
  seaTerritoryId: int,
  playerId: int,
  ships: int,
});

const card = object(['territoryId', 'symbol'], {
  territoryId: { bsonType: ['number', 'null'] },
  symbol: { bsonType: ['string', 'null'] },
});

const hand = object(['playerId', 'cards'], {
  playerId: int,
  cards: array(card),
});

const nukeProject = object(['kind', 'installmentsPaid', 'lastPaidRound'], {
  kind: { enum: ['nuke', 'antiNuke'] },
  installmentsPaid: int,
  lastPaidRound: int,
});

const playerState = object(
  [
    'playerId',
    'eliminated',
    'surrendered',
    'killedPlayerIds',
    'nukes',
    'antiNukes',
    'nukeProjects',
  ],
  {
    playerId: int,
    eliminated: bool,
    surrendered: bool,
    connected: bool,
    killedPlayerIds: array(int),
    points: int,
    nukes: int,
    antiNukes: int,
    nukeProjects: array(nukeProject),
  },
);

const playerStats = object(
  [
    'playerId',
    'troopsGained',
    'troopsKilled',
    'troopsLost',
    'territoriesConquered',
    'territoriesLost',
    'capitalsConquered',
    'capitalsLost',
    'cardsGained',
    'setsPlayed',
  ],
  {
    playerId: int,
    troopsGained: int,
    troopsKilled: int,
    troopsLost: int,
    territoriesConquered: int,
    territoriesLost: int,
    capitalsConquered: int,
    capitalsLost: int,
    cardsGained: int,
    cardsStolen: int,
    setsPlayed: int,
  },
);

const animation = { bsonType: 'object' };

const actionFrame = object(
  [
    'kind',
    'roundNumber',
    'turnPhase',
    'playerId',
    'mapDelta',
    'toxinTerritories',
    'radiationTerritories',
    'radiationUpcoming',
    'seaShipsDelta',
    'hands',
    'playerStates',
    'animation',
  ],
  {
    kind: { enum: ['action'] },
    roundNumber: int,
    turnPhase: string,
    playerId: int,
    mapDelta: array(territory),
    toxinTerritories: array(toxinTerritory),
    radiationTerritories: array(int),
    radiationUpcoming: array(int),
    seaShipsDelta: array(seaShipsDelta),
    hands: array(hand),
    playerStates: array(playerState),
    statsDelta: array(playerStats),
    animation,
  },
);

const turnFrame = object(['kind', 'roundNumber', 'playerId'], {
  kind: { enum: ['turn'] },
  roundNumber: int,
  playerId: int,
});

const chatFrame = object(['kind', 'senderId', 'name', 'message'], {
  kind: { enum: ['chat'] },
  senderId: int,
  name: string,
  message: string,
});

const emojiFrame = object(
  ['kind', 'senderId', 'targetPlayerId', 'emoji', 'attackTarget'],
  {
    kind: { enum: ['emoji'] },
    senderId: int,
    targetPlayerId: { bsonType: ['number', 'null'] },
    emoji: string,
    attackTarget: { bsonType: ['object', 'null'] },
  },
);

const result = object(
  [
    'playerId',
    'rank',
    'team',
    'eliminated',
    'surrendered',
    'playersKilled',
    'troopsGained',
    'troopsKilled',
    'troopsLost',
    'territoriesConquered',
    'territoriesLost',
    'capitalsConquered',
    'capitalsLost',
    'cardsGained',
    'turnsPlayed',
    'setsPlayed',
  ],
  {
    playerId: int,
    rank: int,
    team: int,
    eliminated: bool,
    surrendered: bool,
    playersKilled: array(int),
    points: int,
    troopsGained: int,
    troopsKilled: int,
    troopsLost: int,
    territoriesConquered: int,
    territoriesLost: int,
    capitalsConquered: int,
    capitalsLost: int,
    cardsGained: int,
    cardsStolen: int,
    turnsPlayed: int,
    setsPlayed: int,
    setsOnThree: int,
    turnsOnThree: int,
    luck: int,
    played: bool,
    disconnected: bool,
  },
);

export const SETTINGS_ENUM_KEYS = [
  'gameMode',
  'blitz',
  'defenceDice',
  'attackDice',
  'defenceSides',
  'attackSides',
  'diceTies',
  'continents',
  'initialTroops',
  'minTroops',
  'troopsPerTerritory',
  'maxPoints',
  'hills',
  'cards',
  'placement',
  'fortification',
  'entrenchments',
  'toxins',
  'portals',
  'radiations',
  'starvation',
  'roundTroops',
  'bounties',
  'capitalRefund',
  'startingCapitals',
  'supplyLines',
  'fogOfWar',
  'alliances',
  'anonymous',
  'nukes',
  'turnDuration',
  'attackIncrement',
  'maxRounds',
  'maxDuration',
  'capitalStandoff',
  'drawOfferRound',
  'disconnectBotDifficulty',
  'disconnectBotPersonality',
  'minRank',
  'minGames',
  'minAccountAge',
  'minReputation',
];

const settings = object(['continentId', 'slots', ...SETTINGS_ENUM_KEYS], {
  continentId: { bsonType: ['number', 'null'] },
  slots: int,
  ...Object.fromEntries(
    SETTINGS_ENUM_KEYS.map((key) => [key, { enum: GAME_ENUMS[key] }]),
  ),
});

const player = object(
  [
    'playerId',
    'userId',
    'name',
    'isBot',
    'botDifficulty',
    'botPersonality',
    'team',
    'color',
    'turnOrder',
    'rank',
    'won',
    'elo',
    'eloDelta',
    'eloPenalty',
  ],
  {
    playerId: int,
    userId: { bsonType: ['string', 'null'] },
    name: { bsonType: ['string', 'null'] },
    isBot: bool,
    botDifficulty: { bsonType: ['string', 'null'] },
    botPersonality: { bsonType: ['string', 'null'] },
    team: int,
    color: int,
    turnOrder: int,
    rank: int,
    won: bool,
    elo: { ...int, minimum: 0 },
    eloDelta: int,
    eloPenalty: { enum: [null, 'disconnected', 'surrender'] },
  },
);

export const GAMES_SCHEMA = {
  validator: {
    $jsonSchema: object(
      [
        'name',
        'mapId',
        'mapGeneration',
        'settings',
        'players',
        'winnerIds',
        'roundNumber',
        'playerCount',
        'originalHostId',
        'startedAt',
        'endedAt',
        'capitalTerritoryIds',
        'results',
        'serverLog',
        'replay',
      ],
      {
        _id: {},
        name: string,
        mapId: string,
        originalHostId: int,
        startedAt: int,
        endedAt: int,
        mapGeneration: {
          bsonType: ['object', 'null'],
          required: [
            'seed',
            'size',
            'type',
            'fill',
            'tile',
            'seas',
            'timed',
            'directional',
            'unlockable',
            'aspect',
          ],
          additionalProperties: false,
          properties: {
            seed: string,
            size: { enum: MAP_SIZES },
            type: { enum: GENERATION_TYPES },
            fill: { enum: FILL_VALUES },
            tile: { enum: TILE_SHAPES },
            seas: bool,
            timed: bool,
            directional: bool,
            switched: bool,
            unlockable: bool,
            aspect: { enum: MAP_ASPECTS },
            mountains: bool,
            rivers: bool,
          },
        },
        playerMapId: { bsonType: ['string', 'null'] },
        settings,
        players: array(player),
        winnerIds: array(int),
        draw: {
          bsonType: ['object', 'null'],
          required: ['reason', 'playerIds'],
          additionalProperties: false,
          properties: {
            reason: {
              enum: [
                'max rounds',
                'max duration',
                'capital standoff',
                'agreed',
              ],
            },
            playerIds: array(int),
          },
        },
        roundNumber: int,
        playerCount: int,
        capitalTerritoryIds: array(int),
        hillTerritoryIds: array(int),
        continentBonuses: array(int),
        results: array(result),
        serverLog: array(
          object(['type', 'payload', 'afterFrame'], {
            type: string,
            payload: { bsonType: 'object' },
            afterFrame: int,
          }),
        ),
        replay: object(['initialTerritories', 'initialRadiation', 'frames'], {
          initialTerritories: array(territory),
          initialRadiation: array(int),
          frames: {
            bsonType: 'array',
            items: {
              oneOf: [actionFrame, turnFrame, chatFrame, emojiFrame],
            },
          },
        }),
      },
    ),
  },
  validationLevel: 'strict',
  validationAction: 'error',
};
