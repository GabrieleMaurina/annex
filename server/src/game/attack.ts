import { Server, Socket } from 'socket.io';
import { maps } from '../maps';
import { Game, Player } from '../types';
import { isInteger, isNullableInteger, isObject } from '../validate';
import {
  balancedBlitz,
  balancedWinProbs,
  attack as rollAttack,
  trueBlitz,
  trueWinProbs,
} from './dice';
import { gameState } from './state';
import { gameRoomName, games } from './store';

type GameResponse =
  | { ok: true; game: ReturnType<typeof gameState> }
  | { ok: false; error: string };

type AttackProbabilitiesResponse =
  | {
      ok: true;
      game: ReturnType<typeof gameState>;
      blitzWinProbabilities: number[];
    }
  | { ok: false; error: string };

type AttackResultResponse =
  | {
      ok: true;
      game: ReturnType<typeof gameState>;
      blitzWinProbabilities: number[];
      attackerDice: number[];
      defenderDice: number[];
    }
  | { ok: false; error: string };

function computeBlitzWinProbabilities(
  game: Game,
  attackingTroops: number,
  defendingTroops: number,
): number[] {
  const maxBlitz = attackingTroops - 1;
  const blitzWinProbs = game.blitz === 'True' ? trueWinProbs : balancedWinProbs;
  return blitzWinProbs(maxBlitz, defendingTroops, game.defenceDice);
}

function isAttackStartCandidate(
  game: Game,
  playerId: number,
  territoryId: number,
): boolean {
  if ((game.territoryTroops.get(territoryId) ?? 0) < 2) return false;
  const map = maps.get(game.mapName)!;
  const territory = map.territories.find((t) => t.id === territoryId);
  return (
    territory?.neighbors.some((n) => {
      const ownerId = game.territoryOwners.get(n);
      return ownerId !== undefined && ownerId !== playerId;
    }) ?? false
  );
}

function isAttackEndCandidate(
  game: Game,
  playerId: number,
  startId: number,
  territoryId: number,
): boolean {
  const ownerId = game.territoryOwners.get(territoryId);
  if (ownerId === undefined || ownerId === playerId) return false;
  const map = maps.get(game.mapName)!;
  const territory = map.territories.find((t) => t.id === startId);
  return territory?.neighbors.includes(territoryId) ?? false;
}

function hasPendingConquest(game: Game, playerId: number): boolean {
  return (
    game.attackEndTerritoryId !== null &&
    game.territoryOwners.get(game.attackEndTerritoryId) === playerId
  );
}

