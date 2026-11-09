export const PLAN_TIME_LIMIT_MS = 1000;

export class PlanTimeout extends Error {}

let deadline = Infinity;

export function startPlanClock(startedAt: number): void {
  deadline = startedAt + PLAN_TIME_LIMIT_MS;
}

export function stopPlanClock(): void {
  deadline = Infinity;
}

export function planExpired(): boolean {
  return Date.now() > deadline;
}

export function checkPlanClock(): void {
  if (planExpired()) throw new PlanTimeout();
}
