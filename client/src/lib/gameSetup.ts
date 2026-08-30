import { connector } from '../connector';
import { publish } from '../connector/inbound';
import { getGameSettings, getGameSlots } from './player';
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
  const saved = getGameSettings();
  if (saved) {
    const { mapGeneration, ...rules } = saved;
    if (Object.keys(rules).length > 0) connector.updateSettings(rules, apply);
    if (mapGeneration) {
      setRegeneratingMap(true);
      connector.generateMap(mapGeneration, (res) => {
        setRegeneratingMap(false);
        apply(res);
      });
    }
  }
  const slots = getGameSlots();
  if (slots) connector.updateSettings({ slots }, apply);
}