export function registerAttackHandlers(
  io: Server,
  socket: Socket,
  playersBySocket: Map<string, Player>,
  playersById: Map<number, Player>,
) {
  socket.on(
    'game:attackSelectStart',
    (data: unknown, callback: (response: GameResponse) => void) => {
      if (typeof callback !== 'function') return;
      const player = playersBySocket.get(socket.id);
      if (!player || !player.gameName)
        return callback({ ok: false, error: 'not in a game' });

      const game = games.get(player.gameName);
      if (!game) return callback({ ok: false, error: 'game not found' });
      if (game.state !== 'playing')
        return callback({ ok: false, error: 'game not started' });
      if (game.playerIds[game.turnPlayerIndex] !== player.id)
        return callback({ ok: false, error: 'not your turn' });
      if (game.turnPhase !== 'attack')
        return callback({ ok: false, error: 'not attack phase' });
      if (hasPendingConquest(game, player.id))
        return callback({ ok: false, error: 'pending conquest move' });

      const territoryId = isObject(data) ? data.territoryId : undefined;
      if (!isNullableInteger(territoryId))
        return callback({ ok: false, error: 'invalid territory' });

      if (territoryId !== null) {
        if (!game.territoryOwners.has(territoryId))
          return callback({ ok: false, error: 'invalid territory' });
        if (game.territoryOwners.get(territoryId) !== player.id)
          return callback({ ok: false, error: 'territory not owned' });
        if (!isAttackStartCandidate(game, player.id, territoryId))
          return callback({ ok: false, error: 'invalid start territory' });
      }

      game.attackStartTerritoryId = territoryId;
      game.attackEndTerritoryId = null;
      game.attackConquestMinTroops = null;
      if (territoryId !== null)
        io.to(gameRoomName(game.name)).emit('game:selected', { territoryId });
      callback({ ok: true, game: gameState(game, playersById) });
    },
  );

  socket.on(
    'game:attackSelectEnd',
    (
      data: unknown,
      callback: (response: AttackProbabilitiesResponse) => void,
    ) => {
      if (typeof callback !== 'function') return;
      const player = playersBySocket.get(socket.id);
      if (!player || !player.gameName)
        return callback({ ok: false, error: 'not in a game' });

      const game = games.get(player.gameName);
      if (!game) return callback({ ok: false, error: 'game not found' });
      if (game.state !== 'playing')
        return callback({ ok: false, error: 'game not started' });
      if (game.playerIds[game.turnPlayerIndex] !== player.id)
        return callback({ ok: false, error: 'not your turn' });
      if (game.turnPhase !== 'attack')
        return callback({ ok: false, error: 'not attack phase' });
      if (game.attackStartTerritoryId === null)
        return callback({ ok: false, error: 'no start territory selected' });

      const territoryId = isObject(data) ? data.territoryId : undefined;
      if (!isInteger(territoryId))
        return callback({ ok: false, error: 'invalid territory' });
      if (!game.territoryOwners.has(territoryId))
        return callback({ ok: false, error: 'invalid territory' });
      if (
        !isAttackEndCandidate(
          game,
          player.id,
          game.attackStartTerritoryId,
          territoryId,
        )
      )
        return callback({ ok: false, error: 'invalid end territory' });

      game.attackEndTerritoryId = territoryId;

      const attackingTroops =
        game.territoryTroops.get(game.attackStartTerritoryId) ?? 0;
      const defendingTroops = game.territoryTroops.get(territoryId) ?? 0;
      const blitzWinProbabilities = computeBlitzWinProbabilities(
        game,
        attackingTroops,
        defendingTroops,
      );

      io.to(gameRoomName(game.name)).emit('game:selected', { territoryId });
      callback({
        ok: true,
        game: gameState(game, playersById),
        blitzWinProbabilities,
      });
    },
  );

  socket.on(
    'game:attack',
    (data: unknown, callback: (response: AttackResultResponse) => void) => {
      if (typeof callback !== 'function') return;
      const player = playersBySocket.get(socket.id);
      if (!player || !player.gameName)
        return callback({ ok: false, error: 'not in a game' });

      const game = games.get(player.gameName);
      if (!game) return callback({ ok: false, error: 'game not found' });
      if (game.state !== 'playing')
        return callback({ ok: false, error: 'game not started' });
      if (game.playerIds[game.turnPlayerIndex] !== player.id)
        return callback({ ok: false, error: 'not your turn' });
      if (game.turnPhase !== 'attack')
        return callback({ ok: false, error: 'not attack phase' });
      if (
        game.attackStartTerritoryId === null ||
        game.attackEndTerritoryId === null
      )
        return callback({ ok: false, error: 'no attack selection' });
      if (hasPendingConquest(game, player.id))
        return callback({ ok: false, error: 'territory already conquered' });

      const { type, troops } = isObject(data)
        ? data
        : ({} as Record<string, unknown>);
      if (type !== 'regular' && type !== 'blitz')
        return callback({ ok: false, error: 'invalid attack type' });

      const startId = game.attackStartTerritoryId;
      const endId = game.attackEndTerritoryId;
      const attackingTroops = game.territoryTroops.get(startId) ?? 0;
      const maxTroops =
        type === 'regular'
          ? Math.min(attackingTroops - 1, 3)
          : attackingTroops - 1;
      if (!isInteger(troops))
        return callback({ ok: false, error: 'invalid troops' });
      if (troops < 1 || troops > maxTroops)
        return callback({ ok: false, error: 'invalid troops' });

      const defendingTroops = game.territoryTroops.get(endId) ?? 0;
      const defenderId = game.territoryOwners.get(endId)!;
      let attackLosses: number;
      let defenceLosses: number;
      let attackerDice: number[] = [];
      let defenderDice: number[] = [];
      if (type === 'regular') {
        const result = rollAttack(
          troops,
          Math.min(defendingTroops, game.defenceDice),
        );
        attackLosses = result.attackLosses;
        defenceLosses = result.defenceLosses;
        attackerDice = result.attackDice;
        defenderDice = result.defenceDice;
      } else {
        const result = (game.blitz === 'True' ? trueBlitz : balancedBlitz)(
          troops,
          defendingTroops,
          game.defenceDice,
        );
        attackLosses = result.attackLosses;
        defenceLosses = result.defenceLosses;
      }

      game.territoryTroops.set(startId, attackingTroops - attackLosses);
      game.territoryTroops.set(
        endId,
        Math.max(0, defendingTroops - defenceLosses),
      );

      const conquered = defenceLosses >= defendingTroops;
      let blitzWinProbabilities: number[] = [];
      if (conquered) {
        game.territoryOwners.set(endId, player.id);
        const remainingAttackers = attackingTroops - attackLosses;
        game.attackConquestMinTroops = Math.min(
          troops,
          3,
          remainingAttackers - 1,
        );
      } else {
        const remainingAttackers = attackingTroops - attackLosses;
        const remainingDefenders = defendingTroops - defenceLosses;
        if (remainingAttackers > 1) {
          blitzWinProbabilities = computeBlitzWinProbabilities(
            game,
            remainingAttackers,
            remainingDefenders,
          );
        } else {
          game.attackStartTerritoryId = null;
          game.attackEndTerritoryId = null;
        }
      }

      io.to(gameRoomName(game.name)).emit('game:attacked', {
        attackingTerritoryId: startId,
        defendingTerritoryId: endId,
        attackerId: player.id,
        defenderId,
        attackLosses,
        defenceLosses,
        conquered,
        type,
      });
      callback({
        ok: true,
        game: gameState(game, playersById),
        blitzWinProbabilities,
        attackerDice,
        defenderDice,
      });
    },
  );

  socket.on(
    'game:attackMove',
    (data: unknown, callback: (response: GameResponse) => void) => {
      if (typeof callback !== 'function') return;
      const player = playersBySocket.get(socket.id);
      if (!player || !player.gameName)
        return callback({ ok: false, error: 'not in a game' });

      const game = games.get(player.gameName);
      if (!game) return callback({ ok: false, error: 'game not found' });
      if (game.state !== 'playing')
        return callback({ ok: false, error: 'game not started' });
      if (game.playerIds[game.turnPlayerIndex] !== player.id)
        return callback({ ok: false, error: 'not your turn' });
      if (game.turnPhase !== 'attack')
        return callback({ ok: false, error: 'not attack phase' });
      if (!hasPendingConquest(game, player.id))
        return callback({ ok: false, error: 'no pending conquest' });

      const startId = game.attackStartTerritoryId!;
      const endId = game.attackEndTerritoryId!;
      const startTroops = game.territoryTroops.get(startId) ?? 0;
      const min = game.attackConquestMinTroops ?? 1;
      const max = startTroops - 1;

      const troops = isObject(data) ? data.troops : undefined;
      if (!isInteger(troops))
        return callback({ ok: false, error: 'invalid troops' });
      if (troops < min || troops > max)
        return callback({ ok: false, error: 'invalid troops' });

      game.territoryTroops.set(startId, startTroops - troops);
      game.territoryTroops.set(endId, troops);
      game.attackStartTerritoryId = null;
      game.attackEndTerritoryId = null;
      game.attackConquestMinTroops = null;

      io.to(gameRoomName(game.name)).emit('game:attackMoved', {
        territoryId: endId,
        troops,
      });
      callback({ ok: true, game: gameState(game, playersById) });
    },
  );
}
