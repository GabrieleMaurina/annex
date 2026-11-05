import { BotSpeed } from '../types';

const BOT_SPEED_ORDER: BotSpeed[] = ['slow', 'medium', 'fast'];

export function nextBotSpeed(speed: BotSpeed): BotSpeed {
  const index = BOT_SPEED_ORDER.indexOf(speed);
  return BOT_SPEED_ORDER[(index + 1) % BOT_SPEED_ORDER.length];
}

const JITTER_MS = 700;

export function thinkDelayMs(speed: BotSpeed): number {
  if (speed === 'medium') return 560;
  if (speed === 'fast') return 50;
  const base = 1050;
  return base + Math.random() * JITTER_MS;
}

export function clickDelayMs(speed: BotSpeed): number {
  if (speed === 'medium') return 280;
  return 490;
}
