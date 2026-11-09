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
import { recentPlacements } from './placements';

const STRONG_CLAIM = 0.5;
const PENDING_CLAIM_COUNT = 0.5;
const GREED_FREE_COUNT = 1;
const GREED_SPAN = 3;
const INTRUSION_GAIN = 2;
const GREED_PREFERENCE = 0.25;

export function claimsEnabled(
  game: Game,
  personality: BotPersonality,
  params: DifficultyParams,
): boolean {
  return (
    personality === 'balanced' && params.claims && game.continents !== 'off'
  );
}

export function buildClaimSetup(
  game: Game,
  view: BotView,
  botId: number,
  continentTerritories: Map<number, number[]>,
  bonuses: number[],
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
  return {
    continents,
    placements: recentPlacements(game, botId, continentOf),
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
    if (continent.ids.every((id) => owners.get(id) === playerId)) held++;
    else if ((claims.get(continent.id)?.get(playerId) ?? 0) >= STRONG_CLAIM)
      pending++;
  }
  const effective = held + PENDING_CLAIM_COUNT * pending;
  return Math.min(1, Math.max(0, (effective - GREED_FREE_COUNT) / GREED_SPAN));
}

function intrudersOf(
  setup: ClaimSetup,
  claims: Claims,
  owners: Map<number, number>,
  troops: Map<number, number>,
  botId: number,
  isFriend: (playerId: number) => boolean,
): Map<number, Intruder> {
  const intruders = new Map<number, Intruder>();
  for (const continent of setup.continents) {
    const own = claims.get(continent.id)?.get(botId) ?? 0;
    if (own < STRONG_CLAIM) continue;
    const profile = profileOf(
      continent,
      owners,
      troops,
      setup.placements.get(continent.id),
    );
    for (const [playerId, shares] of profile.players) {
      if (playerId === botId || isFriend(playerId)) continue;
      const severity =
        own * Math.min(1, INTRUSION_GAIN * blendedShare(shares, profile));
      if (severity > (intruders.get(playerId)?.severity ?? 0))
        intruders.set(playerId, { severity, continentId: continent.id });
    }
  }
  return intruders;
}

export function buildClaimContext(
  game: Game,
  view: BotView,
  botId: number,
  friendlyIds: Set<number>,
  continentTerritories: Map<number, number[]>,
  bonuses: number[],
  owners: Map<number, number>,
  troops: Map<number, number>,
): ClaimContext {
  const setup = buildClaimSetup(
    game,
    view,
    botId,
    continentTerritories,
    bonuses,
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
    intruders: intrudersOf(setup, current, owners, troops, botId, isFriend),
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
