export const DICE_ROLL_STEPS = 8;
export const DICE_ROLL_STEP_DURATION = 90;

const pendingReveals = new Set<() => void>();

export function scheduleDiceReveal(reveal: () => void, delay: number) {
  const run = () => {
    clearTimeout(timer);
    if (pendingReveals.delete(run)) reveal();
  };
  const timer = setTimeout(run, delay);
  pendingReveals.add(run);
}

export function skipDiceReveals() {
  [...pendingReveals].forEach((run) => run());
}

function rollDie(sides: number, ...exclude: number[]): number {
  const values = Array.from({ length: sides }, (_, i) => i + 1);
  const allowed = values.filter((value) => !exclude.includes(value));
  const choices =
    allowed.length > 0
      ? allowed
      : values.filter((value) => value !== exclude[0]);
  return choices[Math.floor(Math.random() * choices.length)];
}

export function generateDiceRollSequence(
  finalValue: number,
  sides: number,
  steps: number = DICE_ROLL_STEPS,
): number[] {
  const sequence: number[] = [];
  let previous = -1;
  for (let i = 0; i < steps - 1; i++) {
    const value = rollDie(sides, previous);
    sequence.push(value);
    previous = value;
  }
  if (sequence.length > 0 && sequence[sequence.length - 1] === finalValue) {
    const priorValue = sequence.length > 1 ? sequence[sequence.length - 2] : -1;
    sequence[sequence.length - 1] = rollDie(sides, finalValue, priorValue);
  }
  sequence.push(finalValue);
  return sequence;
}
