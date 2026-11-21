import { callbacks } from '../../callbacks';
import { recordReplayFrame } from '../../game/replay';
import { fortifyFullPath } from '../../game/world/connectivity';
import { fogFilterEmit } from '../../game/world/fog';
import {
  pathRunsForViewer,
  troopMoveFields,
  visibleTerritoryIdsOrAll,
} from '../../game/world/visibility';
import { Game } from '../../types';
import { neighborsOf } from '../features/territory';
import { troopsOn } from './targets';

interface Move {
  fromId: number;
  toId: number;
  troops: number;
}

function connectedGroups(
  zombieIds: Set<number>,
  neighbors: (id: number) => number[],
): number[][] {
  const seen = new Set<number>();
  const groups: number[][] = [];
  for (const start of zombieIds) {
    if (seen.has(start)) continue;
    const group = [start];
    seen.add(start);
    for (let i = 0; i < group.length; i++)
      for (const n of neighbors(group[i]))
        if (zombieIds.has(n) && !seen.has(n)) {
          seen.add(n);
          group.push(n);
        }
    groups.push(group);
  }
  return groups;
}

function planMoves(game: Game, group: number[]): Move[] {
  const total = group.reduce((sum, id) => sum + troopsOn(game, id), 0);
  const base = Math.floor(total / group.length);
  const extra = total - base * group.length;
  const ordered = [...group].sort(
    (a, b) => troopsOn(game, b) - troopsOn(game, a) || a - b,
  );
  const surplus: { id: number; amount: number }[] = [];
  const needs: { id: number; amount: number }[] = [];
  ordered.forEach((id, i) => {
    const delta = base + (i < extra ? 1 : 0) - troopsOn(game, id);
    if (delta > 0) needs.push({ id, amount: delta });
    else if (delta < 0) surplus.push({ id, amount: -delta });
  });
  const moves: Move[] = [];
  for (const need of needs)
    for (const give of surplus) {
      if (need.amount === 0) break;
      const troops = Math.min(need.amount, give.amount);
      if (troops === 0) continue;
      moves.push({ fromId: give.id, toId: need.id, troops });
      need.amount -= troops;
      give.amount -= troops;
    }
  return moves;
}

function applyMove(game: Game, { fromId, toId, troops }: Move): void {
  const zombieId = game.zombieId!;
  game.territoryTroops.set(fromId, troopsOn(game, fromId) - troops);
  game.territoryTroops.set(toId, troopsOn(game, toId) + troops);
  recordReplayFrame(game, {
    type: 'fortify',
    fromTerritoryId: fromId,
    toTerritoryId: toId,
    troops,
    playerId: zombieId,
  });
  const path = fortifyFullPath(game, zombieId, fromId, toId);
  fogFilterEmit(game, 'game:fortified', callbacks.onFortified, (viewerId) => {
    const visible = visibleTerritoryIdsOrAll(game, viewerId);
    if (visible !== null && !visible.has(toId) && !visible.has(fromId))
      return null;
    return {
      territoryId: toId,
      fromTerritoryId: fromId,
      playerId: zombieId,
      path: pathRunsForViewer(path, visible),
      ...troopMoveFields(visible, fromId, toId, troops),
    };
  });
}

export function spreadTroops(game: Game): void {
  const zombieId = game.zombieId;
  if (zombieId === null) return;
  const zombieIds = new Set(
    [...game.territoryOwners]
      .filter(([, ownerId]) => ownerId === zombieId)
      .map(([id]) => id),
  );
  const neighbors = (id: number) => neighborsOf(game, id);
  for (const group of connectedGroups(zombieIds, neighbors))
    for (const move of planMoves(game, group)) applyMove(game, move);
}
