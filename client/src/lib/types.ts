export interface PlayerSettings {
  muted: boolean;
  animationsDisabled: boolean;
  volume: number;
}

export interface Player {
  key: string;
  name: string;
  settings?: PlayerSettings;
  gameSettings?: GameRulesSettings;
  gameSlots?: number;
  gameName?: string;
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
  | '5-Turn'
  | '10-Turn'
  | 'Assassin'
  | 'Mission'
  | 'Player Kills'
  | 'Troop Kills';
export type Placement = 'Random' | 'Semi' | 'Custom';
export type Fortification = 'Connected' | 'Neighboring' | 'Unrestricted';
export type Entrenchments = 'off' | 'on';
export type Toxins = 'off' | 'temporary' | 'permanent';
export type Portals = 'off' | 'static' | 'dynamic';
export type Radiations = 'off' | 'static' | 'dynamic' | 'expanding';
export type Starvation = 'off' | 'territory' | 'total' | 'percent';
export type TurnTroops = 'off' | 'on';
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
  turnTroops: TurnTroops;
  territoryTroopsCap: number;
  totalTroopsCap: number;
  turnNumber: number;
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
  turnTroops?: TurnTroops;
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
  | 'turnTroops'
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
  turnsRemaining: number;
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

export interface ReplayFrame {
  territories: ReplayTerritory[];
  toxinTerritories: ReplayToxinTerritory[];
  radiationTerritories: number[];
  animation: ReplayAnimation;
  turnNumber: number;
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
