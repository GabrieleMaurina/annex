import { BotPersonality, Game } from '../../types';
import { DifficultyParams } from '../types';
import { Shape, shapeOf } from './shape';

export interface PositionContext {
  shape: Shape;
  guard: Map<number, number>;
}

const HOLD_VALUE = 0.06;
const AGGRESSION_GUARD = 0.5;
const GATE_GUARD = 0.25;
const GATE_MIN_SHARE = 0.5;
const GUARD_CAP = 2;

export function positionEnabled(
  personality: BotPersonality,
  params: DifficultyParams,
): boolean {
  return personality === 'balanced' && params.position;
}

export function holdValue(shape: Shape, territoryId: number): number {
  return HOLD_VALUE * (shape.remoteness.get(territoryId) ?? 0);
}

function frontCounts(
  owners: Map<number, number>,
  neighbors: Map<number, number[]>,
): Map<number, Set<number>> {
  const fronts = new Map<number, Set<number>>();
  for (const [id, ownerId] of owners)
    for (const n of neighbors.get(id) ?? []) {
      const otherId = owners.get(n);
      if (otherId === undefined || otherId === ownerId) continue;
      const set = fronts.get(ownerId);
      if (set) set.add(otherId);
      else fronts.set(ownerId, new Set([otherId]));
    }
  return fronts;
}

function raise(guard: Map<number, number>, id: number, factor: number): void {
  guard.set(id, Math.min(GUARD_CAP, (guard.get(id) ?? 1) * factor));
}

export function buildPositionContext(
  game: Game,
  botId: number,
  friendlyIds: Set<number>,
  neighbors: Map<number, number[]>,
  attackers: Map<number, number[]>,
  links: Map<number, number[]>,
  continentTerritories: Map<number, number[]>,
  bonuses: number[],
  owners: Map<number, number>,
): PositionContext {
  const shape = shapeOf(game, links);
  const guard = new Map<number, number>();
  const fronts = frontCounts(owners, neighbors);

  for (const [id, ownerId] of owners) {
    if (ownerId !== botId) continue;
    let cornered = 0;
    for (const attackerId of attackers.get(id) ?? []) {
      const attackerOwner = owners.get(attackerId);
      if (
        attackerOwner === undefined ||
        attackerOwner === botId ||
        friendlyIds.has(attackerOwner)
      )
        continue;
      cornered = Math.max(
        cornered,
        1 / Math.max(1, fronts.get(attackerOwner)?.size ?? 1),
      );
    }
    if (cornered > 0) raise(guard, id, 1 + AGGRESSION_GUARD * cornered);
  }

  for (const [continentId, ids] of continentTerritories) {
    if ((bonuses[continentId] ?? 0) <= 0) continue;
    const held = ids.filter((id) => owners.get(id) === botId).length;
    if (held < GATE_MIN_SHARE * ids.length) continue;
    const factor = 1 + GATE_GUARD * (shape.safety.get(continentId) ?? 1);
    for (const id of shape.entries.get(continentId) ?? [])
      if (owners.get(id) === botId) raise(guard, id, factor);
  }

  return { shape, guard };
}
