import { areAllied } from '../../game/alliances';
import { BotPersonality, Game } from '../../types';
import { isTeammate } from '../features/mode/mode';
import { Standing } from '../features/standing';
import { isHazardTerritory } from '../features/territory';
import { DifficultyParams } from '../types';
import { BotView } from '../view';
import {
  ClaimContext,
  ClaimContinent,
  ClaimSetup,
  Claims,
  Intruder,
  blendedShare,
  claimsOf,
  profileOf,
} from './model';
import { recentActivity } from './placements';
import { proximityOf } from './proximity';

const STRONG_CLAIM = 0.5;
const PENDING_CLAIM_COUNT = 0.5;
const GREED_FREE_CONTINENTS = 1;
const GREED_SPAN = 3;
const INTRUSION_GAIN = 2;
const GREED_PREFERENCE = 0.25;
const GUARD_MIN_CLAIM = 0.3;
const GUARD_GAIN = 0.5;
const GUARD_CAP = 2;

export function claimsEnabled(
  game: Game,
  personality: BotPersonality,
  params: DifficultyParams,
): boolean {
  return (
    personality === 'balanced' && params.claims && game.continents !== 'off'
  );
}

function capitalAnchors(
  game: Game,
  owners: Map<number, number>,
): Map<number, number[]> {
  const anchors = new Map<number, number[]>();
  for (const id of game.capitalTerritoryIds) {
    const ownerId = owners.get(id);
    if (ownerId === undefined) continue;
    const list = anchors.get(ownerId);
    if (list) list.push(id);
    else anchors.set(ownerId, [id]);
  }
  return anchors;
}

export function buildClaimSetup(
  game: Game,
  view: BotView,
  botId: number,
  continentTerritories: Map<number, number[]>,
  bonuses: number[],
  links: Map<number, number[]>,
  owners: Map<number, number>,
): ClaimSetup {
  const continents: ClaimContinent[] = [];
  const continentOf = new Map<number, number>();
  for (const [id, ids] of continentTerritories) {
    for (const territoryId of ids) continentOf.set(territoryId, id);
    const bonus = bonuses[id] ?? 0;
    if (bonus <= 0) continue;
    const contested = ids.filter((t) => !isHazardTerritory(game, view, t));
    if (contested.length === 0) continue;
    continents.push({
      id,
      bonus,
      ids: contested,
      capitalIds: contested.filter((t) => game.capitalTerritoryIds.has(t)),
    });
  }
  const { placements, advances } = recentActivity(game, botId, continentOf);
  return {
    botId,
    round: game.roundNumber,
    averageBonus:
      continents.reduce((sum, c) => sum + c.bonus, 0) /
      Math.max(1, continents.length),
    continents,
    placements,
    advances,
    proximity: proximityOf(continents, links, capitalAnchors(game, owners)),
    alliedWith: (a, b) => areAllied(game, a, b) || isTeammate(game, a, b),
  };
}

function greedOf(
  setup: ClaimSetup,
  claims: Claims,
  owners: Map<number, number>,
  playerId: number,
): number {
  let held = 0;
  let pending = 0;
  for (const continent of setup.continents) {
    if (continent.ids.every((id) => owners.get(id) === playerId))
      held += continent.bonus;
    else if ((claims.get(continent.id)?.get(playerId) ?? 0) >= STRONG_CLAIM)
      pending += continent.bonus;
  }
  const continents =
    (held + PENDING_CLAIM_COUNT * pending) / Math.max(1, setup.averageBonus);
  return Math.min(
    1,
    Math.max(0, (continents - GREED_FREE_CONTINENTS) / GREED_SPAN),
  );
}

function intrudersOf(
  setup: ClaimSetup,
  claims: Claims,
  owners: Map<number, number>,
  troops: Map<number, number>,
  isFriend: (playerId: number) => boolean,
): Map<number, Intruder> {
  const intruders = new Map<number, Intruder>();
  for (const continent of setup.continents) {
    const own = claims.get(continent.id)?.get(setup.botId) ?? 0;
    if (own < STRONG_CLAIM) continue;
    const profile = profileOf(setup, continent, owners, troops);
    for (const [playerId, shares] of profile.players) {
      if (shares.count === 0 || playerId === setup.botId || isFriend(playerId))
        continue;
      const severity =
        own * Math.min(1, INTRUSION_GAIN * blendedShare(shares, profile));
      if (severity > (intruders.get(playerId)?.severity ?? 0))
        intruders.set(playerId, { severity, continentId: continent.id });
    }
  }
  return intruders;
}

function guardOf(setup: ClaimSetup, claims: Claims): Map<number, number> {
  const guard = new Map<number, number>();
  for (const continent of setup.continents) {
    const own = claims.get(continent.id)?.get(setup.botId) ?? 0;
    if (own < GUARD_MIN_CLAIM) continue;
    const weight = Math.min(
      GUARD_CAP,
      1 +
        (GUARD_GAIN * own * continent.bonus) / Math.max(1, setup.averageBonus),
    );
    for (const id of continent.ids) guard.set(id, weight);
  }
  return guard;
}

export function buildClaimContext(
  game: Game,
  view: BotView,
  botId: number,
  friendlyIds: Set<number>,
  continentTerritories: Map<number, number[]>,
  bonuses: number[],
  links: Map<number, number[]>,
  owners: Map<number, number>,
  troops: Map<number, number>,
): ClaimContext {
  const setup = buildClaimSetup(
    game,
    view,
    botId,
    continentTerritories,
    bonuses,
    links,
    owners,
  );
  const current = claimsOf(setup, owners, troops);
  const isFriend = (playerId: number) => friendlyIds.has(playerId);
  const greed = new Map<number, number>();
  for (const ownerId of new Set(owners.values()))
    if (ownerId !== botId && !isFriend(ownerId))
      greed.set(ownerId, greedOf(setup, current, owners, ownerId));
  return {
    setup,
    current,
    greed,
    intruders: intrudersOf(setup, current, owners, troops, isFriend),
    guard: guardOf(setup, current),
  };
}

export function withGreedStanding(
  standing: Standing,
  greed: Map<number, number>,
): Standing {
  const preference = new Map(standing.preference);
  for (const [playerId, level] of greed)
    preference.set(
      playerId,
      (preference.get(playerId) ?? 0) + GREED_PREFERENCE * (2 * level - 1),
    );
  return { ...standing, preference };
}
