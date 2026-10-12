import { supplyHubTerritoryIds } from '../../game/mechanics';
import { connectedFortifyTerritories } from '../../game/world/connectivity';
import { getGameMap } from '../../maps/maps';
import { Game } from '../../types';
import { isTeammate } from '../features/mode/mode';
import {
  isFrontier,
  isKeyTerritory,
  neighborsOf,
  ownedTerritoryIds,
} from '../features/territory';
import { Weights } from '../types';
import { BotView } from '../view';

const MAX_ENTRENCH_TROOPS = 5;

function continentsOf(game: Game): Map<number, number[]> {
  const continents = new Map<number, number[]>();
  for (const territory of getGameMap(game).territories) {
    if (game.radiationTerritoryIds.has(territory.id)) continue;
    const list = continents.get(territory.continentId);
    if (list) list.push(territory.id);
    else continents.set(territory.continentId, [territory.id]);
  }
  return continents;
}

function bonusOf(game: Game, continentId: number): number {
  if (game.continents === 'off') return 0;
  return getGameMap(game).bonuses[continentId] ?? 0;
}

const CLAIM_ADJACENCY = 0.5;
const RIVAL_DISTANCE_WEIGHT = 1;
const RIVAL_DISTANCE_CAP = 3;
const RIVAL_HELD_SHARE = 0.3;
const ENTRY_WEIGHT = 0.5;
const BLOCK_WEIGHT = 0.5;
const TIE_BREAK = 0.01;

interface ContinentClaims {
  ids: number[];
  entries: Set<number>;
  own: number;
  rivals: number;
  strongestRival: number;
  unclaimed: number;
}

function isRival(game: Game, botId: number, ownerId: number): boolean {
  return ownerId !== botId && !isTeammate(game, botId, ownerId);
}

function continentClaims(
  game: Game,
  botId: number,
  continents: Map<number, number[]>,
): Map<number, ContinentClaims> {
  const continentOf = new Map(
    getGameMap(game).territories.map((t) => [t.id, t.continentId]),
  );
  const claims = new Map<number, ContinentClaims>();
  for (const [continentId, ids] of continents) {
    const byRival = new Map<number, number>();
    let own = 0;
    let unclaimed = 0;
    for (const id of ids) {
      const ownerId = game.territoryOwners.get(id);
      if (ownerId === undefined) unclaimed++;
      else if (ownerId === botId) own++;
      else if (isRival(game, botId, ownerId))
        byRival.set(ownerId, (byRival.get(ownerId) ?? 0) + 1);
    }
    const counts = [...byRival.values()];
    claims.set(continentId, {
      ids,
      entries: new Set(
        ids.filter((id) =>
          neighborsOf(game, id).some((n) => continentOf.get(n) !== continentId),
        ),
      ),
      own,
      rivals: counts.reduce((sum, n) => sum + n, 0),
      strongestRival: Math.max(0, ...counts),
      unclaimed,
    });
  }
  return claims;
}

function rivalDistances(
  game: Game,
  botId: number,
  links: Map<number, number[]>,
): Map<number, number> {
  const distance = new Map<number, number>();
  const queue: number[] = [];
  for (const [id, ownerId] of game.territoryOwners)
    if (isRival(game, botId, ownerId)) {
      distance.set(id, 0);
      queue.push(id);
    }
  for (let i = 0; i < queue.length; i++)
    for (const n of links.get(queue[i]) ?? [])
      if (!distance.has(n)) {
        distance.set(n, distance.get(queue[i])! + 1);
        queue.push(n);
      }
  return distance;
}

function claimValue(
  game: Game,
  botId: number,
  territoryId: number,
  continentId: number,
  claims: ContinentClaims,
  rivalDistance: number,
): number {
  const size = claims.ids.length;
  const bonus = bonusOf(game, continentId);
  const perEntry = bonus / Math.max(1, claims.entries.size);
  const progress = (claims.own + 1) / size;
  const rivalHeld = claims.strongestRival > claims.own ? RIVAL_HELD_SHARE : 1;
  const pursuit = perEntry * progress * rivalHeld * (1 - claims.rivals / size);
  const entry =
    claims.own > 0 && claims.entries.has(territoryId)
      ? ENTRY_WEIGHT * perEntry * progress
      : 0;
  const adjacent = neighborsOf(game, territoryId).filter(
    (n) => game.territoryOwners.get(n) === botId,
  ).length;
  const block =
    bonus > 0 &&
    adjacent > 0 &&
    claims.unclaimed === 1 &&
    claims.strongestRival === size - 1
      ? BLOCK_WEIGHT * bonus
      : 0;
  const distance =
    (RIVAL_DISTANCE_WEIGHT * Math.min(rivalDistance, RIVAL_DISTANCE_CAP)) /
    RIVAL_DISTANCE_CAP;
  return pursuit + entry + block + distance + CLAIM_ADJACENCY * adjacent;
}

