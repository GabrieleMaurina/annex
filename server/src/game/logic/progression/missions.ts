import { getGameMap } from '../../../maps';
import { Game, GameMap, Mission, MissionType } from '../../../types';
import { countTerritories, findKillerId } from './stats';

const ALL_MISSION_TYPES: MissionType[] = [
  'territories',
  'continents',
  'assassinate',
];
const TERRITORIES_FRACTIONS = [0.5, 0.75];
const CONTINENTS_FRACTION_THRESHOLD = 1 / 4;
const MIN_CONTINENTS_COMBO_SIZE = 2;
const MAX_CONTINENTS_COMBO_SIZE = 4;
const ASSASSINATE_FALLBACK_FRACTION = 3 / 4;

function popcount(mask: number): number {
  let count = 0;
  for (let m = mask; m > 0; m >>= 1) count += m & 1;
  return count;
}

export function cyclicTargets(playerIds: number[]): Map<number, number> {
  return new Map(
    playerIds.map((id, i) => [id, playerIds[(i + 1) % playerIds.length]]),
  );
}

export function generateContinentCombos(map: GameMap): number[][] {
  const territoryCountByContinent = new Map<number, number>();
  for (const territory of map.territories) {
    territoryCountByContinent.set(
      territory.continentId,
      (territoryCountByContinent.get(territory.continentId) ?? 0) + 1,
    );
  }
  const continentIds = [...territoryCountByContinent.keys()];
  const threshold = Math.ceil(
    map.territories.length * CONTINENTS_FRACTION_THRESHOLD,
  );

  const validMasks: number[] = [];
  for (let mask = 1; mask < 2 ** continentIds.length; mask++) {
    const size = popcount(mask);
    if (size < MIN_CONTINENTS_COMBO_SIZE || size > MAX_CONTINENTS_COMBO_SIZE)
      continue;
    const territoryCount = continentIds.reduce(
      (sum, id, i) =>
        (mask & (1 << i)) !== 0
          ? sum + (territoryCountByContinent.get(id) ?? 0)
          : sum,
      0,
    );
    if (territoryCount >= threshold) validMasks.push(mask);
  }

  const minimalMasks = validMasks.filter(
    (mask) =>
      !validMasks.some((other) => other !== mask && (mask & other) === other),
  );

  return minimalMasks.map((mask) =>
    continentIds.filter((_, i) => (mask & (1 << i)) !== 0),
  );
}

export function assignMissions(
  game: Game,
  allowedTypes: MissionType[] = ALL_MISSION_TYPES,
): Map<number, Mission> {
  const targets = cyclicTargets(game.playerIds);
  const map = getGameMap(game);
  const continentCombos = generateContinentCombos(map);
  const types =
    continentCombos.length > 0
      ? allowedTypes
      : allowedTypes.filter((t) => t !== 'continents');

  const missions = new Map<number, Mission>();
  for (const id of game.playerIds) {
    const type = types[Math.floor(Math.random() * types.length)];
    if (type === 'territories') {
      const fraction =
        TERRITORIES_FRACTIONS[
          Math.floor(Math.random() * TERRITORIES_FRACTIONS.length)
        ];
      missions.set(id, {
        type: 'territories',
        fraction,
        minTroopsPerTerritory: fraction === 0.5 ? 2 : 1,
      });
    } else if (type === 'continents') {
      const combo =
        continentCombos[Math.floor(Math.random() * continentCombos.length)];
      missions.set(id, { type: 'continents', continentIds: combo });
    } else {
      missions.set(id, { type: 'assassinate', targetId: targets.get(id)! });
    }
  }
  return missions;
}

export function missionAccomplished(
  game: Game,
  playerId: number,
  mission: Mission,
): boolean {
  const totalTerritories = game.territoryOwners.size;

  if (mission.type === 'territories') {
    const threshold = Math.ceil(totalTerritories * mission.fraction);
    let count = 0;
    for (const [territoryId, ownerId] of game.territoryOwners) {
      if (
        ownerId === playerId &&
        (game.territoryTroops.get(territoryId) ?? 0) >=
          mission.minTroopsPerTerritory
      )
        count++;
    }
    return count >= threshold;
  }

  if (mission.type === 'continents') {
    const map = getGameMap(game);
    return mission.continentIds.every((continentId) =>
      map.territories
        .filter((t) => t.continentId === continentId)
        .every((t) => game.territoryOwners.get(t.id) === playerId),
    );
  }

  const killerId = findKillerId(game, mission.targetId);
  if (killerId === playerId) return true;
  if (killerId === undefined) return false;
  const threshold = Math.ceil(totalTerritories * ASSASSINATE_FALLBACK_FRACTION);
  return countTerritories(game, playerId) >= threshold;
}
