import { callbacks } from '../callbacks';
import { hasAnyAttack } from '../game/combat/autoSkip';
import {
  balancedBlitz,
  balancedWinProbs,
  attack as rollAttack,
  trueBlitz,
  trueWinProbs,
} from '../game/combat/dice';
import { checkGameEnd } from '../game/end';
import { recordElimination } from '../game/progression/stats';
import { recordReplayFrame } from '../game/replay';
import { gameState } from '../game/state';
import { isFreeConquestTarget } from '../game/toxins/toxins';
import { advanceTurnPhase, rewindTurnTimerIfBelowHalf } from '../game/turns';
import { fogFilterEmit } from '../game/world/fog';
import { withPortalEdges } from '../game/world/portals';
import {
  troopMoveFields,
  visibleTerritoryIdsOrAll,
} from '../game/world/visibility';
import { getGameMap } from '../maps/maps';
import { GameContext, GameResponse, requireGame } from '../session/context';
import {
  broadcastSelected,
  respondGameState,
  sendPlayerCards,
} from '../session/store';
import { Game } from '../types';
import { isInteger, isNullableInteger } from '../util/validate';

export type AttackProbabilitiesResponse =
  | {
      ok: true;
      game: ReturnType<typeof gameState>;
      blitzWinProbabilities: number[];
    }
  | { ok: false; error: string };

export type AttackResultResponse =
  | {
      ok: true;
      game: ReturnType<typeof gameState>;
      blitzWinProbabilities: number[];
      attackerDice: number[];
      defenderDice: number[];
    }
  | { ok: false; error: string };

function defenceDiceFor(game: Game, territoryId: number): number {
  if (game.capitalTerritoryIds.has(territoryId)) return 3;
  if ((game.territoryEntrenchment.get(territoryId) ?? 0) > 0) return 3;
  return game.defenceDice;
}

function computeBlitzWinProbabilities(
  game: Game,
  attackingTroops: number,
  defendingTroops: number,
  defendingDice: number,
): number[] {
  const maxBlitz = attackingTroops - 1;
  const blitzWinProbs = game.blitz === 'True' ? trueWinProbs : balancedWinProbs;
  return blitzWinProbs(maxBlitz, defendingTroops, defendingDice);
}

function isAttackStartCandidate(
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
  return neighbors.some((n) => {
    const ownerId = game.territoryOwners.get(n);
    if (ownerId !== undefined) return ownerId !== playerId;
    return isFreeConquestTarget(game, n);
  });
}

function isAttackEndCandidate(
  game: Game,
  playerId: number,
  startId: number,
  territoryId: number,
): boolean {
  const ownerId = game.territoryOwners.get(territoryId);
  if (ownerId === playerId) return false;
  if (ownerId === undefined && !isFreeConquestTarget(game, territoryId))
    return false;
  const map = getGameMap(game);
  const territory = map.territories.find((t) => t.id === startId);
  const neighbors = withPortalEdges(
    territory?.neighbors ?? [],
    startId,
    game.portalTerritoryIds,
    game.portalsEnabled,
  );
  return neighbors.includes(territoryId);
}

function hasPendingConquest(game: Game, playerId: number): boolean {
  return (
    game.attackEndTerritoryId !== null &&
    game.territoryOwners.get(game.attackEndTerritoryId) === playerId
  );
}

function requirePlayingTurn(ctx: GameContext, phase: Game['turnPhase']) {
  if (!ctx.ok) return ctx;
  const { game, playerId } = ctx;
  if (game.state !== 'playing')
    return { ok: false as const, error: 'game not started' };
  if (game.paused) return { ok: false as const, error: 'game paused' };
  if (game.playerIds[game.turnPlayerIndex] !== playerId)
    return { ok: false as const, error: 'not your turn' };
  if (game.turnPhase !== phase)
    return { ok: false as const, error: `not ${phase} phase` };
  return ctx;
}

