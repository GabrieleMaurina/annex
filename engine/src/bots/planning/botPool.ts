import { getGameMap } from '../../maps/maps';
import { BotProfile, Game } from '../../types';
import { getBotWorkerConfig } from '../../workers/registry';
import { WorkerResult } from '../../workers/types';
import { WorkerPool } from '../../workers/workerPool';
import {
  PlanBotTurnInput,
  PlanBotTurnResult,
  TurnPlanCache,
} from './planBotTurn';

let pool: WorkerPool<PlanBotTurnInput, PlanBotTurnResult> | null = null;

function getPool(): WorkerPool<PlanBotTurnInput, PlanBotTurnResult> {
  if (!pool) {
    const config = getBotWorkerConfig();
    pool = new WorkerPool(config.create, config.poolSize ?? 1);
  }
  return pool;
}

function planningGame(game: Game, botId: number): Game {
  const botLog = game.logs.get(botId);
  return {
    ...game,
    replayFrames: [],
    replayTurnMarkers: [],
    replayChat: [],
    replayEmoji: [],
    replayLog: [],
    logs: new Map(botLog ? [[botId, botLog]] : []),
  };
}

export function planBotTurnAsync(
  game: Game,
  botId: number,
  botProfile: BotProfile,
  cachedPlan: TurnPlanCache | null,
  callback: (result: WorkerResult<PlanBotTurnResult>) => void,
): void {
  getPool().run(
    {
      game: planningGame(game, botId),
      map: getGameMap(game),
      botId,
      botProfile,
      cachedPlan,
    },
    callback,
  );
}
