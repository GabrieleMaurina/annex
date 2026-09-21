export interface LoggedAction {
  event: string;
  payload?: unknown;
  ok: boolean;
  error?: string;
}

export interface RepeatedActions {
  repeat: number;
  actions: LoggedAction[];
}

export type ActionLogEntry = LoggedAction | RepeatedActions;

const MAX_PERIOD = 4;

function blockEquals(
  keys: string[],
  first: number,
  second: number,
  period: number,
): boolean {
  if (second + period > keys.length) return false;
  for (let offset = 0; offset < period; offset++)
    if (keys[first + offset] !== keys[second + offset]) return false;
  return true;
}

export function compressActions(actions: LoggedAction[]): ActionLogEntry[] {
  const keys = actions.map((action) => JSON.stringify(action));
  const entries: ActionLogEntry[] = [];
  let index = 0;
  while (index < actions.length) {
    let bestPeriod = 0;
    let bestRepeat = 1;
    for (let period = 1; period <= MAX_PERIOD; period++) {
      let repeat = 1;
      while (blockEquals(keys, index, index + repeat * period, period))
        repeat++;
      if (repeat > 1 && repeat * period > bestRepeat * bestPeriod) {
        bestPeriod = period;
        bestRepeat = repeat;
      }
    }
    if (bestPeriod === 0) {
      entries.push(actions[index]);
      index++;
    } else {
      entries.push({
        repeat: bestRepeat,
        actions: actions.slice(index, index + bestPeriod),
      });
      index += bestPeriod * bestRepeat;
    }
  }
  return entries;
}
