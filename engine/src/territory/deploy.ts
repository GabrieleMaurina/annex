import { callbacks } from '../callbacks';
import {
  depositTroopsOnOwnedTerritory,
  supplyHubTerritoryIds,
} from '../game/mechanics';
import { hasPlayableSet } from '../game/progression/cards';
import { bumpStat } from '../game/progression/stats';
import { advanceTurnPhase } from '../game/turns';
import { connectedOwnedTerritories } from '../game/world/connectivity';
import { fogFilterEmit } from '../game/world/fog';
import { visibleTerritoryIdsOrAll } from '../game/world/visibility';
import { GameResponse, requireGame } from '../session/context';
import { broadcastSelected, respondGameState } from '../session/store';
import { isNullableInteger } from '../util/validate';

export function selectTerritory(
  playerId: number,
  rawTerritoryId: unknown,
): GameResponse {
  const ctx = requireGame(playerId);
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  if (game.state !== 'playing') return { ok: false, error: 'game not started' };
  if (game.paused) return { ok: false, error: 'game paused' };
  if (game.playerIds[game.turnPlayerIndex] !== playerId)
    return { ok: false, error: 'not your turn' };
  if (!isNullableInteger(rawTerritoryId))
    return { ok: false, error: 'invalid territory' };
  const territoryId = rawTerritoryId;

  if (territoryId !== null) {
    if (!game.territoryOwners.has(territoryId))
      return { ok: false, error: 'invalid territory' };
    if (
      (game.turnPhase === 'deploy' ||
        game.turnPhase === 'troop' ||
        game.turnPhase === 'entrench' ||
        game.turnPhase === 'toxins') &&
      game.territoryOwners.get(territoryId) !== playerId
    )
      return { ok: false, error: 'territory not owned' };
    if (
      (game.turnPhase === 'deploy' || game.turnPhase === 'troop') &&
      game.supplyLines === 'on' &&
      !connectedOwnedTerritories(
        game,
        playerId,
        supplyHubTerritoryIds(game, playerId),
      ).has(territoryId)
    )
      return { ok: false, error: 'territory not connected to supply hub' };
  }

  game.selectedTerritoryId = territoryId;
  if (territoryId !== null) broadcastSelected(game, territoryId);
  return respondGameState(game, playerId);
}

export function deploy(
  playerId: number,
  territoryId: unknown,
  troops: unknown,
): GameResponse {
  const ctx = requireGame(playerId);
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  if (game.state !== 'playing') return { ok: false, error: 'game not started' };
  if (game.paused) return { ok: false, error: 'game paused' };
  if (game.playerIds[game.turnPlayerIndex] !== playerId)
    return { ok: false, error: 'not your turn' };
  if (game.turnPhase !== 'deploy')
    return { ok: false, error: 'not deploy phase' };

  const result = depositTroopsOnOwnedTerritory(
    game,
    playerId,
    territoryId,
    troops,
  );
  if ('error' in result) return { ok: false, error: result.error };

  bumpStat(game, playerId, 'troopsGained', result.troops);
  fogFilterEmit(game, 'game:deployed', callbacks.onDeployed, (viewerId) => {
    const visible = visibleTerritoryIdsOrAll(game, viewerId);
    if (visible !== null && !visible.has(result.territoryId)) return null;
    return { territoryId: result.territoryId, troops: result.troops, playerId };
  });
  const hand = game.playerCards.get(playerId) ?? [];
  if (
    game.troopsToDeploy <= 0 &&
    hand.length < 5 &&
    (game.deployCardMandate || !hasPlayableSet(hand))
  )
    advanceTurnPhase(game);

  return respondGameState(game, playerId);
}
