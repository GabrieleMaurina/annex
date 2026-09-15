import { callbacks } from '../../callbacks';
import { hasAnyAttack, hasAnyShipFight } from '../../game/combat/autoSkip';
import { attackSea as rollSeaAttack } from '../../game/combat/dice';
import { hasReadyNuke } from '../../game/nukes/nukes';
import { recordReplayFrame } from '../../game/replay';
import { gameState } from '../../game/state';
import { advanceTurnPhase } from '../../game/turns';
import { fogFilterEmit } from '../../game/world/fog';
import { isSeaTerritory, setSeaShips } from '../../game/world/seaShips';
import { visibleTerritoryIdsOrAll } from '../../game/world/visibility';
import { GameResponse, requireGame } from '../../session/context';
import { broadcastSelected, respondGameState } from '../../session/store';
import { isInteger, isNullableInteger } from '../../util/validate';

export type AttackSeaResultResponse =
  | {
      ok: true;
      game: ReturnType<typeof gameState>;
      attackerDice: number[];
      defenderDice: number[];
    }
  | { ok: false; error: string };

function requireAttackSeaTurn(playerId: number) {
  const ctx = requireGame(playerId);
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  if (game.state !== 'playing')
    return { ok: false as const, error: 'game not started' };
  if (game.paused) return { ok: false as const, error: 'game paused' };
  if (game.playerIds[game.turnPlayerIndex] !== playerId)
    return { ok: false as const, error: 'not your turn' };
  if (game.turnPhase !== 'attack')
    return { ok: false as const, error: 'not attack phase' };
  return ctx;
}

export function attackSeaSelectStart(
  playerId: number,
  rawTerritoryId: unknown,
): GameResponse {
  const ctx = requireAttackSeaTurn(playerId);
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  if (!isNullableInteger(rawTerritoryId))
    return { ok: false, error: 'invalid sea' };
  const territoryId = rawTerritoryId;

  if (territoryId !== null) {
    if (game.attackStartTerritoryId !== null)
      return { ok: false, error: 'land attack in progress' };
    if (!isSeaTerritory(game, territoryId))
      return { ok: false, error: 'invalid sea' };
    if ((game.seaShips.get(territoryId)?.get(playerId) ?? 0) < 1)
      return { ok: false, error: 'no ships there' };
  }

  game.attackSeaTerritoryId = territoryId;
  game.attackSeaDefenderId = null;
  if (territoryId !== null) broadcastSelected(game, territoryId);
  return respondGameState(game, playerId);
}

export function attackSeaSelectDefender(
  playerId: number,
  rawDefenderId: unknown,
): GameResponse {
  const ctx = requireAttackSeaTurn(playerId);
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  if (game.attackSeaTerritoryId === null)
    return { ok: false, error: 'no sea selected' };
  if (!isInteger(rawDefenderId))
    return { ok: false, error: 'invalid defender' };
  const defenderId = rawDefenderId;
  if (defenderId === playerId) return { ok: false, error: 'invalid defender' };
  const shipsByPlayer = game.seaShips.get(game.attackSeaTerritoryId);
  if ((shipsByPlayer?.get(defenderId) ?? 0) < 1)
    return { ok: false, error: 'invalid defender' };

  game.attackSeaDefenderId = defenderId;
  return respondGameState(game, playerId);
}

export function attackSea(
  playerId: number,
  rawShips: unknown,
): AttackSeaResultResponse {
  const ctx = requireAttackSeaTurn(playerId);
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  if (game.attackSeaTerritoryId === null || game.attackSeaDefenderId === null)
    return { ok: false, error: 'no attack selection' };
  if (!isInteger(rawShips)) return { ok: false, error: 'invalid ships' };
  const ships = rawShips;

  const seaTerritoryId = game.attackSeaTerritoryId;
  const defenderId = game.attackSeaDefenderId;
  const shipsByPlayer = game.seaShips.get(seaTerritoryId) ?? new Map();
  const attackingShips = shipsByPlayer.get(playerId) ?? 0;
  const defendingShips = shipsByPlayer.get(defenderId) ?? 0;
  const maxShips = Math.min(attackingShips, 3);

  if (ships < 1 || ships > maxShips)
    return { ok: false, error: 'invalid ships' };
  if (defendingShips < 1) return { ok: false, error: 'invalid defender' };

  const defendingDice = Math.min(defendingShips, game.defenceDice);
  const result = rollSeaAttack(ships, defendingDice);

  const remainingAttackers = attackingShips - result.attackLosses;
  const remainingDefenders = defendingShips - result.defenceLosses;
  setSeaShips(game, seaTerritoryId, playerId, remainingAttackers);
  setSeaShips(game, seaTerritoryId, defenderId, remainingDefenders);

  recordReplayFrame(game, {
    type: 'attackSea',
    seaTerritoryId,
    attackerId: playerId,
    defenderId,
    attackLosses: result.attackLosses,
    defenceLosses: result.defenceLosses,
  });

  fogFilterEmit(
    game,
    'game:seaAttacked',
    callbacks.onSeaAttacked,
    (viewerId) => {
      const visible = visibleTerritoryIdsOrAll(game, viewerId);
      if (
        visible !== null &&
        !visible.has(seaTerritoryId) &&
        viewerId !== defenderId
      )
        return null;
      return {
        seaTerritoryId,
        attackerId: playerId,
        defenderId,
        attackingShips: ships,
        attackLosses: result.attackLosses,
        defendingShips,
        defenceLosses: result.defenceLosses,
      };
    },
  );

  if (remainingAttackers <= 0 || remainingDefenders <= 0) {
    game.attackSeaTerritoryId = null;
    game.attackSeaDefenderId = null;
  }

  if (
    !hasAnyAttack(game, playerId) &&
    !hasReadyNuke(game, playerId) &&
    !hasAnyShipFight(game, playerId)
  ) {
    advanceTurnPhase(game);
  }

  const response = respondGameState(game, playerId);
  return {
    ...response,
    attackerDice: result.attackDice,
    defenderDice: result.defenceDice,
  };
}
