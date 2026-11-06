import type {
  Card,
  EmojiAttackTarget,
  NukeProject,
  TurnPhase,
} from '../../lib/types';

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

export interface ReplaySeaShips {
  seaTerritoryId: number;
  playerId: number;
  ships: number;
}

export type ReplayAnimation =
  | { type: 'deploy'; territoryId: number; troops: number; playerId: number }
  | {
      type: 'fortify';
      fromTerritoryId: number;
      toTerritoryId: number;
      troops: number;
      troopsRefunded?: number;
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
      troopsRefunded?: number;
    }
  | { type: 'entrench'; territoryId: number; troops: number; playerId: number }
  | { type: 'starve'; territoryId: number; troops: number; playerId: number }
  | { type: 'toxins'; territoryId: number; playerId: number }
  | {
      type: 'unlock';
      fromTerritoryId: number;
      tileId: number;
      cost: number;
      playerId: number;
    }
  | {
      type: 'switch';
      fromTerritoryId: number;
      switchId: number;
      cost: number;
      playerId: number;
    }
  | {
      type: 'nuke';
      fromTerritoryId: number;
      targetTerritoryId: number;
      intercepted: boolean;
      interceptFromTerritoryId: number | null;
      playerId: number;
    }
  | {
      type: 'buyShips';
      sourceTerritoryId: number;
      seaTerritoryId: number;
      ships: number;
      fromPool: boolean;
      playerId: number;
    }
  | {
      type: 'sail';
      fromSeaTerritoryId: number;
      toSeaTerritoryId: number;
      ships: number;
      playerId: number;
    }
  | {
      type: 'attackSea';
      seaTerritoryId: number;
      attackerId: number;
      defenderId: number;
      attackLosses: number;
      defenceLosses: number;
    };

export interface ReplayHand {
  playerId: number;
  cards: Card[];
}

export interface ReplayPlayerState {
  playerId: number;
  eliminated: boolean;
  surrendered: boolean;
  connected?: boolean;
  killedPlayerIds: number[];
  points?: number;
  nukes: number;
  antiNukes: number;
  nukeProjects: NukeProject[];
}

export interface ReplayPlayerStats {
  playerId: number;
  troopsGained: number;
  troopsKilled: number;
  troopsLost: number;
  territoriesConquered: number;
  territoriesLost: number;
  capitalsConquered: number;
  capitalsLost: number;
  cardsGained: number;
  cardsStolen?: number;
  setsPlayed: number;
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
  seaShips: ReplaySeaShips[];
  hands: ReplayHand[];
  playerStates: ReplayPlayerState[];
  playerStats: ReplayPlayerStats[];
  turnPhase: TurnPhase;
  animation: ReplayAnimation;
  roundNumber: number;
  playerId: number;
}

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
      seaShipsDelta: ReplaySeaShips[];
      hands: ReplayHand[];
      playerStates: ReplayPlayerState[];
      statsDelta?: ReplayPlayerStats[];
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
