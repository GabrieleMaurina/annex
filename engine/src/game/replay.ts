import {
  Game,
  ReplayAnimation,
  ReplayHand,
  ReplayPlayerState,
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

function snapshotPlayerStates(game: Game): ReplayPlayerState[] {
  return game.playerIds.map((playerId) => {
    const arsenal = game.arsenal.get(playerId) ?? { nukes: 0, antiNukes: 0 };
    return {
      playerId,
      eliminated: game.deathOrder.includes(playerId),
      surrendered: game.surrenderedIds.has(playerId),
      killedPlayerIds: [...(game.stats.get(playerId)?.playersKilled ?? [])],
      nukes: arsenal.nukes,
      antiNukes: arsenal.antiNukes,
      nukeProjects: (game.nukeProjects.get(playerId) ?? []).map((p) => ({
        ...p,
      })),
    };
  });
}

export function recordReplayFrame(game: Game, animation: ReplayAnimation) {
  game.replayFrames.push({
    territories: snapshotTerritories(game),
    toxinTerritories: snapshotToxinTerritories(game),
    radiationTerritories: snapshotRadiationTerritories(game),
    radiationUpcoming: [...game.radiationUpcomingTerritoryIds],
    hands: snapshotHands(game),
    playerStates: snapshotPlayerStates(game),
    turnPhase: game.turnPhase,
    animation,
    roundNumber: game.roundNumber,
    playerId: actingPlayerId(animation),
  });
}
