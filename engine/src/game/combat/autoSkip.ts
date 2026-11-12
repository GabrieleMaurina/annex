import { getGameMap } from '../../maps/maps';
import { Game, TurnPhase } from '../../types';
import { ownedTerritoryIds } from '../mechanics';
import { hasReadyNuke } from '../nukes/nukes';
import { hasPlayableSet } from '../progression/cards';
import { canUnlockFrom } from '../tiles/unlock';
import {
  isFreeConquestTarget,
  isPermanentToxinOnHill,
  toxinsCost,
  wouldSplitMap,
} from '../toxins/toxins';
import {
  connectedSeaTerritories,
  hasConnectedFortifyDestination,
} from '../world/connectivity';
import { withPortalEdges } from '../world/portals';
import { canBuyShipsFromTerritory } from '../world/seaShips';
import { canFlipFrom } from '../world/switches';
import { hasAnySeaBridgeFrom } from './seaBridge';

export function isAttackStartCandidate(
  game: Game,
  playerId: number,
  territoryId: number,
): boolean {
  if ((game.territoryTroops.get(territoryId) ?? 0) < 2) return false;
  const map = getGameMap(game);
  const territory = map.territories.find((t) => t.id === territoryId);
  const neighbors = withPortalEdges(
    territory?.neighbors ?? [],
    territoryId,
    game.portalTerritoryIds,
    game.portalsEnabled,
  );
  return (
    neighbors.some((n) => {
      const ownerId = game.territoryOwners.get(n);
      if (ownerId !== undefined) return ownerId !== playerId;
      return isFreeConquestTarget(game, n);
    }) ||
    hasAnySeaBridgeFrom(game, playerId, territoryId) ||
    canUnlockFrom(game, playerId, territoryId) ||
    canFlipFrom(game, playerId, territoryId)
  );
}

export function hasAnyDeploy(game: Game, playerId: number): boolean {
  const hand = game.playerCards.get(playerId) ?? [];
  return (
    game.troopsToDeploy > 0 ||
    hand.length >= 5 ||
    (!game.deployCardMandate && hasPlayableSet(hand)) ||
    canBuyShipsFromTerritory(game, playerId)
  );
}

export function hasAnyAttack(game: Game, playerId: number): boolean {
  return ownedTerritoryIds(game, playerId).some((id) =>
    isAttackStartCandidate(game, playerId, id),
  );
}

export function hasAnyToxin(game: Game, playerId: number): boolean {
  if (game.toxins === 'off') return false;
  const owned = ownedTerritoryIds(game, playerId);
  if (owned.length <= 1) return false;
  const cost = toxinsCost(game, playerId);
  return owned.some((id) => {
    if (game.capitalTerritoryIds.has(id)) return false;
    if (isPermanentToxinOnHill(game, id)) return false;
    if ((game.territoryTroops.get(id) ?? 0) < cost) return false;
    return !wouldSplitMap(game, id);
  });
}

export function hasAnyFortify(game: Game, playerId: number): boolean {
  const map = getGameMap(game);
  const territoryById = new Map(map.territories.map((t) => [t.id, t]));
  return ownedTerritoryIds(game, playerId).some((id) => {
    if ((game.territoryTroops.get(id) ?? 0) < 2) return false;
    if (game.fortification === 'connected')
      return hasConnectedFortifyDestination(game, playerId, id);
    return withPortalEdges(
      territoryById.get(id)?.neighbors ?? [],
      id,
      game.portalTerritoryIds,
      game.portalsEnabled,
    ).some((n) => game.territoryOwners.get(n) === playerId);
  });
}

export function hasAnyEntrench(game: Game, playerId: number): boolean {
  return ownedTerritoryIds(game, playerId).some(
    (id) =>
      (game.territoryTroops.get(id) ?? 0) >= 2 &&
      !game.capitalTerritoryIds.has(id),
  );
}

export function hasAnySail(game: Game, playerId: number): boolean {
  for (const [seaTerritoryId, shipsByPlayer] of game.seaShips) {
    if ((shipsByPlayer.get(playerId) ?? 0) < 1) continue;
    if (connectedSeaTerritories(game, [seaTerritoryId]).size > 1) return true;
  }
  return false;
}

export function hasAnyShipFight(game: Game, playerId: number): boolean {
  for (const shipsByPlayer of game.seaShips.values()) {
    if ((shipsByPlayer.get(playerId) ?? 0) < 1) continue;
    for (const [otherId, ships] of shipsByPlayer) {
      if (otherId !== playerId && ships > 0) return true;
    }
  }
  return false;
}

export function phaseHasAction(
  game: Game,
  playerId: number,
  phase: TurnPhase,
): boolean {
  switch (phase) {
    case 'deploy':
      return hasAnyDeploy(game, playerId);
    case 'sail':
      return hasAnySail(game, playerId);
    case 'attack':
      return (
        hasAnyAttack(game, playerId) ||
        hasReadyNuke(game, playerId) ||
        hasAnyShipFight(game, playerId)
      );
    case 'fortify':
      return hasAnyFortify(game, playerId);
    case 'entrench':
      return game.entrenchments === 'on' && hasAnyEntrench(game, playerId);
    case 'toxins':
      return game.toxins !== 'off' && hasAnyToxin(game, playerId);
    default:
      return false;
  }
}

export function canReturnPhase(game: Game): boolean {
  const entry = game.phaseTrail[game.phaseTrail.length - 1];
  if (
    game.state !== 'playing' ||
    !entry ||
    entry.replayFrames !== game.replayFrames.length
  )
    return false;
  const playerId = game.playerIds[game.turnPlayerIndex];
  return phaseHasAction(game, playerId, entry.phase);
}
