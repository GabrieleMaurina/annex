import { loadMaps } from '../../maps/maps';
import { EngineWorkerScope } from '../../workers/types';
import { PlanBotTurnInput, planBotTurn } from './planBotTurn';

export function runBotWorker(scope: EngineWorkerScope): void {
  const loadedMapNames = new Set<string>();

  scope.onMessage((data) => {
    const input = data as PlanBotTurnInput;
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
      scope.postMessage({ ok: true, result });
    } catch (err) {
      scope.postMessage({ ok: false, error: String(err) });
    }
  });
}
