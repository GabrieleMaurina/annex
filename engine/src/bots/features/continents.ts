import { getGameMap } from '../../maps/maps';
import { Game } from '../../types';
import { BotView, ownerOf } from '../view';
import { isTeammate } from './mode';
import { isHazardTerritory } from './territory';

function continentGroups(game: Game): Map<number, number[]> {
  const map = getGameMap(game);
  const continents = new Map<number, number[]>();
  for (const territory of map.territories) {
    const list = continents.get(territory.continentId);
    if (list) list.push(territory.id);
    else continents.set(territory.continentId, [territory.id]);
  }
  return continents;
}

export interface ContinentCompletionCandidate {
  continentId: number;
  bonus: number;
  remainingTerritoryIds: number[];
}

export function continentCompletionCandidates(
  game: Game,
  view: BotView,
  botId: number,
): ContinentCompletionCandidate[] {
  const map = getGameMap(game);
  const candidates: ContinentCompletionCandidate[] = [];
  for (const [continentId, territoryIds] of continentGroups(game)) {
    if ((map.bonuses[continentId] ?? 0) <= 0) continue;
    const contested = territoryIds.filter(
      (id) => !isHazardTerritory(game, view, id),
    );
    const owned = contested.filter((id) => ownerOf(game, view, id) === botId);
    if (owned.length === 0) continue;
    const remaining = contested.filter((id) => {
      const ownerId = ownerOf(game, view, id);
      return ownerId !== undefined && ownerId !== botId;
    });
    if (remaining.length === 0) continue;
    if (
      remaining.some((id) => {
        const ownerId = ownerOf(game, view, id);
        return ownerId !== undefined && isTeammate(game, botId, ownerId);
      })
    )
      continue;
    candidates.push({
      continentId,
      bonus: map.bonuses[continentId] ?? 0,
      remainingTerritoryIds: remaining,
    });
  }
  return candidates;
}

export interface ContinentBreakCandidate {
  continentId: number;
  ownerId: number;
  bonus: number;
  weakestTerritoryId: number;
}

export function continentBreakCandidates(
  game: Game,
  view: BotView,
  botId: number,
): ContinentBreakCandidate[] {
  const map = getGameMap(game);
  const candidates: ContinentBreakCandidate[] = [];
  for (const [continentId, territoryIds] of continentGroups(game)) {
    if ((map.bonuses[continentId] ?? 0) <= 0 || territoryIds.length < 2)
      continue;
    const held = territoryIds.filter(
      (id) =>
        !isHazardTerritory(game, view, id) &&
        ownerOf(game, view, id) !== undefined,
    );
    if (held.length === 0) continue;
    const ownerId = ownerOf(game, view, held[0]);
    if (
      ownerId === undefined ||
      ownerId === botId ||
      isTeammate(game, botId, ownerId) ||
      !held.every((id) => ownerOf(game, view, id) === ownerId)
    )
      continue;

    let weakestId = held[0];
    let weakestTroops = Infinity;
    for (const id of held) {
      const troops = game.territoryTroops.get(id) ?? 0;
      if (troops < weakestTroops) {
        weakestTroops = troops;
        weakestId = id;
      }
    }
    candidates.push({
      continentId,
      ownerId,
      bonus: map.bonuses[continentId] ?? 0,
      weakestTerritoryId: weakestId,
    });
  }
  return candidates;
}
