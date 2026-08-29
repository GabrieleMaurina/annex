import { getGameMap } from '../../maps/maps';
import { BotProfile, Game } from '../../types';
import { getBotWorkerConfig } from '../../workers/registry';
import { WorkerResult } from '../../workers/types';
import { WorkerPool } from '../../workers/workerPool';
import {
  CampaignCache,
  PlanBotTurnInput,
  PlanBotTurnResult,
} from './planBotTurn';

let pool: WorkerPool<PlanBotTurnInput, PlanBotTurnResult> | null = null;

function getPool(): WorkerPool<PlanBotTurnInput, PlanBotTurnResult> {
  if (!pool) {
    const config = getBotWorkerConfig();
    pool = new WorkerPool(config.create, config.poolSize ?? 1);
  }
  return pool;
}

export function planBotTurnAsync(
  game: Game,
  botId: number,
  botProfile: BotProfile,
  cachedCampaign: CampaignCache | null,
  callback: (result: WorkerResult<PlanBotTurnResult>) => void,
): void {
  getPool().run(
    { game, map: getGameMap(game), botId, botProfile, cachedCampaign },
    callback,
  );
}
