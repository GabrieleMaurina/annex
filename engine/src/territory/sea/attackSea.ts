import { callbacks } from '../../callbacks';
import { hasAnyAttack, hasAnyShipFight } from '../../game/combat/autoSkip';
import {
  balancedBlitz,
  balancedWinProbs,
  fairBlitz,
  fairBlitzOutcomes,
  attackSea as rollSeaAttack,
  trueBlitz,
  trueWinProbs,
} from '../../game/combat/dice';
import { hasReadyNuke } from '../../game/nukes/nukes';
import { recordReplayFrame } from '../../game/replay';
import { gameState } from '../../game/state';
import { advanceTurnPhase } from '../../game/turns';
import { fogFilterEmit } from '../../game/world/fog';
import { isSeaTerritory, setSeaShips } from '../../game/world/seaShips';
import { visibleTerritoryIdsOrAll } from '../../game/world/visibility';
import { GameResponse, requireGame } from '../../session/context';
import { broadcastSelected, respondGameState } from '../../session/store';
import { Game } from '../../types';
import { isInteger, isNullableInteger } from '../../util/validate';
import { BlitzOutcome, isAttackType } from '../attack';

export type AttackSeaProbabilitiesResponse =
  | {
      ok: true;
      game: ReturnType<typeof gameState>;
      blitzWinProbabilities: number[];
      blitzOutcomes?: BlitzOutcome[];
    }
  | { ok: false; error: string };

export type AttackSeaResultResponse =
  | {
      ok: true;
      game: ReturnType<typeof gameState>;
      blitzWinProbabilities: number[];
      blitzOutcomes?: BlitzOutcome[];
      attackerDice: number[];
      defenderDice: number[];
    }
  | { ok: false; error: string };

function computeSeaBlitzWinProbabilities(
  game: Game,
  attackingShips: number,
  defendingShips: number,
  defendingDice: number,
): number[] {
  if (game.blitz === 'Off') return new Array<number>(attackingShips).fill(0);
  if (game.blitz === 'Fair')
    return trueWinProbs(
      attackingShips,
      defendingShips,
      defendingDice,
      false,
    ).map((p) => (p >= 0.5 ? 1 : 0));
  const blitzWinProbs = game.blitz === 'True' ? trueWinProbs : balancedWinProbs;
  return blitzWinProbs(attackingShips, defendingShips, defendingDice, false);
}

function computeSeaBlitzOutcomes(
  game: Game,
  attackingShips: number,
  defendingShips: number,
  defendingDice: number,
): BlitzOutcome[] | undefined {
  if (game.blitz !== 'Fair') return undefined;
  return fairBlitzOutcomes(
    attackingShips,
    defendingShips,
    defendingDice,
    false,
  );
}

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
): AttackSeaProbabilitiesResponse {
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

  const attackingShips = shipsByPlayer?.get(playerId) ?? 0;
  const defendingShips = shipsByPlayer?.get(defenderId) ?? 0;
  const defendingDice = Math.min(defendingShips, game.defenceDice);
  const blitzWinProbabilities = computeSeaBlitzWinProbabilities(
    game,
    attackingShips,
    defendingShips,
    defendingDice,
  );
  const blitzOutcomes = computeSeaBlitzOutcomes(
    game,
    attackingShips,
    defendingShips,
    defendingDice,
  );

  const response = respondGameState(game, playerId);
  return {
    ...response,
    blitzWinProbabilities,
    ...(blitzOutcomes ? { blitzOutcomes } : {}),
  };
}

export function attackSea(
  playerId: number,
  rawType: unknown,
  rawShips: unknown,
): AttackSeaResultResponse {
  const ctx = requireAttackSeaTurn(playerId);
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  if (game.attackSeaTerritoryId === null || game.attackSeaDefenderId === null)
    return { ok: false, error: 'no attack selection' };
  if (!isAttackType(rawType))
    return { ok: false, error: 'invalid attack type' };
  const type = rawType;
  if (type === 'blitz' && game.blitz === 'Off')
    return { ok: false, error: 'blitz disabled' };

  const seaTerritoryId = game.attackSeaTerritoryId;
  const defenderId = game.attackSeaDefenderId;
  const shipsByPlayer = game.seaShips.get(seaTerritoryId) ?? new Map();
  const attackingShips = shipsByPlayer.get(playerId) ?? 0;
  const defendingShips = shipsByPlayer.get(defenderId) ?? 0;
  const maxShips =
    type === 'regular' ? Math.min(attackingShips, 3) : attackingShips;

  if (!isInteger(rawShips)) return { ok: false, error: 'invalid ships' };
  const ships = rawShips;
  if (ships < 1 || ships > maxShips)
    return { ok: false, error: 'invalid ships' };
  if (defendingShips < 1) return { ok: false, error: 'invalid defender' };

  const defendingDice = Math.min(defendingShips, game.defenceDice);
  let attackLosses: number;
  let defenceLosses: number;
  let attackerDice: number[] = [];
  let defenderDice: number[] = [];
  if (type === 'regular') {
    const result = rollSeaAttack(ships, defendingDice);
    attackLosses = result.attackLosses;
    defenceLosses = result.defenceLosses;
    attackerDice = result.attackDice;
    defenderDice = result.defenceDice;
  } else {
    const blitz =
      game.blitz === 'True'
        ? trueBlitz
        : game.blitz === 'Fair'
          ? fairBlitz
          : balancedBlitz;
    const result = blitz(ships, defendingShips, defendingDice, false);
    attackLosses = result.attackLosses;
    defenceLosses = result.defenceLosses;
  }

  const remainingAttackers = attackingShips - attackLosses;
  const remainingDefenders = defendingShips - defenceLosses;
  setSeaShips(game, seaTerritoryId, playerId, remainingAttackers);
  setSeaShips(game, seaTerritoryId, defenderId, remainingDefenders);

  recordReplayFrame(game, {
    type: 'attackSea',
    seaTerritoryId,
    attackerId: playerId,
    defenderId,
    attackLosses,
    defenceLosses,
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
        type,
        attackingShips: ships,
        attackLosses,
        defendingShips,
        defenceLosses,
      };
    },
  );

  let blitzWinProbabilities: number[] = [];
  let blitzOutcomes: BlitzOutcome[] | undefined;
  if (remainingAttackers > 0 && remainingDefenders > 0) {
    const remainingDefendingDice = Math.min(
      remainingDefenders,
      game.defenceDice,
    );
    blitzWinProbabilities = computeSeaBlitzWinProbabilities(
      game,
      remainingAttackers,
      remainingDefenders,
      remainingDefendingDice,
    );
    blitzOutcomes = computeSeaBlitzOutcomes(
      game,
      remainingAttackers,
      remainingDefenders,
      remainingDefendingDice,
    );
  } else {
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
    blitzWinProbabilities,
    ...(blitzOutcomes ? { blitzOutcomes } : {}),
    attackerDice,
    defenderDice,
  };
}
