import { parentPort } from 'worker_threads';
import { PlanBotTurnInput, planBotTurn } from './planBotTurn';

parentPort!.on('message', (input: PlanBotTurnInput) => {
  try {
    const result = planBotTurn(
      input.game,
      input.botId,
      input.botProfile,
      input.cachedCampaign,
    );
    parentPort!.postMessage({ ok: true, result });
  } catch (err) {
    parentPort!.postMessage({ ok: false, error: String(err) });
  }
});
