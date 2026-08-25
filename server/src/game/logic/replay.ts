import {
  Game,
  ReplayAnimation,
  ReplayTerritory,
  ReplayToxinTerritory,
} from '../../types';

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
    turnsRemaining: toxin.turnsRemaining,
  }));
}

function actingPlayerId(animation: ReplayAnimation): number {
  return animation.type === 'attack'
    ? animation.attackerId
    : animation.playerId;
}

export function recordReplayFrame(game: Game, animation: ReplayAnimation) {
  game.replayFrames.push({
    territories: snapshotTerritories(game),
    toxinTerritories: snapshotToxinTerritories(game),
    animation,
    turnNumber: game.turnNumber,
    playerId: actingPlayerId(animation),
  });
}