export function chooseTerritoryClaim(
  game: Game,
  botId: number,
  noise: number,
): number | null {
  const unclaimed = getGameMap(game).territories.filter(
    (t) =>
      !game.territoryOwners.has(t.id) && !game.radiationTerritoryIds.has(t.id),
  );
  if (unclaimed.length === 0) return null;
  const claims = continentClaims(game, botId, continentsOf(game));
  const distances = rivalDistances(game, botId, landLinks(game));
  let best: number | null = null;
  let bestValue = -Infinity;
  for (const territory of unclaimed) {
    const value =
      claimValue(
        game,
        botId,
        territory.id,
        territory.continentId,
        claims.get(territory.continentId)!,
        distances.get(territory.id) ?? RIVAL_DISTANCE_CAP,
      ) +
      (Math.random() - 0.5) * noise +
      Math.random() * TIE_BREAK;
    if (value > bestValue) {
      bestValue = value;
      best = territory.id;
    }
  }
  return best;
}

export function chooseTroopPlacement(game: Game, botId: number): number | null {
  const owned = ownedTerritoryIds(game, botId);
  if (owned.length === 0) return null;
  if (game.supplyLines !== 'on')
    return owned[Math.floor(Math.random() * owned.length)];
  const reachable = connectedFortifyTerritories(
    game,
    botId,
    supplyHubTerritoryIds(game, botId),
  );
  const connected = owned.filter((id) => reachable.has(id));
  if (connected.length === 0) return null;
  return connected[Math.floor(Math.random() * connected.length)];
}

const PROTECTION_WEIGHT = 2;
const CENTRALITY_WEIGHT = 1;
const TRAFFIC_WEIGHT = 0.5;

function landLinks(game: Game): Map<number, number[]> {
  const map = getGameMap(game);
  const seaNeighbors = new Map(
    map.seaTerritories.map((s) => [s.id, s.neighbors]),
  );
  const links = new Map<number, number[]>();
  for (const territory of map.territories) {
    if (game.radiationTerritoryIds.has(territory.id)) continue;
    const linked = new Set<number>();
    for (const n of neighborsOf(game, territory.id))
      for (const m of seaNeighbors.get(n) ?? [n])
        if (
          m !== territory.id &&
          !seaNeighbors.has(m) &&
          !game.radiationTerritoryIds.has(m)
        )
          linked.add(m);
    links.set(territory.id, [...linked]);
  }
  return links;
}

function averageDistance(
  links: Map<number, number[]>,
  startId: number,
): number {
  const distance = new Map<number, number>([[startId, 0]]);
  const queue = [startId];
  let total = 0;
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    for (const n of links.get(current) ?? []) {
      if (distance.has(n)) continue;
      const d = distance.get(current)! + 1;
      distance.set(n, d);
      total += d;
      queue.push(n);
    }
  }
  return distance.size > 1 ? total / (distance.size - 1) : links.size;
}

function bonusProtection(
  game: Game,
  botId: number,
  continents: Map<number, number[]>,
): Map<number, number> {
  const continentOf = new Map(
    getGameMap(game).territories.map((t) => [t.id, t.continentId]),
  );
  const protection = new Map<number, number>();
  for (const [continentId, ids] of continents) {
    const bonus = bonusOf(game, continentId);
    if (bonus <= 0) continue;
    const share =
      ids.filter((id) => game.territoryOwners.get(id) === botId).length /
      ids.length;
    const entries = ids.filter((id) =>
      neighborsOf(game, id).some((n) => continentOf.get(n) !== continentId),
    );
    for (const id of entries)
      protection.set(id, (bonus * share * share) / entries.length);
  }
  return protection;
}

function normalized(values: Map<number, number>): Map<number, number> {
  const all = [...values.values()];
  const min = Math.min(...all);
  const max = Math.max(...all);
  return new Map(
    [...values].map(([id, v]) => [
      id,
      max === min ? 0 : (v - min) / (max - min),
    ]),
  );
}

export function chooseCapital(game: Game, botId: number): number | null {
  const owned = ownedTerritoryIds(game, botId);
  if (owned.length === 0) return null;
  const links = landLinks(game);
  const protection = bonusProtection(game, botId, continentsOf(game));
  const centrality = normalized(
    new Map(owned.map((id) => [id, -averageDistance(links, id)])),
  );
  const traffic = normalized(
    new Map(owned.map((id) => [id, neighborsOf(game, id).length])),
  );
  const value = (id: number) =>
    PROTECTION_WEIGHT * (protection.get(id) ?? 0) +
    CENTRALITY_WEIGHT * (centrality.get(id) ?? 0) +
    TRAFFIC_WEIGHT * (traffic.get(id) ?? 0);
  return owned.reduce((best, id) => (value(id) > value(best) ? id : best));
}

export function chooseEntrench(
  game: Game,
  view: BotView,
  botId: number,
  weights: Weights,
): { territoryId: number; troops: number } | null {
  if (weights.defendFrontier < 1) return null;
  const owned = ownedTerritoryIds(game, botId)
    .filter(
      (id) =>
        !game.capitalTerritoryIds.has(id) &&
        (game.territoryTroops.get(id) ?? 0) >= 3 &&
        isFrontier(game, view, botId, id),
    )
    .sort(
      (a, b) =>
        Number(isKeyTerritory(game, b)) - Number(isKeyTerritory(game, a)),
    );
  if (owned.length === 0) return null;
  const territoryId = owned[0];
  const troops = Math.min(
    MAX_ENTRENCH_TROOPS,
    Math.floor((game.territoryTroops.get(territoryId) ?? 0) / 2),
  );
  return troops >= 1 ? { territoryId, troops } : null;
}
