export const DICE_ROLL_STEPS = 8;
export const DICE_ROLL_STEP_DURATION = 90;

function rollDie(...exclude: number[]): number {
  let value: number;
  do {
    value = 1 + Math.floor(Math.random() * 6);
  } while (exclude.includes(value));
  return value;
}

export function generateDiceRollSequence(
  finalValue: number,
  steps: number = DICE_ROLL_STEPS,
): number[] {
  const sequence: number[] = [];
  let previous = -1;
  for (let i = 0; i < steps - 1; i++) {
    const value = rollDie(previous);
    sequence.push(value);
    previous = value;
  }
  if (sequence.length > 0 && sequence[sequence.length - 1] === finalValue) {
    const priorValue = sequence.length > 1 ? sequence[sequence.length - 2] : -1;
    sequence[sequence.length - 1] = rollDie(finalValue, priorValue);
  }
  sequence.push(finalValue);
  return sequence;
}