function isAttackType(value: unknown): value is 'regular' | 'blitz' {
  return value === 'regular' || value === 'blitz';
}

export function attackSelectStart(
  playerId: number,
  rawTerritoryId: unknown,
): GameResponse {
  const ctx = requirePlayingTurn(requireGame(playerId), 'attack');
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  if (hasPendingConquest(game, playerId))
    return { ok: false, error: 'pending conquest move' };
  if (!isNullableInteger(rawTerritoryId))
    return { ok: false, error: 'invalid territory' };
  const territoryId = rawTerritoryId;

  if (territoryId !== null) {
    if (!game.territoryOwners.has(territoryId))
      return { ok: false, error: 'invalid territory' };
    if (game.territoryOwners.get(territoryId) !== playerId)
      return { ok: false, error: 'territory not owned' };
    if (!isAttackStartCandidate(game, playerId, territoryId))
      return { ok: false, error: 'invalid start territory' };
  }

  game.attackStartTerritoryId = territoryId;
  game.attackEndTerritoryId = null;
  game.attackConquestMinTroops = null;
  if (territoryId !== null) broadcastSelected(game, territoryId);
  return respondGameState(game, playerId);
}

export function attackSelectEnd(
  playerId: number,
  rawTerritoryId: unknown,
): AttackProbabilitiesResponse {
  const ctx = requirePlayingTurn(requireGame(playerId), 'attack');
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  if (game.attackStartTerritoryId === null)
    return { ok: false, error: 'no start territory selected' };
  if (!isInteger(rawTerritoryId))
    return { ok: false, error: 'invalid territory' };
  const territoryId = rawTerritoryId;
  if (
    !isAttackEndCandidate(
      game,
      playerId,
      game.attackStartTerritoryId,
      territoryId,
    )
  )
    return { ok: false, error: 'invalid end territory' };

  game.attackEndTerritoryId = territoryId;

  const attackingTroops =
    game.territoryTroops.get(game.attackStartTerritoryId) ?? 0;
  const defendingTroops = game.territoryTroops.get(territoryId) ?? 0;
  const blitzWinProbabilities = computeBlitzWinProbabilities(
    game,
    attackingTroops,
    defendingTroops,
    defenceDiceFor(game, territoryId),
  );

  broadcastSelected(game, territoryId);
  const response = respondGameState(game, playerId);
  return { ...response, blitzWinProbabilities };
}

