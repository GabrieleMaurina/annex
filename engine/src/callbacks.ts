import {
  Card,
  EmojiAttackTarget,
  EmojiValue,
  GameLogEvent,
  Mission,
} from './types';

export interface EngineCallbacks {
  onHomeGames(playerId: number, games: unknown[]): void;
  onGameState(playerId: number, state: unknown): void;
  onCards(playerId: number, payload: { cards: Card[] }): void;
  onMission(playerId: number, payload: { mission: Mission }): void;
  onLogs(playerId: number, payload: { entries: GameLogEvent[] }): void;
  onResults(playerId: number, payload: { stats: unknown[] }): void;
  onCardSetPlayed(
    playerId: number,
    payload: {
      playerId: number;
      troops: number;
      cards: Card[];
      territoryBonusCount: number;
    },
  ): void;
  onKicked(playerId: number, payload: { gameName: string }): void;
  onChatMessage(
    playerId: number,
    payload: { id: number; name: string; message: string },
  ): void;
  onEmojiSent(
    playerId: number,
    payload: {
      senderId: number;
      targetPlayerId: number | undefined;
      emoji: EmojiValue;
      attackTarget: EmojiAttackTarget | undefined;
    },
  ): void;
  onAllianceRequested(playerId: number, payload: { fromId: number }): void;
  onAllianceFormed(playerId: number, payload: { withId: number }): void;
  onAllianceDeclined(playerId: number, payload: { withId: number }): void;
  onAllianceTerminated(playerId: number, payload: { withId: number }): void;
  onCapitalPlacementStarted(playerId: number): void;
  onTerritoryClaimed(
    playerId: number,
    payload: { territoryId: number; playerId: number },
  ): void;
  onTurnStarted(
    playerId: number,
    payload: {
      playerId: number;
      turnNumber: number;
      troopsFromTerritories: number;
      troopsFromBonuses: number;
      troopsFromCapitals: number;
      troopsFromTurnTroops: number;
      troopsFromBounties: number;
    },
  ): void;
  onDeployed(
    playerId: number,
    payload: { territoryId: number; troops: number; playerId: number },
  ): void;
  onDeployedMany(
    playerId: number,
    payload: {
      deposits: { territoryId: number; troops: number }[];
      playerId: number;
    },
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
  ): void;
  onEntrenched(
    playerId: number,
    payload: {
      territoryId: number;
      troops: number;
      turnsRemaining: number;
      playerId: number;
    },
  ): void;
  onToxined(
    playerId: number,
    payload: {
      territoryId: number;
      permanent: boolean;
      turnsRemaining: number;
      playerId: number;
    },
  ): void;
  onToxinExpired(playerId: number, payload: { territoryIds: number[] }): void;
  onRadiationUpcoming(
    playerId: number,
    payload: { territoryIds: number[] },
  ): void;
  onRadiationChanged(
    playerId: number,
    payload: {
      territoryIds: number[];
      eliminatedPlayerIds: number[];
      newlyRadiatedIds: number[];
    },
  ): void;
  onStarved(
    playerId: number,
    payload: { losses: { territoryId: number; troops: number }[] },
  ): void;
  onAttacked(
    playerId: number,
    payload: {
      attackingTerritoryId: number;
      defendingTerritoryId: number;
      attackerId: number;
      type: 'regular' | 'blitz';
      attackingTroops?: number;
      attackLosses?: number;
      defenderId?: number;
      defendingTroops?: number;
      defenceLosses?: number;
      conquered?: boolean;
    },
  ): void;
  onTankFired(
    playerId: number,
    payload: { type: 'regular' | 'blitz'; hasDefender: boolean },
  ): void;
  onAttackMoved(
    playerId: number,
    payload: {
      territoryId: number;
      fromTerritoryId: number;
      troopsRemoved?: number;
      troopsAdded?: number;
    },
  ): void;
  onSelected(playerId: number, payload: { territoryId: number }): void;
  onMapGenerated(
    playerId: number,
    payload: {
      name: string;
      displayName: string;
      territories: unknown[];
      bonuses: number[];
      imageSrc: string;
    },
  ): void;

  // Infrastructure-only: not a wire event. Fired whenever a THIRD PARTY's
  // (not the acting caller's) socket-room membership must change as a side
  // effect (kick, eviction, game rename). null means "back to the lobby".
  onRoomChanged(playerId: number, gameName: string | null): void;
}

export let callbacks: EngineCallbacks;

export function setCallbacks(cb: EngineCallbacks): void {
  callbacks = cb;
}
