import {
  PlanContext,
  SimState,
  attackersOf,
  defendingTroops,
  neighborsOf,
  troopsIn,
} from '../planning/context';
import { grownStack, zombieThreat } from './forecast';
import { FIRST_GROWTH, troopsFor } from './growth';

const SWEEP_LIMIT = 8;
const LOSSES_PER_DEFENDER = 1.1;
const THIN_TROOPS = 2;

export function applyZombieResponse(ctx: PlanContext, s: SimState): void {
  const zombieId = ctx.game.zombieId;
  if (zombieId === null) return;
  const caution = ctx.params.zombieCaution;
  const stacks: number[] = [];
  const infected = firstTurnInfection(ctx, s);
  for (const [id, ownerId] of s.owners) {
    if (ownerId !== zombieId) continue;
    const stack = troopsIn(s, id);
    stacks.push(id);
    if (infected !== null && id !== infected) continue;
    const grown =
      infected === null
        ? grownStack(ctx.game, stack)
        : stack + troopsFor(FIRST_GROWTH, stack);
    s.troops.set(id, stack + Math.round(caution * (grown - stack)));
  }
  stacks.sort((a, b) => troopsIn(s, b) - troopsIn(s, a));
  for (const start of stacks) {
    let from = start;
    for (let sweep = 0; sweep < SWEEP_LIMIT; sweep++) {
      const stack = troopsIn(s, from);
      if (stack < 2) break;
      let target: number | null = null;
      let targetTroops = -1;
      for (const n of neighborsOf(ctx, from)) {
        if (s.owners.get(n) !== ctx.botId) continue;
        const troops = defendingTroops(ctx, s, n);
        if (troops * 2 <= stack && troops > targetTroops) {
          targetTroops = troops;
          target = n;
        }
      }
      if (target === null) break;
      const survivors = Math.max(
        1,
        stack - 1 - Math.ceil(targetTroops * LOSSES_PER_DEFENDER),
      );
      s.troops.set(from, 1);
      s.owners.set(target, zombieId);
      s.troops.set(target, survivors + Math.ceil(targetTroops / 2));
      from = target;
    }
  }
}

function firstTurnInfection(ctx: PlanContext, s: SimState): number | null {
  const zombieId = ctx.game.zombieId;
  if (ctx.game.roundNumber !== 0 || zombieId === null) return null;
  let biggest: number | null = null;
  let owned = 0;
  let zombieOwns = false;
  for (const [id, ownerId] of s.owners) {
    if (ownerId === zombieId) zombieOwns = true;
    if (ownerId !== ctx.botId) continue;
    owned++;
    if (biggest === null || troopsIn(s, id) > troopsIn(s, biggest))
      biggest = id;
  }
  if (!zombieOwns || biggest === null || owned < 2) return null;
  s.owners.set(biggest, zombieId);
  return biggest;
}

export function isThinZombieTarget(
  ctx: PlanContext,
  state: SimState,
  territoryId: number,
): boolean {
  const zombieId = ctx.game.zombieId;
  if (zombieId === null) return false;
  const troops = defendingTroops(ctx, state, territoryId);
  if (troops > THIN_TROOPS) return false;
  return attackersOf(ctx, territoryId).some(
    (n) =>
      state.owners.get(n) === zombieId &&
      zombieThreat(ctx.game, troopsIn(state, n)) > troops,
  );
}