export function attack(
  playerId: number,
  rawType: unknown,
  rawTroops: unknown,
): AttackResultResponse {
  const ctx = requirePlayingTurn(requireGame(playerId), 'attack');
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  if (
    game.attackStartTerritoryId === null ||
    game.attackEndTerritoryId === null
  )
    return { ok: false, error: 'no attack selection' };
  if (hasPendingConquest(game, playerId))
    return { ok: false, error: 'territory already conquered' };
  if (!isAttackType(rawType))
    return { ok: false, error: 'invalid attack type' };
  const type = rawType;

  const startId = game.attackStartTerritoryId;
  const endId = game.attackEndTerritoryId;
  const attackingTroops = game.territoryTroops.get(startId) ?? 0;
  const maxTroops =
    type === 'regular' ? Math.min(attackingTroops - 1, 3) : attackingTroops - 1;
  if (!isInteger(rawTroops)) return { ok: false, error: 'invalid troops' };
  const troops = rawTroops;
  if (troops < 1 || troops > maxTroops)
    return { ok: false, error: 'invalid troops' };

  const defendingTroops = game.territoryTroops.get(endId) ?? 0;
  const defenderId = game.territoryOwners.get(endId);
  let attackLosses: number;
  let defenceLosses: number;
  let attackerDice: number[] = [];
  let defenderDice: number[] = [];
  const defendingDice = defenceDiceFor(game, endId);
  if (defenderId === undefined) {
    attackLosses = 0;
    defenceLosses = 0;
  } else if (type === 'regular') {
    const result = rollAttack(troops, Math.min(defendingTroops, defendingDice));
    attackLosses = result.attackLosses;
    defenceLosses = result.defenceLosses;
    attackerDice = result.attackDice;
    defenderDice = result.defenceDice;
  } else {
    const result = (game.blitz === 'True' ? trueBlitz : balancedBlitz)(
      troops,
      defendingTroops,
      defendingDice,
    );
    attackLosses = result.attackLosses;
    defenceLosses = result.defenceLosses;
  }

  game.territoryTroops.set(startId, attackingTroops - attackLosses);
  game.territoryTroops.set(endId, Math.max(0, defendingTroops - defenceLosses));
  const attackerStats = game.stats.get(playerId)!;
  const defenderStats =
    defenderId !== undefined ? game.stats.get(defenderId) : undefined;
  attackerStats.troopsLost += attackLosses;
  attackerStats.troopsKilled += defenceLosses;
  if (defenderStats) {
    defenderStats.troopsLost += defenceLosses;
    defenderStats.troopsKilled += attackLosses;
  }

  const conquered = defenceLosses >= defendingTroops;
  if (conquered) {
    game.territoryOwners.set(endId, playerId);
    game.territoryEntrenchment.delete(endId);
    game.territoryToxins.delete(endId);
  }
  recordReplayFrame(game, {
    type: 'attack',
    attackingTerritoryId: startId,
    defendingTerritoryId: endId,
    attackerId: playerId,
    defenderId,
    attackLosses,
    defenceLosses,
  });

  let blitzWinProbabilities: number[] = [];
  let autoConquestMove: {
    territoryId: number;
    fromTerritoryId: number;
    troops: number;
  } | null = null;
  if (conquered) {
    game.conqueredThisTurn = true;
    attackerStats.territoriesConquered++;
    if (game.capitalTerritoryIds.has(endId)) attackerStats.capitalsConquered++;
    if (defenderStats) {
      defenderStats.territoriesLost++;
      if (game.capitalTerritoryIds.has(endId)) defenderStats.capitalsLost++;
    }
    const defenderEliminated =
      defenderId !== undefined
        ? recordElimination(game, defenderId, playerId)
        : false;
    checkGameEnd(game);
    if (game.state === 'playing') {
      const remainingAttackers = attackingTroops - attackLosses;
      const minMoveTroops = Math.min(troops, 3, remainingAttackers - 1);

      if (defenderEliminated && defenderId !== undefined) {
        const defenderHand = game.playerCards.get(defenderId) ?? [];
        const attackerHand = game.playerCards.get(playerId) ?? [];
        attackerHand.push(...defenderHand);
        game.playerCards.set(defenderId, []);
        attackerStats.cardsGained += defenderHand.length;
        if (defenderHand.length > 0) {
          sendPlayerCards(game, playerId);
          sendPlayerCards(game, defenderId);
        }
      }
      game.attackConquestMinTroops = minMoveTroops;
    } else {
      const remainingAttackers = attackingTroops - attackLosses;
      game.territoryTroops.set(startId, 0);
      game.territoryTroops.set(endId, remainingAttackers);
      recordReplayFrame(game, {
        type: 'fortify',
        fromTerritoryId: startId,
        toTerritoryId: endId,
        troops: remainingAttackers,
        playerId,
      });
      autoConquestMove = {
        territoryId: endId,
        fromTerritoryId: startId,
        troops: remainingAttackers,
      };
    }
  } else {
    const remainingAttackers = attackingTroops - attackLosses;
    const remainingDefenders = defendingTroops - defenceLosses;
    if (remainingAttackers > 1) {
      blitzWinProbabilities = computeBlitzWinProbabilities(
        game,
        remainingAttackers,
        remainingDefenders,
        defendingDice,
      );
    } else {
      game.attackStartTerritoryId = null;
      game.attackEndTerritoryId = null;
    }
  }

  fogFilterEmit(game, 'game:attacked', callbacks.onAttacked, (viewerId) => {
    const visible = visibleTerritoryIdsOrAll(game, viewerId);
    const sourceVisible = visible === null || visible.has(startId);
    const targetVisible =
      visible === null || visible.has(endId) || viewerId === defenderId;
    if (!sourceVisible && !targetVisible) return null;
    return {
      attackingTerritoryId: startId,
      defendingTerritoryId: endId,
      attackerId: playerId,
      type,
      ...(sourceVisible ? { attackingTroops: troops, attackLosses } : {}),
      ...(targetVisible
        ? { defenderId, defendingTroops, defenceLosses, conquered }
        : {}),
    };
  });
  for (const viewerId of [...game.playerIds, ...game.spectatorIds]) {
    callbacks.onTankFired(viewerId, {
      type,
      hasDefender: defenderId !== undefined,
    });
  }
  if (autoConquestMove) {
    const move = autoConquestMove;
    fogFilterEmit(
      game,
      'game:attackMoved',
      callbacks.onAttackMoved,
      (viewerId) => {
        const visible = visibleTerritoryIdsOrAll(game, viewerId);
        if (
          visible !== null &&
          !visible.has(move.territoryId) &&
          !visible.has(move.fromTerritoryId)
        )
          return null;
        return {
          territoryId: move.territoryId,
          fromTerritoryId: move.fromTerritoryId,
          ...troopMoveFields(
            visible,
            move.fromTerritoryId,
            move.territoryId,
            move.troops,
          ),
        };
      },
    );
  }

  if (
    game.state === 'playing' &&
    game.turnPhase === 'attack' &&
    game.attackConquestMinTroops === null &&
    !hasAnyAttack(game, playerId)
  ) {
    advanceTurnPhase(game);
  }

  const response = respondGameState(game, playerId);
  return { ...response, blitzWinProbabilities, attackerDice, defenderDice };
}

