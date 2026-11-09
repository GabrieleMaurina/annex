export const PLAN_WORK_LIMIT = 1_500_000;

export class PlanTimeout extends Error {}

let remaining = Infinity;
let unitCost = 1;

export function startPlanClock(territoryCount: number): void {
  remaining = PLAN_WORK_LIMIT;
  unitCost = territoryCount;
}

export function stopPlanClock(): void {
  remaining = Infinity;
}

export function planExpired(): boolean {
  return remaining <= 0;
}

export function checkPlanClock(): void {
  remaining -= unitCost;
  if (remaining <= 0) throw new PlanTimeout();
}
