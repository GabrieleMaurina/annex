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
export type Entrenchment = 'off' | 'on';
export type Toxins = 'off' | 'temporary' | 'permanent';
export type Portals = 'off' | 'static' | 'dynamic';
export type Radiation = 'off' | 'static' | 'dynamic' | 'expanding';
export type Starvation = 'off' | 'territory' | 'total' | 'percent';
export type TurnTroops = 'off' | 'on';
export type Bounties = 'off' | 'on';
export type SupplyLines = 'off' | 'on';
export type FogOfWar = 'off' | 'on';
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

export type Mission =
  | { type: 'territories'; fraction: number; minTroopsPerTerritory: number }
  | { type: 'continents'; continentIds: number[] }
  | { type: 'assassinate'; targetId: number };

export interface GameState {
  name: string;
  mapName: string;
  slots: number;
  hostId: number;
  state: 'lobby' | 'playing' | 'ended';
  gameMode: GameMode;
  continentId: number | null;
  blitz: Blitz;
  defenceDice: DefenceDice;
  cards: CardsMode;
  placement: Placement;
  fortification: Fortification;
  entrenchment: Entrenchment;
  toxins: Toxins;
  portals: Portals;
  portalTerritoryIds: number[];
  portalsEnabled: boolean;
  radiation: Radiation;
  radiationTerritoryIds: number[];
  radiationUpcomingTerritoryIds: number[];
  starvation: Starvation;
  turnTroops: TurnTroops;
  bounties: Bounties;
  supplyLines: SupplyLines;
  fogOfWar: FogOfWar;
  territoryTroopsCap: number;
  totalTroopsCap: number;
  turnDuration: TurnDuration;
  hasPassword: boolean;
  visibility: Visibility;
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
    troopsGained: number;
    troopsKilled: number;
    troopsLost: number;
    territoriesConquered: number;
    territoriesLost: number;
    capitalsConquered: number;
    capitalsLost: number;
    cardsGained: number;
    playersKilled: number[];
    turnsPlayed: number;
    setsPlayed: number;
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

export interface GameSettingsInput {
  name?: string;
  mapName?: string;
  slots?: number;
  bannedPlayerIds?: number[];
  playerTeam?: { playerId: number; team: number };
  gameMode?: GameMode;
  blitz?: Blitz;
  defenceDice?: DefenceDice;
  cards?: CardsMode;
  placement?: Placement;
  fortification?: Fortification;
  entrenchment?: Entrenchment;
  toxins?: Toxins;
  portals?: Portals;
  radiation?: Radiation;
  starvation?: Starvation;
  turnTroops?: TurnTroops;
  bounties?: Bounties;
  supplyLines?: SupplyLines;
  fogOfWar?: FogOfWar;
  turnDuration?: TurnDuration;
  password?: string | null;
  visibility?: Visibility;
}

export type GameRulesSettings = Pick<
  GameSettingsInput,
  | 'mapName'
  | 'gameMode'
  | 'blitz'
  | 'defenceDice'
  | 'cards'
  | 'placement'
  | 'fortification'
  | 'entrenchment'
  | 'toxins'
  | 'portals'
  | 'radiation'
  | 'starvation'
  | 'turnTroops'
  | 'bounties'
  | 'supplyLines'
  | 'fogOfWar'
  | 'turnDuration'
  | 'visibility'
>;

export type Ack = { ok: true; game: GameState } | { ok: false; error: string };

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