export function attackMove(playerId: number, rawTroops: unknown): GameResponse {
  const ctx = requirePlayingTurn(requireGame(playerId), 'attack');
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  if (!hasPendingConquest(game, playerId))
    return { ok: false, error: 'no pending conquest' };

  const startId = game.attackStartTerritoryId!;
  const endId = game.attackEndTerritoryId!;
  const startTroops = game.territoryTroops.get(startId) ?? 0;
  const min = game.attackConquestMinTroops ?? 1;
  const max = startTroops - 1;

  if (!isInteger(rawTroops)) return { ok: false, error: 'invalid troops' };
  const troops = rawTroops;
  if (troops < min || troops > max)
    return { ok: false, error: 'invalid troops' };

  game.territoryTroops.set(startId, startTroops - troops);
  game.territoryTroops.set(endId, troops);
  recordReplayFrame(game, {
    type: 'fortify',
    fromTerritoryId: startId,
    toTerritoryId: endId,
    troops,
    playerId,
  });
  game.attackStartTerritoryId = null;
  game.attackEndTerritoryId = null;
  game.attackConquestMinTroops = null;

  fogFilterEmit(
    game,
    'game:attackMoved',
    callbacks.onAttackMoved,
    (viewerId) => {
      const visible = visibleTerritoryIdsOrAll(game, viewerId);
      if (visible !== null && !visible.has(endId) && !visible.has(startId))
        return null;
      return {
        territoryId: endId,
        fromTerritoryId: startId,
        ...troopMoveFields(visible, startId, endId, troops),
      };
    },
  );
  if ((game.playerCards.get(playerId)?.length ?? 0) >= 5) {
    game.turnPhase = 'deploy';
    game.deployCardMandate = true;
    rewindTurnTimerIfBelowHalf(game);
  } else if (!hasAnyAttack(game, playerId)) {
    advanceTurnPhase(game);
  }

  return respondGameState(game, playerId);
}
