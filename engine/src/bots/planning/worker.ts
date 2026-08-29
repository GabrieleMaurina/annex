import { parentPort } from 'worker_threads';
import { loadMaps } from '../../maps/maps';
import { PlanBotTurnInput, planBotTurn } from './planBotTurn';

const loadedMapNames = new Set<string>();

parentPort!.on('message', (input: PlanBotTurnInput) => {
  try {
    if (!loadedMapNames.has(input.map.name)) {
      loadMaps([input.map]);
      loadedMapNames.add(input.map.name);
    }
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
