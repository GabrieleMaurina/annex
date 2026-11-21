import { attackDiceFor } from '../../game/combat/dice';
import { checkGameEnd } from '../../game/end';
import { forceEndTurnImpl } from '../../game/turns';
import { playersById } from '../../session/players';
import { broadcastGameState, games } from '../../session/store';
import { BotDifficulty, BotSpeed, Game } from '../../types';
import { dispatchBotAction } from '../dispatch';
import { thinkDelayMs } from '../thinkTime';
import { deployZombies } from './deploy';
import { infectDefenders } from './infect';
import { spreadTroops } from './spread';
import { pickZombieAttack } from './targets';

const ATTACK_STEP_MS: Record<BotSpeed, number> = {
  slow: 320,
  medium: 200,
  fast: 0,
};
const AFTER_DEPLOY_MS: Record<BotSpeed, number> = {
  slow: 900,
  medium: 600,
  fast: 100,
};
const LEFT_BEHIND_FRACTION: Partial<Record<BotDifficulty, number>> = {
  easy: 0.5,
  medium: 0.25,
};
const ATTACKS_PER_TERRITORY = 10;
const MAX_FINISH_STEPS = 8;

const running = new Set<string>();
let synchronous = false;

export function playZombieTurnsSynchronously(): void {
  synchronous = true;
}

function turnKey(game: Game): string {
  return `${game.roundNumber}:${game.turnPlayerIndex}`;
}

function isZombieTurn(game: Game): boolean {
  return (
    game.state === 'playing' &&
    !game.paused &&
    game.playerIds[game.turnPlayerIndex] === game.zombieId
  );
}

function later(game: Game, key: string, ms: number, step: () => void): void {
  if (synchronous) return step();
  setTimeout(() => {
    if (
      games.get(game.name) === game &&
      isZombieTurn(game) &&
      turnKey(game) === key
    )
      return step();
    stop(game);
    const current = games.get(game.name);
    if (current) scheduleZombieTurnIfNeeded(current);
  }, ms);
}

function stop(game: Game): void {
  running.delete(game.name);
}

function act(game: Game, event: string, payload?: unknown): boolean {
  return dispatchBotAction(game.zombieId!, event, payload).ok;
}

function moveTroops(game: Game, remaining: number): number {
  const difficulty = playersById.get(game.zombieId!)?.botProfile?.difficulty;
  const fraction = (difficulty && LEFT_BEHIND_FRACTION[difficulty]) || 0;
  const leave = Math.max(1, Math.ceil(remaining * fraction));
  const minimum = game.attackConquestMinTroops ?? 1;
  return Math.min(remaining - 1, Math.max(minimum, remaining - leave));
}

function completeConquest(game: Game): void {
  const startId = game.attackStartTerritoryId;
  if (startId === null || game.attackConquestMinTroops === null) return;
  const remaining = game.territoryTroops.get(startId) ?? 0;
  act(game, 'game:attackMove', { troops: moveTroops(game, remaining) });
}

function finishTurn(game: Game): void {
  if (game.state === 'playing') spreadTroops(game);
  for (
    let i = 0;
    i < MAX_FINISH_STEPS &&
    game.state === 'playing' &&
    game.playerIds[game.turnPlayerIndex] === game.zombieId;
    i++
  ) {
    if (act(game, 'game:nextPhase')) continue;
    forceEndTurnImpl(game);
    broadcastGameState(game);
    break;
  }
  stop(game);
  const current = games.get(game.name);
  if (current) scheduleZombieTurnIfNeeded(current);
}

function attackStep(game: Game, key: string, count: number): void {
  if (game.state !== 'playing' || game.turnPhase !== 'attack')
    return finishTurn(game);
  completeConquest(game);
  const maxAttacks = game.territoryOwners.size * ATTACKS_PER_TERRITORY;
  const pick = count < maxAttacks ? pickZombieAttack(game) : null;
  if (!pick) return finishTurn(game);
  const { startId, endId } = pick;
  const selected =
    act(game, 'game:attackSelectStart', { territoryId: startId }) &&
    act(game, 'game:attackSelectEnd', { territoryId: endId });
  if (!selected) return finishTurn(game);
  const stack = game.territoryTroops.get(startId) ?? 0;
  const defenders = game.territoryTroops.get(endId) ?? 0;
  const manual = game.blitz === 'off';
  const attacked = act(game, 'game:attack', {
    type: manual ? 'manual' : 'blitz',
    troops: manual
      ? Math.min(stack - 1, attackDiceFor(game, startId))
      : stack - 1,
  });
  if (!attacked) return finishTurn(game);
  if (game.state !== 'playing') {
    stop(game);
    return;
  }
  completeConquest(game);
  if (game.territoryOwners.get(endId) === game.zombieId)
    infectDefenders(game, endId, defenders);
  later(game, key, ATTACK_STEP_MS[game.botSpeed], () =>
    attackStep(game, key, count + 1),
  );
}

function deployStep(game: Game, key: string): void {
  if (game.turnPhase === 'deploy') {
    deployZombies(game);
    checkGameEnd(game);
    if (game.state !== 'playing') {
      stop(game);
      broadcastGameState(game);
      return;
    }
    if (!act(game, 'game:nextPhase')) return finishTurn(game);
  }
  later(game, key, AFTER_DEPLOY_MS[game.botSpeed], () =>
    attackStep(game, key, 0),
  );
}

export function scheduleZombieTurnIfNeeded(game: Game): boolean {
  if (game.zombieId === null) return false;
  if (game.playerIds[game.turnPlayerIndex] !== game.zombieId) return false;
  if (!isZombieTurn(game) || running.has(game.name)) return true;
  running.add(game.name);
  const key = turnKey(game);
  later(game, key, thinkDelayMs(game.botSpeed), () => deployStep(game, key));
  return true;
}
