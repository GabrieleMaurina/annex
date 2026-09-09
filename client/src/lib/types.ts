export interface ClientSettings {
  muted: boolean;
  animationsDisabled: boolean;
  volume: number;
}

export interface Account {
  username: string;
  elo: number;
}

export type AccountResult =
  | {
      ok: true;
      username: string;
      email: string;
      picture: string | null;
      pictureDangerous: boolean;
    }
  | { ok: false; error: string };

export interface IdentifyResult {
  id: number;
  gameName: string | null;
  name: string;
}

export interface HomeFilters {
  players: { id: string; label: string }[];
  name: string;
  mode: string;
  mapName: string;
  mapGenerationSize: string;
  mapGenerationType: string;
  mapGenerationFill: string;
  playersMin: number;
  playersMax: number;
  roundsMin: number;
  roundsMax: number;
  phase: string;
  password: string;
  hasBots: string;
  settings: Record<string, string>;
  sort: string;
}

export interface SessionResult {
  account: Account | null;
  name: string;
  gameName?: string | null;
  clientSettings?: ClientSettings;
  gameSettings?: Record<string, unknown>;
  homeFilters?: HomeFilters;
}

export interface GameSummary {
  name: string;
  mapName: string;
  mapGeneration: { size: MapSize; type: GenerationType; fill: Fill } | null;
  hostName: string;
  playerCount: number;
  slots: number;
  state: 'lobby' | 'playing' | 'ended';
  spectatorCount: number;
  hasPassword: boolean;
  hasBots: boolean;
  createdAt: number;
  roundNumber: number;
}

export type CardSymbol = 'soldier' | 'humvee' | 'tank';
export type SetKind = CardSymbol | 'mixed';

export interface Card {
  territoryId: number | null;
  symbol: CardSymbol | null;
}

export type Blitz = 'Balanced' | 'True' | 'Fair';
export interface BlitzOutcome {
  attackLosses: number;
  defenceLosses: number;
}
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
export type Nukes = 'off' | 'on';

export interface NukeProject {
  kind: 'nuke' | 'antiNuke';
  installmentsPaid: number;
  lastPaidRound: number;
}

export interface Arsenal {
  nukes: number;
  antiNukes: number;
}
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

export interface SavedBot {
  difficulty: BotDifficulty | 'random';
  personality: BotPersonality | 'random';
}

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
  nukes: Nukes;
  arsenal: Arsenal;
  nukeProjects: NukeProject[];
  antiNukeTerritoryIds: number[];
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
  startedAt: number | null;
  endedAt: number | null;
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
    userId?: string | null;
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
  userId?: string | null;
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
  nukes?: Nukes;
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
  | 'nukes'
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
export type GenerationType = 'terrain' | 'dungeon' | 'temple';
export type Fill = 'full' | 'mixed' | 'sparse';

export interface GenerateMapInput {
  seed: string;
  size: MapSize;
  type: GenerationType;
  fill: Fill;
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
  | { type: 'toxins'; territoryId: number; playerId: number }
  | {
      type: 'nuke';
      fromTerritoryId: number;
      targetTerritoryId: number;
      intercepted: boolean;
      interceptFromTerritoryId: number | null;
      playerId: number;
    };

export interface ReplayHand {
  playerId: number;
  cards: Card[];
}

export interface ReplayPlayerState {
  playerId: number;
  eliminated: boolean;
  surrendered: boolean;
  killedPlayerIds: number[];
  nukes: number;
  antiNukes: number;
  nukeProjects: NukeProject[];
}

export interface ReplayLogEntry {
  afterFrame: number;
  type: string;
  payload: unknown;
}

export interface ReplayFrame {
  territories: ReplayTerritory[];
  toxinTerritories: ReplayToxinTerritory[];
  radiationTerritories: number[];
  radiationUpcoming: number[];
  hands: ReplayHand[];
  playerStates: ReplayPlayerState[];
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
      log: ReplayLogEntry[];
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
      playerStates: ReplayPlayerState[];
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
  nukes: Nukes;
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
  startedAt: number;
  endedAt: number;
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
  serverLog: ReplayLogEntry[];
  replay: {
    initialTerritories: ReplayTerritory[];
    initialRadiation: number[];
    frames: ReplayEntry[];
  };
}

export interface GameHistoryRow {
  id: string;
  name: string;
  startedAt: string;
  endedAt: string;
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
  playerIds?: string[];
  playersMin?: number;
  playersMax?: number;
  name?: string;
  mode?: string;
  mapName?: string;
  startedFrom?: number;
  startedTo?: number;
  endedFrom?: number;
  endedTo?: number;
  durationMin?: number;
  durationMax?: number;
  generatedMap?: boolean;
  mapGenerationSize?: MapSize;
  mapGenerationType?: GenerationType;
  mapGenerationFill?: Fill;
  minRounds?: number;
  maxRounds?: number;
  hasBots?: boolean;
  settings?: Record<string, string>;
  outcome?: 'won' | 'lost';
  positionMin?: number;
  positionMax?: number;
  mine?: boolean;
  rankUserId?: string;
  sort?: 'newest' | 'rounds' | 'position';
  sortDir?: 'asc' | 'desc';
}

export interface PlayerSearchResult {
  id: string;
  username: string;
}

export interface GamesPage {
  games: GameHistoryRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface HomeGamesQuery {
  page: number;
  pageSize: number;
  playerIds?: string[];
  name?: string;
  mode?: string;
  mapName?: string;
  generatedMap?: boolean;
  mapGenerationSize?: MapSize;
  mapGenerationType?: GenerationType;
  mapGenerationFill?: Fill;
  playersMin?: number;
  playersMax?: number;
  minRounds?: number;
  maxRounds?: number;
  settings?: Record<string, string>;
  phase?: 'lobby' | 'playing' | 'ended';
  hasPassword?: boolean;
  hasBots?: boolean;
  sort?: 'newest' | 'players' | 'rounds' | 'name';
  sortDir?: 'asc' | 'desc';
}

export interface HomeGamesPage {
  games: GameSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PlayerRow {
  id: string;
  username: string;
  elo: number;
  gamesPlayed: number;
}

export interface PlayersQuery {
  page: number;
  pageSize: number;
  username?: string;
  eloMin?: number;
  eloMax?: number;
  gamesMin?: number;
  gamesMax?: number;
  sort: 'elo' | 'username' | 'games';
  sortDir: 'asc' | 'desc';
}

export interface PlayersPage {
  players: PlayerRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PlayerProfile {
  id: string;
  username: string;
  elo: number;
  gamesPlayed: number;
  wins: number;
  averagePlacing: number | null;
  percentile: number;
  createdAt: number;
  picture: string | null;
}

export interface Friend {
  id: string;
  username: string;
  elo: number;
}

export interface FriendsOverview {
  friends: Friend[];
  incoming: Friend[];
  outgoing: Friend[];
}

export interface ConversationMessage {
  fromMe: boolean;
  text: string;
  createdAt: number;
}

export interface Conversation {
  userId: string;
  username: string;
  elo: number;
  messages: ConversationMessage[];
}

export interface BlockedPlayer {
  userId: string;
  username: string;
  elo: number;
}

export interface MessagesOverview {
  conversations: Conversation[];
  blocked: BlockedPlayer[];
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
