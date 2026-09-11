import { connector } from '../connector';
import { publish } from '../connector/inbound';
import {
  getGameBots,
  getGameLocalPlayers,
  getGameSettings,
  getGameSlots,
  isLoggedIn,
  recordRestoredBotInput,
  resetRestoredBotInputs,
} from './player';
import type { Ack } from './types';

let regeneratingMap = false;

export function isRegeneratingMap(): boolean {
  return regeneratingMap;
}

function setRegeneratingMap(value: boolean): void {
  regeneratingMap = value;
  publish('map:regenerating', value);
}

function apply(res: Ack): void {
  if (res.ok) publish('game:state', res.game);
}

export function applySavedGameSettings(): void {
  if (!isLoggedIn()) return;
  resetRestoredBotInputs();
  const { mapGeneration, playerMapId, mapName, ...rules } = getGameSettings();
  void mapName;
  if (Object.keys(rules).length > 0) connector.updateSettings(rules, apply);
  if (mapGeneration) {
    setRegeneratingMap(true);
    connector.generateMap(mapGeneration, (res) => {
      setRegeneratingMap(false);
      apply(res);
    });
  } else if (playerMapId) {
    connector.selectPlayerMap({ mapId: playerMapId }, apply);
  }
  connector.updateSettings({ slots: getGameSlots() }, apply);
  getGameBots().forEach((bot, index) => {
    connector.addBot(
      { difficulty: bot.difficulty, personality: bot.personality },
      (res: Ack) => {
        apply(res);
        if (!res.ok) return;
        const seated = res.game.players.filter((p) => p.isBot);
        if (seated[index]) recordRestoredBotInput(seated[index].id, bot);
      },
    );
  });
  if (connector.isOffline())
    for (const name of getGameLocalPlayers()) connector.addLocalPlayer(name);
}
