import { BotDifficulty, TurnPhase } from '../types';

const PHASE_WEIGHT: Partial<Record<TurnPhase, number>> = {
  deploy: 1,
  attack: 1.3,
  fortify: 0.8,
};

export function thinkDelayMs(
  difficulty: BotDifficulty,
  phase: TurnPhase,
): number {
  const base =
    difficulty === 'hard' ? 900 : difficulty === 'medium' ? 650 : 400;
  const weight = PHASE_WEIGHT[phase] ?? 0.6;
  return base * weight + Math.random() * base * weight;
}
