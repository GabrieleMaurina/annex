export interface ClaimContinent {
  id: number;
  bonus: number;
  ids: number[];
  capitalIds: number[];
}

export type Placements = Map<number, Map<number, number>>;

export type Advances = Map<number, Map<number, number>>;

export type Proximity = Map<number, Map<number, number>>;

export type Claims = Map<number, Map<number, number>>;

export interface ClaimSetup {
  botId: number;
  round: number;
  averageBonus: number;
  continents: ClaimContinent[];
  placements: Placements;
  advances: Advances;
  proximity: Proximity;
  alliedWith: (a: number, b: number) => boolean;
}

export interface Intruder {
  severity: number;
  continentId: number;
}

export interface ClaimContext {
  setup: ClaimSetup;
  current: Claims;
  greed: Map<number, number>;
  intruders: Map<number, Intruder>;
  guard: Map<number, number>;
}

export interface Shares {
  count: number;
  garrison: number;
  territory: number;
  troop: number;
  placement: number;
  proximity: number;
}

export interface Profile {
  players: Map<number, Shares>;
  troopsKnown: boolean;
  placementKnown: boolean;
  proximityKnown: boolean;
}

const TERRITORY_WEIGHT = 0.45;
const TROOP_WEIGHT = 0.25;
const PLACEMENT_WEIGHT = 0.15;
const PROXIMITY_WEIGHT = 0.15;
const PROXIMITY_PRIOR = 0.4;
const COMMITMENT = [0, 0.1, 0.35, 0.7, 1];
const DEPTH_FLOOR = 0.5;
const DEPTH_FULL_GARRISON = 4;
const FRESH_AGE = 3;
const STALE_AGE = 12;
const STALE_FLOOR = 0.6;
const CAPITAL_SPLIT = 0.35;
const CAPITAL_ONLY_BOOST = 1.15;

function commitmentOf(count: number, size: number): number {
  const span = COMMITMENT.length - 1;
  const effective = Math.min(span, (count * span) / Math.min(size, span));
  const low = Math.floor(effective);
  const high = Math.min(span, low + 1);
  return (
    COMMITMENT[low] + (COMMITMENT[high] - COMMITMENT[low]) * (effective - low)
  );
}

function depthOf(garrison: number): number {
  const depth = Math.min(
    1,
    Math.max(0, (garrison - 1) / (DEPTH_FULL_GARRISON - 1)),
  );
  return DEPTH_FLOOR + (1 - DEPTH_FLOOR) * depth;
}

function freshnessOf(
  setup: ClaimSetup,
  continentId: number,
  playerId: number,
): number {
  if (playerId === setup.botId) return 1;
  const age = setup.advances.get(continentId)?.get(playerId) ?? setup.round;
  if (age <= FRESH_AGE) return 1;
  if (age >= STALE_AGE) return STALE_FLOOR;
  return 1 - ((1 - STALE_FLOOR) * (age - FRESH_AGE)) / (STALE_AGE - FRESH_AGE);
}

export function profileOf(
  setup: ClaimSetup,
  continent: ClaimContinent,
  owners: Map<number, number>,
  troops: Map<number, number>,
): Profile {
  const held = new Map<number, { count: number; troops: number }>();
  let totalTroops = 0;
  for (const id of continent.ids) {
    const ownerId = owners.get(id);
    if (ownerId === undefined) continue;
    const garrison = troops.get(id) ?? 0;
    totalTroops += garrison;
    const entry = held.get(ownerId);
    if (entry) {
      entry.count++;
      entry.troops += garrison;
    } else held.set(ownerId, { count: 1, troops: garrison });
  }
  const placed = setup.placements.get(continent.id);
  let totalPlaced = 0;
  if (placed) for (const weight of placed.values()) totalPlaced += weight;
  const near = setup.proximity.get(continent.id);

  const players = new Map<number, Shares>();
  const add = (playerId: number) => {
    const entry = held.get(playerId);
    const count = entry?.count ?? 0;
    players.set(playerId, {
      count,
      garrison: entry ? entry.troops / entry.count : 0,
      territory: count / continent.ids.length,
      troop: entry && totalTroops > 0 ? entry.troops / totalTroops : 0,
      placement:
        totalPlaced > 0 ? (placed?.get(playerId) ?? 0) / totalPlaced : 0,
      proximity: near?.get(playerId) ?? 0,
    });
  };
  for (const playerId of held.keys()) add(playerId);
  if (near)
    for (const playerId of near.keys()) if (!held.has(playerId)) add(playerId);
  return {
    players,
    troopsKnown: totalTroops > 0,
    placementKnown: totalPlaced > 0,
    proximityKnown: near !== undefined && near.size > 0,
  };
}

