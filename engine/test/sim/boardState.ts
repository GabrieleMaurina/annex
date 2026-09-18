import { getGameMap } from '../../src/maps/maps';
import { Game } from '../../src/types';

export interface PlayerSample {
  playerId: number;
  territories: number;
  troops: number;
  maxBorderStack: number;
  ships: number;
  landEnemies: number;
  seaEnemies: number;
}

export interface RoundSample {
  round: number;
  players: PlayerSample[];
}

export interface BoardSnapshot {
  territoryIds: number[];
  owners: (number | null)[];
  troops: number[];
  seaShips: [number, number, number][];
}

interface Accumulator {
  territories: number;
  troops: number;
  maxBorderStack: number;
  landEnemies: Set<number>;
  seas: Set<number>;
}

function addToSet<K, V>(map: Map<K, Set<V>>, key: K, value: V): void {
  const set = map.get(key);
  if (set) set.add(value);
  else map.set(key, new Set([value]));
}

function shipsOf(game: Game, playerId: number): number {
  let ships = 0;
  for (const shipsByPlayer of game.seaShips.values())
    ships += shipsByPlayer.get(playerId) ?? 0;
  return ships;
}

export function samplePlayers(game: Game, playerIds: number[]): PlayerSample[] {
  const map = getGameMap(game);
  const seaIds = new Set(map.seaTerritories.map((t) => t.id));
  const ownersBySea = new Map<number, Set<number>>();
  const accumulators = new Map<number, Accumulator>();

  for (const territory of map.territories) {
    const ownerId = game.territoryOwners.get(territory.id);
    if (ownerId === undefined) continue;
    const acc = accumulators.get(ownerId) ?? {
      territories: 0,
      troops: 0,
      maxBorderStack: 0,
      landEnemies: new Set<number>(),
      seas: new Set<number>(),
    };
    accumulators.set(ownerId, acc);

    const troops = game.territoryTroops.get(territory.id) ?? 0;
    acc.territories++;
    acc.troops += troops;

    let onLandBorder = false;
    for (const neighborId of territory.neighbors) {
      if (seaIds.has(neighborId)) {
        acc.seas.add(neighborId);
        addToSet(ownersBySea, neighborId, ownerId);
        continue;
      }
      const neighborOwner = game.territoryOwners.get(neighborId);
      if (neighborOwner === undefined || neighborOwner === ownerId) continue;
      acc.landEnemies.add(neighborOwner);
      onLandBorder = true;
    }
    if (onLandBorder) acc.maxBorderStack = Math.max(acc.maxBorderStack, troops);
  }

  return playerIds
    .filter((playerId) => accumulators.has(playerId))
    .map((playerId) => {
      const acc = accumulators.get(playerId)!;
      const seaEnemies = new Set<number>();
      for (const seaId of acc.seas)
        for (const ownerId of ownersBySea.get(seaId) ?? [])
          if (ownerId !== playerId) seaEnemies.add(ownerId);
      return {
        playerId,
        territories: acc.territories,
        troops: acc.troops,
        maxBorderStack: acc.maxBorderStack,
        ships: shipsOf(game, playerId),
        landEnemies: acc.landEnemies.size,
        seaEnemies: seaEnemies.size,
      };
    });
}

export function snapshotBoard(game: Game): BoardSnapshot {
  const territoryIds = getGameMap(game).territories.map((t) => t.id);
  const seaShips: [number, number, number][] = [];
  for (const [seaId, shipsByPlayer] of game.seaShips)
    for (const [playerId, ships] of shipsByPlayer)
      if (ships > 0) seaShips.push([seaId, playerId, ships]);
  return {
    territoryIds,
    owners: territoryIds.map((id) => game.territoryOwners.get(id) ?? null),
    troops: territoryIds.map((id) => game.territoryTroops.get(id) ?? 0),
    seaShips,
  };
}

export function totalConquests(game: Game, playerIds: number[]): number {
  return playerIds.reduce(
    (sum, id) => sum + (game.stats.get(id)?.territoriesConquered ?? 0),
    0,
  );
}
