import { DEFAULT_PLAYER_ODDS, Game, PlayerOdds } from '../../types';
import { isInteger } from '../../util/validate';

const MIN_TERRITORY_ODDS = 10;
const MAX_TERRITORY_ODDS = 1000;
export const MAX_BLITZ_OFF_TROOPS = 10;

function isTroopsOdds(value: unknown): value is number | null {
  return value === null || (isInteger(value) && value >= 1 && value <= 100);
}

function isMinTroopsOdds(value: unknown): value is number | null {
  return value === null || (isInteger(value) && value >= 0 && value <= 100);
}

function exceedsBlitzOff(odds: PlayerOdds): boolean {
  return (
    (odds.troops ?? 0) > MAX_BLITZ_OFF_TROOPS ||
    (odds.minTroops ?? 0) > MAX_BLITZ_OFF_TROOPS
  );
}

export function oddsAllowBlitzOff(
  game: Game,
  settings: Record<string, unknown>,
): boolean {
  if (settings.odds === 'off') return true;
  const effective = new Map(game.playerOdds);
  if (Array.isArray(settings.playerOdds))
    for (const entry of settings.playerOdds)
      if (typeof entry === 'object' && entry !== null)
        effective.set(entry.playerId, entry);
  return ![...effective.values()].some(exceedsBlitzOff);
}

export function setPlayerOdds(game: Game, entries: unknown): boolean {
  if (game.odds !== 'on' || !Array.isArray(entries)) return false;
  const parsed = new Map<number, PlayerOdds>();
  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null) return false;
    const { playerId, territories, troops, minTroops } = entry as Record<
      string,
      unknown
    >;
    if (
      !isInteger(playerId) ||
      !game.playerIds.includes(playerId) ||
      !isInteger(territories) ||
      territories < MIN_TERRITORY_ODDS ||
      territories > MAX_TERRITORY_ODDS ||
      !isTroopsOdds(troops) ||
      !isMinTroopsOdds(minTroops)
    )
      return false;
    const odds = { territories, troops, minTroops };
    if (game.blitz === 'off' && exceedsBlitzOff(odds)) return false;
    parsed.set(playerId, odds);
  }
  for (const [playerId, odds] of parsed) {
    const isDefault =
      odds.territories === DEFAULT_PLAYER_ODDS.territories &&
      odds.troops === null &&
      odds.minTroops === null;
    if (isDefault) game.playerOdds.delete(playerId);
    else game.playerOdds.set(playerId, odds);
  }
  return true;
}
