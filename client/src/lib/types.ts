export interface ClientSettings {
  muted: boolean;
  animationsDisabled: boolean;
  volume: number;
}

export interface Account {
  username: string;
}

export interface IdentifyResult {
  id: number;
  gameName: string | null;
  name: string;
}

export interface SessionResult {
  account: Account | null;
  name: string;
  gameName?: string | null;
  clientSettings?: ClientSettings;
  gameSettings?: Record<string, unknown>;
}

export interface GameSummary {
  name: string;
  mapName: string;
  hostName: string;
  playerCount: number;
  slots: number;
  state: 'lobby' | 'playing' | 'ended';
  spectatorCount: number;
  hasPassword: boolean;
}

export type CardSymbol = 'soldier' | 'humvee' | 'tank';
export type SetKind = CardSymbol | 'mixed';

export interface Card {
  territoryId: number | null;
  symbol: CardSymbol | null;
}

export type Blitz = 'Balanced' | 'True';
export type DefenceDice = 2 | 3;
export type CardsMode =
  | 'Constant'
  | 'Linear'
  | 'Exponential'
  | 'Linear Per Player'
  | 'Exponential Per Player';
export type TurnDuration = 60 | 90 | 120 | 150 | 180 | 300;
export type GameMode =
  | 'Supremacy'
  | 'Supremacy 3/4'
  | 'Supremacy 2/3'
  | 'Capitals'
  | 'Team Deathmatch'
  | 'Continent'
  | '5-Round'
  | '10-Round'
  | 'Assassin'
  | 'Mission'
  | 'Player Kills'
  | 'Troop Kills';
export const GAME_MODES: GameMode[] = [
  'Supremacy',
  'Supremacy 3/4',
  'Supremacy 2/3',
  'Capitals',
  'Team Deathmatch',
  'Continent',
  '5-Round',
  '10-Round',
  'Assassin',
  'Mission',
  'Player Kills',
  'Troop Kills',
];

export type Placement = 'Random' | 'Semi' | 'Custom';
export type Fortification = 'Connected' | 'Neighboring' | 'Unrestricted';
export type Entrenchments = 'off' | 'on';
export type Toxins = 'off' | 'temporary' | 'permanent';
export type Portals = 'off' | 'static' | 'dynamic';
export type Radiations = 'off' | 'static' | 'dynamic' | 'expanding';
export type Starvation = 'off' | 'territory' | 'total' | 'percent';
export type RoundTroops = 'off' | 'on';
export type Bounties = 'off' | 'on';
export type SupplyLines = 'off' | 'on';
export type FogOfWar = 'off' | 'on';
export type Alliances = 'off' | 'on';
export type AllianceViewState =
  'allied' | 'requestSent' | 'requestReceived' | 'none';
export type TurnPhase =
  | 'territory'
  | 'troop'
  | 'capital'
  | 'deploy'
  | 'attack'
  | 'fortify'
  | 'entrench'
  | 'toxins';
export type Visibility = 'public' | 'private';

export interface GameMeta {
  hasPassword: boolean;
  visibility: Visibility;
}

export type EmojiValue = '👍' | '👎' | '❤️' | '🙂' | '🙁' | '😲' | '🙏' | '⚔️';
export type EmojiAttackTarget =
  | { type: 'player'; playerId: number }
  | { type: 'territory'; territoryId: number };
export interface EmojiSentPayload {
  senderId: number;
  targetPlayerId?: number;
  emoji: EmojiValue;
  attackTarget?: EmojiAttackTarget;
}

export interface AllianceRequestedPayload {
  fromId: number;
}

export interface AllianceFormedPayload {
  withId: number;
}

export interface AllianceTerminatedPayload {
  withId: number;
}

export interface AllianceDeclinedPayload {
  withId: number;
}

export type Mission =
  | { type: 'territories'; fraction: number; minTroopsPerTerritory: number }
  | { type: 'continents'; continentIds: number[] }
  | { type: 'assassinate'; targetId: number };

export type BotDifficulty = 'idle' | 'easy' | 'medium' | 'hard';
export type BotPersonality =
  'balanced' | 'taker' | 'breaker' | 'killer' | 'vengeful' | 'erratic';

