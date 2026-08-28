import {
  CONTINENT_SIZE_MAX,
  CONTINENT_SIZE_MEAN,
  CONTINENT_SIZE_MIN,
  CONTINENT_SIZE_STD_DEV,
} from '../core/params';
import { gaussianRandom, randomInt, Rng } from '../core/rng';

// Picks the smallest neighboring continent rather than the first one found,
// so a leftover territory that must be merged into an existing continent
// (rather than forming its own, too-small one) is least likely to push that
// continent over CONTINENT_SIZE_MAX - and when every neighbor is already at
// or above the cap, this keeps the inevitable overflow as small as possible
// instead of dumping every leftover onto whichever continent happened to be
// discovered first.
function smallestNeighborContinent(
  territoryIds: Iterable<number>,
  adjacency: Map<number, Set<number>>,
  continentIdByTerritory: number[],
  sizeByContinent: Map<number, number>,
  underCapOnly: boolean,
): number | undefined {
  let best: number | undefined;
  let bestSize = Infinity;
  for (const territoryId of territoryIds) {
    for (const neighbor of adjacency.get(territoryId) ?? []) {
      const continentId = continentIdByTerritory[neighbor];
      if (continentId === -1) continue;
      const size = sizeByContinent.get(continentId) ?? 0;
      if (underCapOnly && size >= CONTINENT_SIZE_MAX) continue;
      if (size < bestSize) {
        bestSize = size;
        best = continentId;
      }
    }
  }
  return best;
}

function mergeTargetContinent(
  territoryIds: Iterable<number>,
  adjacency: Map<number, Set<number>>,
  continentIdByTerritory: number[],
  sizeByContinent: Map<number, number>,
): number | undefined {
  return (
    smallestNeighborContinent(
      territoryIds,
      adjacency,
      continentIdByTerritory,
      sizeByContinent,
      true,
    ) ??
    smallestNeighborContinent(
      territoryIds,
      adjacency,
      continentIdByTerritory,
      sizeByContinent,
      false,
    )
  );
}

export function clusterContinents(
  rng: Rng,
  territoryCount: number,
  adjacency: Map<number, Set<number>>,
): number[] {
  const continentIdByTerritory = new Array(territoryCount).fill(-1);
  const unassigned = new Set<number>();
  for (let i = 0; i < territoryCount; i++) unassigned.add(i);
  const sizeByContinent = new Map<number, number>();

  function assign(territoryId: number, continentId: number) {
    continentIdByTerritory[territoryId] = continentId;
    sizeByContinent.set(continentId, (sizeByContinent.get(continentId) ?? 0) + 1);
  }

  let nextContinentId = 0;
  while (unassigned.size > 0) {
    if (unassigned.size < CONTINENT_SIZE_MIN) {
      for (const leftover of unassigned) {
        const neighborContinent = mergeTargetContinent(
          [leftover],
          adjacency,
          continentIdByTerritory,
          sizeByContinent,
        );
        assign(leftover, neighborContinent ?? Math.max(0, nextContinentId - 1));
      }
      break;
    }

    const unassignedArr = [...unassigned];
    const seed = unassignedArr[randomInt(rng, 0, unassignedArr.length - 1)];
    const targetSize = Math.min(
      unassigned.size,
      Math.max(
        CONTINENT_SIZE_MIN,
        Math.min(
          CONTINENT_SIZE_MAX,
          Math.round(
            gaussianRandom(rng, CONTINENT_SIZE_MEAN, CONTINENT_SIZE_STD_DEV),
          ),
        ),
      ),
    );

    const members = new Set<number>([seed]);
    unassigned.delete(seed);
    const frontier: number[] = [...(adjacency.get(seed) ?? [])].filter((n) =>
      unassigned.has(n),
    );

    while (members.size < targetSize && frontier.length > 0) {
      const idx = randomInt(rng, 0, frontier.length - 1);
      const next = frontier.splice(idx, 1)[0];
      if (!unassigned.has(next)) continue;
      members.add(next);
      unassigned.delete(next);
      for (const neighbor of adjacency.get(next) ?? []) {
        if (unassigned.has(neighbor) && !frontier.includes(neighbor)) {
          frontier.push(neighbor);
        }
      }
    }

    const mergeIntoContinent =
      members.size < CONTINENT_SIZE_MIN
        ? mergeTargetContinent(
            members,
            adjacency,
            continentIdByTerritory,
            sizeByContinent,
          )
        : undefined;

    if (mergeIntoContinent !== undefined) {
      for (const member of members) assign(member, mergeIntoContinent);
    } else {
      for (const member of members) assign(member, nextContinentId);
      nextContinentId++;
    }
  }

  return continentIdByTerritory;
}

export function computeBonus(continentSize: number): number {
  return Math.floor(continentSize / 2) + 1;
}
