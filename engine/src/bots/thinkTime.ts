import { BotSpeed } from '../types';

const BOT_SPEED_ORDER: BotSpeed[] = ['slow', 'medium', 'fast'];

export function nextBotSpeed(speed: BotSpeed): BotSpeed {
  const index = BOT_SPEED_ORDER.indexOf(speed);
  return BOT_SPEED_ORDER[(index + 1) % BOT_SPEED_ORDER.length];
}

const JITTER_MS = 1000;

export function thinkDelayMs(speed: BotSpeed): number {
  if (speed === 'medium') return 800;
  if (speed === 'fast') return 100;
  const base = 1500;
  return base + Math.random() * JITTER_MS;
}
