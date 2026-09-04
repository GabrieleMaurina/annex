import {
  Game,
  ReplayAnimation,
  ReplayHand,
  ReplayTerritory,
  ReplayToxinTerritory,
} from '../types';

export function snapshotTerritories(game: Game): ReplayTerritory[] {
  return [...game.territoryOwners.entries()].map(([id, ownerId]) => ({
    id,
    ownerId,
    troops: game.territoryTroops.get(id) ?? 0,
    entrenchedTurns: game.territoryEntrenchment.get(id) ?? 0,
  }));
}

function snapshotToxinTerritories(game: Game): ReplayToxinTerritory[] {
  return [...game.territoryToxins.entries()].map(([id, toxin]) => ({
    id,
    permanent: toxin.permanent,
    roundsRemaining: toxin.roundsRemaining,
  }));
}

function snapshotRadiationTerritories(game: Game): number[] {
  return [...game.radiationTerritoryIds];
}

function actingPlayerId(animation: ReplayAnimation): number {
  return animation.type === 'attack'
    ? animation.attackerId
    : animation.playerId;
}

function snapshotHands(game: Game): ReplayHand[] {
  return game.playerIds.map((playerId) => ({
    playerId,
    cards: (game.playerCards.get(playerId) ?? []).map((card) => ({ ...card })),
  }));
}

export function recordReplayFrame(game: Game, animation: ReplayAnimation) {
  game.replayFrames.push({
    territories: snapshotTerritories(game),
    toxinTerritories: snapshotToxinTerritories(game),
    radiationTerritories: snapshotRadiationTerritories(game),
    radiationUpcoming: [...game.radiationUpcomingTerritoryIds],
    hands: snapshotHands(game),
    turnPhase: game.turnPhase,
    animation,
    roundNumber: game.roundNumber,
    playerId: actingPlayerId(animation),
  });
}