export interface GameState {
  name: string;
  mapName: string;
  mapGeneration: GenerateMapInput | null;
  slots: number;
  hostId: number;
  originalHostId: number;
  state: 'lobby' | 'playing' | 'ended';
  alliances: Alliances;
  allianceStates: {
    playerId: number;
    state: AllianceViewState;
    cooldownUntil?: number;
  }[];
  blitz: Blitz;
  bounties: Bounties;
  cards: CardsMode;
  defenceDice: DefenceDice;
  disconnectBotDifficulty: BotDifficulty | 'random';
  disconnectBotPersonality: BotPersonality | 'random';
  entrenchments: Entrenchments;
  fogOfWar: FogOfWar;
  fortification: Fortification;
  gameMode: GameMode;
  continentId: number | null;
  placement: Placement;
  portals: Portals;
  portalTerritoryIds: number[];
  portalsEnabled: boolean;
  radiations: Radiations;
  radiationTerritoryIds: number[];
  radiationUpcomingTerritoryIds: number[];
  starvation: Starvation;
  supplyLines: SupplyLines;
  toxins: Toxins;
  turnDuration: TurnDuration;
  roundTroops: RoundTroops;
  territoryTroopsCap: number;
  totalTroopsCap: number;
  roundNumber: number;
  turnPlayerIndex: number;
  turnPhase: TurnPhase;
  troopsToDeploy: number;
  turnStartedAt: number;
  paused: boolean;
  selectedTerritoryId: number | null;
  fortifyStartTerritoryId: number | null;
  fortifyEndTerritoryId: number | null;
  attackStartTerritoryId: number | null;
  attackEndTerritoryId: number | null;
  attackConquestMinTroops: number | null;
  fortifyPathTerritoryIds: number[][];
  winnerIds: number[];
  finalRanking: number[];
  nextSetBaseValues: Record<SetKind, number>;
  upcomingSetValues: number[];
  players: {
    id: number;
    name: string;
    team: number;
    color: number;
    territoryCount: number | null;
    troopCount: number | null;
    capitalCount: number;
    troopsRemaining: number;
    cardCount: number;
    connected: boolean;
    surrendered: boolean;
    eliminated: boolean;
    playersKilled: number[];
    isBot: boolean;
    botDifficulty: BotDifficulty | null;
    botPersonality: BotPersonality | null;
  }[];
  spectators: { id: number; name: string }[];
  bannedPlayers: { id: number; name: string }[];
  territories: {
    id: number;
    ownerId: number;
    troops: number;
    isCapital: boolean;
    entrenchedTurns: number;
  }[];
  toxinTerritories: ReplayToxinTerritory[];
  visibleTerritoryIds?: number[];
}

export interface PlayerResultStats {
  id: number;
  troopsGained: number;
  troopsKilled: number;
  troopsLost: number;
  territoriesConquered: number;
  territoriesLost: number;
  capitalsConquered: number;
  capitalsLost: number;
  cardsGained: number;
  turnsPlayed: number;
  setsPlayed: number;
}

export interface GameResults {
  stats: PlayerResultStats[];
}

export interface GameSettingsInput {
  alliances?: Alliances;
  bannedPlayerIds?: number[];
  blitz?: Blitz;
  bounties?: Bounties;
  cards?: CardsMode;
  defenceDice?: DefenceDice;
  disconnectBotDifficulty?: BotDifficulty | 'random';
  disconnectBotPersonality?: BotPersonality | 'random';
  entrenchments?: Entrenchments;
  fogOfWar?: FogOfWar;
  fortification?: Fortification;
  gameMode?: GameMode;
  mapName?: string;
  name?: string;
  password?: string | null;
  placement?: Placement;
  playerTeam?: { playerId: number; team: number };
  portals?: Portals;
  radiations?: Radiations;
  slots?: number;
  starvation?: Starvation;
  supplyLines?: SupplyLines;
  toxins?: Toxins;
  turnDuration?: TurnDuration;
  roundTroops?: RoundTroops;
  visibility?: Visibility;
}

export type GameRulesSettings = Pick<
  GameSettingsInput,
  | 'alliances'
  | 'blitz'
  | 'bounties'
  | 'cards'
  | 'defenceDice'
  | 'disconnectBotDifficulty'
  | 'disconnectBotPersonality'
  | 'entrenchments'
  | 'fogOfWar'
  | 'fortification'
  | 'gameMode'
  | 'mapName'
  | 'placement'
  | 'portals'
  | 'radiations'
  | 'starvation'
  | 'supplyLines'
  | 'toxins'
  | 'turnDuration'
  | 'roundTroops'
  | 'visibility'
