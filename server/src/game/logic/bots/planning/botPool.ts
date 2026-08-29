import os from 'os';
import { BotProfile, Game } from '../../../../types';
import { WorkerPool, WorkerResult } from '../../../../workers/workerPool';
import {
  CampaignCache,
  PlanBotTurnInput,
  PlanBotTurnResult,
} from './planBotTurn';

const pool = new WorkerPool<PlanBotTurnInput, PlanBotTurnResult>(
  __dirname,
  'worker',
  Math.max(1, os.cpus().length - 1),
);

export function planBotTurnAsync(
  game: Game,
  botId: number,
  botProfile: BotProfile,
  cachedCampaign: CampaignCache | null,
  callback: (result: WorkerResult<PlanBotTurnResult>) => void,
): void {
  pool.run({ game, botId, botProfile, cachedCampaign }, callback);
}
