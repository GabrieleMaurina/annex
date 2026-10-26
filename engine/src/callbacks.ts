import type { gameResultsStats, gameState } from './game/state';
import {
  Card,
  EmojiAttackTarget,
  EmojiValue,
  GameLogEvent,
  Mission,
} from './types';

export interface EngineCallbacks {
  onHomeGames(playerId: number, games: unknown[]): void;
  onGameState(
    playerId: number,
    state: ReturnType<typeof gameState>,
    gameName: string,
  ): void;
  onCards(playerId: number, payload: { cards: Card[] }, gameName: string): void;
  onMission(
    playerId: number,
    payload: { mission: Mission },
    gameName: string,
  ): void;
  onLogs(
    playerId: number,
    payload: { entries: GameLogEvent[] },
    gameName: string,
  ): void;
  onResults(
    playerId: number,
    payload: { stats: ReturnType<typeof gameResultsStats> },
    gameName: string,
  ): void;
  onGameEnded?(payload: {
    gameName: string;
    gameMode: string;
    roundNumber: number;
    ranking: {
      playerId: number;
      team: number;
      surrenderRound: number | null;
      disconnected: boolean;
    }[];
  }): void;
  onCardSetPlayed(
    playerId: number,
    payload: {
      playerId: number;
      troops: number;
      cards: Card[];
      territoryBonusCount: number;
    },
    gameName: string,
  ): void;
  onKicked(playerId: number, payload: { gameName: string }): void;
  onChatMessage(
    playerId: number,
    payload: { id: number; name: string; message: string },
    gameName: string,
  ): void;
  onEmojiSent(
    playerId: number,
    payload: {
      senderId: number;
      targetPlayerId: number | undefined;
      emoji: EmojiValue;
      attackTarget: EmojiAttackTarget | undefined;
    },
    gameName: string,
  ): void;
  onAllianceRequested(
    playerId: number,
    payload: { fromId: number },
    gameName: string,
  ): void;
  onAllianceFormed(
    playerId: number,
    payload: { withId: number },
    gameName: string,
  ): void;
  onAllianceDeclined(
    playerId: number,
    payload: { withId: number },
    gameName: string,
  ): void;
  onAllianceTerminated(
    playerId: number,
    payload: { withId: number },
    gameName: string,
  ): void;
  onCapitalPlacementStarted(playerId: number): void;
  onTerritoryClaimed(
    playerId: number,
    payload: { territoryId: number; playerId: number; troops: number },
    gameName: string,
  ): void;
  onTurnStarted(
    playerId: number,
    payload: {
      playerId: number;
      roundNumber: number;
      troopsFromTerritories: number;
      troopsFromBonuses: number;
      troopsFromCapitals: number;
      troopsFromRoundTroops: number;
      troopsFromBounties: number;
      troopsWithheld: number;
    },
    gameName: string,
  ): void;
  onDeployed(
    playerId: number,
    payload: { territoryId: number; troops: number; playerId: number },
    gameName: string,
  ): void;
  onDeployedMany(
    playerId: number,
    payload: {
      deposits: { territoryId: number; troops: number }[];
      playerId: number;
    },
    gameName: string,
  ): void;
  onFortified(
    playerId: number,
    payload: {
      territoryId: number;
      fromTerritoryId: number;
      playerId: number;
      path: number[][];
      troopsRemoved?: number;
      troopsAdded?: number;
    },
    gameName: string,
  ): void;
  onEntrenched(
    playerId: number,
    payload: {
      territoryId: number;
      troops: number;
      turnsRemaining: number;
      playerId: number;
    },
    gameName: string,
  ): void;
  onToxined(
    playerId: number,
    payload: {
      territoryId: number;
      permanent: boolean;
      roundsRemaining: number;
      playerId: number;
    },
    gameName: string,
  ): void;
  onUnlocked(
    playerId: number,
    payload: {
      fromTerritoryId: number;
      tileId: number;
      cost: number;
      playerId: number;
    },
    gameName: string,
  ): void;
  onToxinExpired(
    playerId: number,
    payload: { territoryIds: number[] },
    gameName: string,
  ): void;
  onRadiationUpcoming(
    playerId: number,
    payload: { territoryIds: number[] },
    gameName: string,
  ): void;
  onRadiationChanged(
    playerId: number,
    payload: {
      territoryIds: number[];
      eliminatedPlayerIds: number[];
      newlyRadiatedIds: number[];
    },
    gameName: string,
  ): void;
  onStarved(
    playerId: number,
    payload: { losses: { territoryId: number; troops: number }[] },
    gameName: string,
  ): void;
  onNukeLaunched(
    playerId: number,
    payload: {
      playerId: number;
      fromTerritoryId: number;
      targetTerritoryId: number;
      intercepted: boolean;
      interceptFromTerritoryId: number | null;
      eliminatedPlayerIds: number[];
    },
    gameName: string,
  ): void;
  onAttacked(
    playerId: number,
    payload: {
      attackingTerritoryId: number;
      defendingTerritoryId: number;
      attackerId: number;
      type: 'regular' | 'blitz';
      path: number[][];
      attackingTroops?: number;
      attackLosses?: number;
      defenderId?: number;
      defendingTroops?: number;
      defenceLosses?: number;
      conquered?: boolean;
      eliminated?: boolean;
      cardsTaken?: number;
      troopsRefunded?: number;
    },
    gameName: string,
  ): void;
  onTankFired(
    playerId: number,
    payload: { type: 'regular' | 'blitz'; hasDefender: boolean },
    gameName: string,
  ): void;
  onAttackMoved(
    playerId: number,
    payload: {
      territoryId: number;
      fromTerritoryId: number;
      path: number[][];
      troopsRemoved?: number;
      troopsAdded?: number;
      troopsRefunded?: number;
    },
    gameName: string,
  ): void;
  onShipsBought(
    playerId: number,
    payload: {
      sourceTerritoryId: number;
      seaTerritoryId: number;
      ships: number;
      fromPool: boolean;
      playerId: number;
    },
    gameName: string,
  ): void;
  onSailed(
    playerId: number,
    payload: {
      seaTerritoryId: number;
      fromSeaTerritoryId: number;
      playerId: number;
      path: number[][];
      shipsRemoved?: number;
      shipsAdded?: number;
    },
    gameName: string,
  ): void;
  onSeaAttacked(
    playerId: number,
    payload: {
      seaTerritoryId: number;
      attackerId: number;
      defenderId: number;
      type: 'regular' | 'blitz';
      attackingShips: number;
      attackLosses: number;
      defendingShips: number;
      defenceLosses: number;
    },
    gameName: string,
  ): void;
  onSurrendered(
    playerId: number,
    payload: { playerId: number },
    gameName: string,
  ): void;
  onPointsScored(
    playerId: number,
    payload: {
      playerId: number;
      points: number;
      total: number;
      roundNumber: number;
    },
    gameName: string,
  ): void;
  onGameOver(
    playerId: number,
    payload: { winnerIds: number[] },
    gameName: string,
  ): void;
  onSelected(
    playerId: number,
    payload: { territoryId: number },
    gameName: string,
  ): void;
  onMapGenerated(
    playerId: number,
    payload: {
      name: string;
      territories: unknown[];
      seaTerritories: unknown[];
      bonuses: number[];
      wraps: unknown[];
      timedConnections: unknown[];
      lockedTiles: unknown[];
      imageSrc: string;
      borderColors: string[];
    },
    gameName: string,
  ): void;

  onRoomChanged(playerId: number, gameName: string | null): void;
}

export type CallbackPayload<K extends keyof EngineCallbacks> = Parameters<
  NonNullable<EngineCallbacks[K]>
>[1];

export let callbacks: EngineCallbacks;

export function setCallbacks(cb: EngineCallbacks): void {
  callbacks = cb;
}
