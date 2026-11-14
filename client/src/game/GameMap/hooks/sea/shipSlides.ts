import {
  areAnimationsDisabled,
  SHIP_SLIDE_MS,
  startShipShuttle,
} from '../../../animations';
import type { ClickableRegions } from '../../../regions/clickableRegions';
import type { Point } from '../../helpers';
import { paddedSeaPoint } from './seaClearance';

export function shipSlideTargets(
  pathRuns: number[][],
  regions: ClickableRegions | null,
  seaTerritories: (Point & { id: number })[],
  positionOf: (id: number) => Point | undefined,
): { seaId: number; target: Point }[] {
  if (!regions) return [];
  const seaById = new Map(seaTerritories.map((s) => [s.id, s]));
  const targets: { seaId: number; target: Point }[] = [];
  for (const run of pathRuns) {
    for (let i = 1; i < run.length - 1; i++) {
      const sea = seaById.get(run[i]);
      const before = positionOf(run[i - 1]);
      const after = positionOf(run[i + 1]);
      if (!sea || !before || !after || !regions.shapes.has(sea.id)) continue;
      const target = paddedSeaPoint(regions, sea.id, {
        x: (before.x + after.x) / 2,
        y: (before.y + after.y) / 2,
      });
      if (target) targets.push({ seaId: sea.id, target });
    }
  }
  return targets;
}

export function slideShipsAlongPath(
  pathRuns: number[][],
  shipOwnerId: number | undefined,
  regions: ClickableRegions | null,
  seaTerritories: (Point & { id: number })[],
  positionOf: (id: number) => Point | undefined,
  actionInMs: number,
): number {
  if (shipOwnerId === undefined || areAnimationsDisabled()) return 0;
  const targets = shipSlideTargets(
    pathRuns,
    regions,
    seaTerritories,
    positionOf,
  );
  for (const { seaId, target } of targets)
    startShipShuttle(
      seaId,
      shipOwnerId,
      target,
      Math.max(0, actionInMs - SHIP_SLIDE_MS),
    );
  return targets.length > 0
    ? Math.max(actionInMs, SHIP_SLIDE_MS) - actionInMs
    : 0;
}