> & { mapGeneration?: GenerateMapInput };

export type Ack = { ok: true; game: GameState } | { ok: false; error: string };

export type MapSize = 'small' | 'medium' | 'large' | 'xlarge';
export type WaterLevel = 'land' | 'mixed' | 'ocean';

export interface GenerateMapInput {
  seed: string;
  size: MapSize;
  water: WaterLevel;
}

export interface ChatMessage {
  id: number;
  name: string;
  message: string;
}

export interface ReplayTerritory {
  id: number;
  ownerId: number;
  troops: number;
  entrenchedTurns: number;
}

export interface ReplayToxinTerritory {
  id: number;
  permanent: boolean;
  roundsRemaining: number;
}

export type ReplayAnimation =
  | { type: 'deploy'; territoryId: number; troops: number; playerId: number }
  | {
      type: 'fortify';
      fromTerritoryId: number;
      toTerritoryId: number;
      troops: number;
      playerId: number;
    }
  | {
      type: 'attack';
      attackingTerritoryId: number;
      defendingTerritoryId: number;
      attackerId: number;
      defenderId: number | undefined;
      attackLosses: number;
      defenceLosses: number;
    }
  | { type: 'entrench'; territoryId: number; troops: number; playerId: number }
  | { type: 'starve'; territoryId: number; troops: number; playerId: number }
  | { type: 'toxins'; territoryId: number; playerId: number };

export interface ReplayHand {
  playerId: number;
  cards: Card[];
}

export interface ReplayFrame {
  territories: ReplayTerritory[];
  toxinTerritories: ReplayToxinTerritory[];
  radiationTerritories: number[];
  radiationUpcoming: number[];
  hands: ReplayHand[];
  turnPhase: TurnPhase;
  animation: ReplayAnimation;
  roundNumber: number;
  playerId: number;
}

export type ReplayAck =
  | {
      ok: true;
      initial: ReplayTerritory[];
      initialRadiation: number[];
      frames: ReplayFrame[];
    }
  | { ok: false; error: string };

export type ReplayEntry =
  | {
      kind: 'action';
      roundNumber: number;
      turnPhase: TurnPhase;
      playerId: number;
      mapDelta: ReplayTerritory[];
      toxinTerritories: ReplayToxinTerritory[];
      radiationTerritories: number[];
      radiationUpcoming: number[];
      hands: ReplayHand[];
      animation: ReplayAnimation;
    }
  | { kind: 'turn'; roundNumber: number; playerId: number }
  | { kind: 'chat'; senderId: number; name: string; message: string }
  | {
      kind: 'emoji';
      senderId: number;
      targetPlayerId: number | null;
      emoji: string;
      attackTarget: EmojiAttackTarget | null;
    };

export interface StoredGameResult {
  playerId: number;
  rank: number;
  team: number;
  eliminated: boolean;
  surrendered: boolean;
  playersKilled: number[];
  troopsGained: number;
  troopsKilled: number;
  troopsLost: number;
  territoriesConquered: number;
  territoriesLost: number;
  capitalsConquered: number;
  capitalsLost: number;
  cardsGained: number;
  turnsPlayed: number;
  setsPlayed: number;
}

export interface StoredGameSettings {
  gameMode: GameMode;
  continentId: number | null;
  slots: number;
  blitz: Blitz;
  defenceDice: DefenceDice;
  cards: CardsMode;
  placement: Placement;
  fortification: Fortification;
  entrenchments: Entrenchments;
  toxins: Toxins;
  portals: Portals;
  radiations: Radiations;
  starvation: Starvation;
  roundTroops: RoundTroops;
  bounties: Bounties;
  supplyLines: SupplyLines;
  fogOfWar: FogOfWar;
  alliances: Alliances;
  turnDuration: TurnDuration;
  disconnectBotDifficulty: BotDifficulty | 'random';
  disconnectBotPersonality: BotPersonality | 'random';
}

