export interface ClaimContinent {
  id: number;
  bonus: number;
  ids: number[];
  capitalIds: number[];
}

export type Placements = Map<number, Map<number, number>>;

export type Claims = Map<number, Map<number, number>>;

export interface ClaimSetup {
  continents: ClaimContinent[];
  placements: Placements;
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
}

export interface Shares {
  territory: number;
  troop: number;
  placement: number;
}

export interface Profile {
  players: Map<number, Shares>;
  troopsKnown: boolean;
  placementKnown: boolean;
}

const TERRITORY_WEIGHT = 0.5;
const TROOP_WEIGHT = 0.3;
const PLACEMENT_WEIGHT = 0.2;
const FULL_PRESENCE_SHARE = 0.5;
const CAPITAL_SPLIT = 0.35;
const CAPITAL_ONLY_BOOST = 1.15;

export function profileOf(
  continent: ClaimContinent,
  owners: Map<number, number>,
  troops: Map<number, number>,
  placed: Map<number, number> | undefined,
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
  let totalPlaced = 0;
  if (placed) for (const weight of placed.values()) totalPlaced += weight;
  const players = new Map<number, Shares>();
  for (const [playerId, entry] of held)
    players.set(playerId, {
      territory: entry.count / continent.ids.length,
      troop: totalTroops > 0 ? entry.troops / totalTroops : 0,
      placement:
        totalPlaced > 0 ? (placed?.get(playerId) ?? 0) / totalPlaced : 0,
    });
  return {
    players,
    troopsKnown: totalTroops > 0,
    placementKnown: totalPlaced > 0,
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
  return value / weight;
}

export function continentClaims(
  setup: ClaimSetup,
  continent: ClaimContinent,
  owners: Map<number, number>,
  troops: Map<number, number>,
): Map<number, number> {
  const profile = profileOf(
    continent,
    owners,
    troops,
    setup.placements.get(continent.id),
  );
  const strengths = new Map<number, number>();
  for (const [playerId, shares] of profile.players)
    strengths.set(
      playerId,
      blendedShare(shares, profile) *
        Math.min(1, shares.territory / FULL_PRESENCE_SHARE),
    );

  const capitalOwners = new Set<number>();
  for (const id of continent.capitalIds) {
    const ownerId = owners.get(id);
    if (ownerId !== undefined) capitalOwners.add(ownerId);
  }
  const split =
    capitalOwners.size > 1 ? CAPITAL_SPLIT ** (capitalOwners.size - 1) : 1;

  const claims = new Map<number, number>();
  for (const [playerId, strength] of strengths) {
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
