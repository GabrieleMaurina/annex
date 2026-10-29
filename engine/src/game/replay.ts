import {
  Game,
  ReplayAnimation,
  ReplayHand,
  ReplayPlayerState,
  ReplayPlayerStats,
  ReplaySeaShips,
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

function snapshotSeaShips(game: Game): ReplaySeaShips[] {
  const result: ReplaySeaShips[] = [];
  for (const [seaTerritoryId, shipsByPlayer] of game.seaShips) {
    for (const [playerId, ships] of shipsByPlayer) {
      result.push({ seaTerritoryId, playerId, ships });
    }
  }
  return result;
}

function actingPlayerId(animation: ReplayAnimation): number {
  return animation.type === 'attack' || animation.type === 'attackSea'
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
      points: game.points.get(playerId) ?? 0,
      nukes: arsenal.nukes,
      antiNukes: arsenal.antiNukes,
      nukeProjects: (game.nukeProjects.get(playerId) ?? []).map((p) => ({
        ...p,
      })),
    };
  });
}

function snapshotPlayerStats(game: Game): ReplayPlayerStats[] {
  return game.playerIds.map((playerId) => {
    const s = game.stats.get(playerId);
    return {
      playerId,
      troopsGained: s?.troopsGained ?? 0,
      troopsKilled: s?.troopsKilled ?? 0,
      troopsLost: s?.troopsLost ?? 0,
      territoriesConquered: s?.territoriesConquered ?? 0,
      territoriesLost: s?.territoriesLost ?? 0,
      capitalsConquered: s?.capitalsConquered ?? 0,
      capitalsLost: s?.capitalsLost ?? 0,
      cardsGained: s?.cardsGained ?? 0,
      setsPlayed: s?.setsPlayed ?? 0,
    };
  });
}

export function refreshLastReplayPlayerStates(game: Game) {
  const lastFrame = game.replayFrames[game.replayFrames.length - 1];
  if (!lastFrame) return;
  lastFrame.playerStates = snapshotPlayerStates(game);
  lastFrame.playerStats = snapshotPlayerStats(game);
}

export function recordReplayFrame(game: Game, animation: ReplayAnimation) {
  game.replayFrames.push({
    territories: snapshotTerritories(game),
    toxinTerritories: snapshotToxinTerritories(game),
    radiationTerritories: snapshotRadiationTerritories(game),
    radiationUpcoming: [...game.radiationUpcomingTerritoryIds],
    seaShips: snapshotSeaShips(game),
    hands: snapshotHands(game),
    playerStates: snapshotPlayerStates(game),
    playerStats: snapshotPlayerStats(game),
    turnPhase: game.turnPhase,
    animation,
    roundNumber: game.roundNumber,
    playerId: actingPlayerId(animation),
  });
}