export interface StoredGame {
  id: string;
  name: string;
  mapId: string;
  mapName: string;
  mapGeneration: GenerateMapInput | null;
  originalHostId: number;
  roundNumber: number;
  playerCount: number;
  winnerIds: number[];
  capitalTerritoryIds: number[];
  settings: StoredGameSettings;
  players: {
    playerId: number;
    userId: string | null;
    name: string;
    isBot: boolean;
    botDifficulty: BotDifficulty | null;
    botPersonality: BotPersonality | null;
    team: number;
    color: number;
    turnOrder: number;
    rank: number;
    won: boolean;
  }[];
  results: StoredGameResult[];
  serverLog: { type: string; payload: unknown }[];
  replay: {
    initialTerritories: ReplayTerritory[];
    initialRadiation: number[];
    frames: ReplayEntry[];
  };
}

export interface GameHistoryRow {
  id: string;
  name: string;
  mapName: string;
  gameMode: string;
  roundNumber: number;
  playerCount: number;
  winnerIds: number[];
  winnerNames: string[];
  yourRank: number | null;
  settings: StoredGameSettings;
  players: { name: string; isBot: boolean; color: number; team: number }[];
}

export interface GamesQuery {
  page: number;
  pageSize: number;
  search?: string;
  playersMin?: number;
  playersMax?: number;
  mode?: string;
  mapName?: string;
  minRounds?: number;
  maxRounds?: number;
  settings?: Record<string, string>;
  outcome?: 'won' | 'lost';
  positionMin?: number;
  positionMax?: number;
  mine?: boolean;
  sort?: 'newest' | 'rounds' | 'position';
  sortDir?: 'asc' | 'desc';
}

export const SETTING_FILTER_SECTIONS = [
  'Setup',
  'Combat',
  'Reinforcements',
  'Hazards',
  'Players',
] as const;

export const SETTING_FILTERS: {
  key: string;
  label: string;
  section: (typeof SETTING_FILTER_SECTIONS)[number];
  options: string[];
}[] = [
  {
    key: 'placement',
    label: 'Placement',
    section: 'Setup',
    options: ['Random', 'Semi', 'Custom'],
  },
  {
    key: 'fortification',
    label: 'Fortification',
    section: 'Setup',
    options: ['Connected', 'Neighboring', 'Unrestricted'],
  },
  {
    key: 'turnDuration',
    label: 'Turn duration',
    section: 'Setup',
    options: ['60', '90', '120', '150', '180', '300'],
  },
  {
    key: 'blitz',
    label: 'Blitz',
    section: 'Combat',
    options: ['Balanced', 'True'],
  },
  {
    key: 'defenceDice',
    label: 'Defence dice',
    section: 'Combat',
    options: ['2', '3'],
  },
  {
    key: 'entrenchments',
    label: 'Entrenchments',
    section: 'Combat',
    options: ['off', 'on'],
  },
  {
    key: 'cards',
    label: 'Cards',
    section: 'Reinforcements',
    options: [
      'Constant',
      'Linear',
      'Exponential',
      'Linear Per Player',
      'Exponential Per Player',
    ],
  },
  {
    key: 'roundTroops',
    label: 'Round troops',
    section: 'Reinforcements',
    options: ['off', 'on'],
  },
  {
    key: 'bounties',
    label: 'Bounties',
    section: 'Reinforcements',
    options: ['off', 'on'],
  },
  {
    key: 'portals',
    label: 'Portals',
    section: 'Hazards',
    options: ['off', 'static', 'dynamic'],
  },
  {
    key: 'radiations',
    label: 'Radiation',
    section: 'Hazards',
    options: ['off', 'static', 'dynamic', 'expanding'],
  },
  {
    key: 'toxins',
    label: 'Toxins',
    section: 'Hazards',
    options: ['off', 'temporary', 'permanent'],
  },
  {
    key: 'starvation',
    label: 'Starvation',
    section: 'Hazards',
    options: ['off', 'territory', 'total', 'percent'],
  },
  {
    key: 'supplyLines',
    label: 'Supply lines',
    section: 'Hazards',
    options: ['off', 'on'],
  },
  {
    key: 'fogOfWar',
    label: 'Fog of war',
    section: 'Players',
    options: ['off', 'on'],
  },
  {
    key: 'alliances',
    label: 'Alliances',
    section: 'Players',
    options: ['off', 'on'],
  },
];

export interface GamesPage {
  games: GameHistoryRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface StoredMap {
  name: string;
  territories: {
    id: number;
    continentId: number;
    x: number;
    y: number;
    neighbors: number[];
  }[];
  bonuses: number[];
  image: string;
  imageMime: string;
}
