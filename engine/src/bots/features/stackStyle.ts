import { Game } from '../../types';
import { BotView, isVisible } from '../view';

export const NEUTRAL_STACK_FOCUS = 0.5;
const SPREAD_SHARE = 0.3;
const STACK_SHARE = 0.7;
const MIDPOINT_SHARE = (SPREAD_SHARE + STACK_SHARE) / 2;
const FULL_INFO_EXCESS = 10;

interface Shape {
  excess: number;
  largest: number;
  contact: number;
}

function opponentShapes(
  game: Game,
  view: BotView,
  botId: number,
  friendlyIds: Set<number>,
  neighbors: Map<number, number[]>,
): Shape[] {
  const shapes = new Map<number, Shape>();
  for (const [id, ownerId] of game.territoryOwners) {
    if (ownerId === botId || friendlyIds.has(ownerId)) continue;
    if (!isVisible(view, id)) continue;
    const excess = Math.max(0, (game.territoryTroops.get(id) ?? 0) - 1);
    const shape = shapes.get(ownerId) ?? { excess: 0, largest: 0, contact: 0 };
    shape.excess += excess;
    shape.largest = Math.max(shape.largest, excess);
    if (
      (neighbors.get(id) ?? []).some(
        (n) => game.territoryOwners.get(n) === botId,
      )
    )
      shape.contact++;
    shapes.set(ownerId, shape);
  }
  return [...shapes.values()];
}

function stackShare(shape: Shape): number {
  if (shape.excess <= 0) return MIDPOINT_SHARE;
  const info = Math.min(1, shape.excess / FULL_INFO_EXCESS);
  const share = shape.largest / shape.excess;
  return MIDPOINT_SHARE + (share - MIDPOINT_SHARE) * info;
}

export function neighborStackFocus(
  game: Game,
  view: BotView,
  botId: number,
  friendlyIds: Set<number>,
  neighbors: Map<number, number[]>,
): number {
  const shapes = opponentShapes(game, view, botId, friendlyIds, neighbors);
  if (shapes.length === 0) return NEUTRAL_STACK_FOCUS;
  const contacts = shapes.reduce((sum, shape) => sum + shape.contact, 0);
  const weightOf = (shape: Shape) => (contacts > 0 ? shape.contact : 1);
  const totalWeight = shapes.reduce((sum, shape) => sum + weightOf(shape), 0);
  const share =
    shapes.reduce(
      (sum, shape) => sum + weightOf(shape) * stackShare(shape),
      0,
    ) / totalWeight;
  return Math.min(
    1,
    Math.max(0, (share - SPREAD_SHARE) / (STACK_SHARE - SPREAD_SHARE)),
  );
}

export function consolidation(stackFocus: number): number {
  return Math.min(1, Math.max(0, 2 * stackFocus - 1));
}

export function spreading(stackFocus: number): number {
  return Math.min(1, Math.max(0, 1 - 2 * stackFocus));
}
