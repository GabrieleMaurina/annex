import { alliedIds } from '../../game/alliances';
import { getGameMap } from '../../maps/maps';
import { Game } from '../../types';
import { BotView, ownerOf, troopsAt } from '../view';
import { claimsOf } from './model';
import { buildClaimSetup } from './snapshot';

export function setupRivalClaims(
  game: Game,
  view: BotView,
  botId: number,
  links: Map<number, number[]>,
): Map<number, number> {
  const map = getGameMap(game);
  const continentTerritories = new Map<number, number[]>();
  const owners = new Map<number, number>();
  const troops = new Map<number, number>();
  for (const territory of map.territories) {
    if (territory.continentId < 0) continue;
    const list = continentTerritories.get(territory.continentId);
    if (list) list.push(territory.id);
    else continentTerritories.set(territory.continentId, [territory.id]);
    const ownerId = ownerOf(game, view, territory.id);
    if (ownerId === undefined) continue;
    owners.set(territory.id, ownerId);
    troops.set(territory.id, troopsAt(game, view, territory.id));
  }
  const setup = buildClaimSetup(
    game,
    view,
    botId,
    continentTerritories,
    map.bonuses,
    links,
    owners,
  );
  const friends = alliedIds(game, botId);
  const rivals = new Map<number, number>();
  for (const [continentId, byPlayer] of claimsOf(setup, owners, troops)) {
    let strongest = 0;
    for (const [playerId, claim] of byPlayer)
      if (playerId !== botId && !friends.has(playerId) && claim > strongest)
        strongest = claim;
    rivals.set(continentId, strongest);
  }
  return rivals;
}