export function blendedShare(shares: Shares, profile: Profile): number {
  let value = TERRITORY_WEIGHT * shares.territory;
  let weight = TERRITORY_WEIGHT;
  if (profile.troopsKnown) {
    value += TROOP_WEIGHT * shares.troop;
    weight += TROOP_WEIGHT;
  }
  if (profile.placementKnown) {
    value += PLACEMENT_WEIGHT * shares.placement;
    weight += PLACEMENT_WEIGHT;
  }
  if (profile.proximityKnown) {
    value += PROXIMITY_WEIGHT * shares.proximity;
    weight += PROXIMITY_WEIGHT;
  }
  return value / weight;
}

function strengthOf(
  setup: ClaimSetup,
  continent: ClaimContinent,
  profile: Profile,
  playerId: number,
  shares: Shares,
): number {
  if (shares.count === continent.ids.length) return 1;
  const commitment = commitmentOf(shares.count, continent.ids.length);
  const prior = profile.proximityKnown
    ? PROXIMITY_PRIOR * shares.proximity * (1 - commitment)
    : 0;
  if (shares.count === 0) return prior;
  const depth = profile.troopsKnown ? depthOf(shares.garrison) : 1;
  const earned =
    blendedShare(shares, profile) *
    commitment *
    depth *
    freshnessOf(setup, continent.id, playerId);
  return Math.min(1, earned + prior);
}

export function continentClaims(
  setup: ClaimSetup,
  continent: ClaimContinent,
  owners: Map<number, number>,
  troops: Map<number, number>,
): Map<number, number> {
  const profile = profileOf(setup, continent, owners, troops);
  const strengths = new Map<number, number>();
  for (const [playerId, shares] of profile.players) {
    const strength = strengthOf(setup, continent, profile, playerId, shares);
    if (strength > 0) strengths.set(playerId, strength);
  }

  const capitalOwners = new Set<number>();
  for (const id of continent.capitalIds) {
    const ownerId = owners.get(id);
    if (ownerId !== undefined) capitalOwners.add(ownerId);
  }
  const split =
    capitalOwners.size > 1 ? CAPITAL_SPLIT ** (capitalOwners.size - 1) : 1;

  const claims = new Map<number, number>();
  for (const [playerId, strength] of strengths) {
    if (profile.players.get(playerId)?.count === continent.ids.length) {
      claims.set(playerId, 1);
      continue;
    }
    let strongestOther = 0;
    for (const [otherId, otherStrength] of strengths)
      if (
        otherId !== playerId &&
        !setup.alliedWith(playerId, otherId) &&
        otherStrength > strongestOther
      )
        strongestOther = otherStrength;
    let claim = strength * (strength / (strength + strongestOther)) * split;
    if (capitalOwners.size === 1 && capitalOwners.has(playerId))
      claim = Math.min(1, claim * CAPITAL_ONLY_BOOST);
    claims.set(playerId, claim);
  }
  return claims;
}

export function claimsOf(
  setup: ClaimSetup,
  owners: Map<number, number>,
  troops: Map<number, number>,
): Claims {
  const claims: Claims = new Map();
  for (const continent of setup.continents)
    claims.set(continent.id, continentClaims(setup, continent, owners, troops));
  return claims;
}
