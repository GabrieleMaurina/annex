import { connector } from '../connector';
import { publish } from '../connector/inbound';
import { getGameSettings, getGameSlots, isLoggedIn } from './player';
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
  const { mapGeneration, ...rules } = getGameSettings();
  if (Object.keys(rules).length > 0) connector.updateSettings(rules, apply);
  if (mapGeneration) {
    setRegeneratingMap(true);
    connector.generateMap(mapGeneration, (res) => {
      setRegeneratingMap(false);
      apply(res);
    });
  }
  connector.updateSettings({ slots: getGameSlots() }, apply);
}
