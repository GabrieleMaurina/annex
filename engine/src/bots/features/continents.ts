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
    const owned = territoryIds.filter(
      (id) => ownerOf(game, view, id) === botId,
    );
    if (owned.length === 0 || owned.length === territoryIds.length) continue;
    const remaining = territoryIds.filter(
      (id) => ownerOf(game, view, id) !== botId,
    );
    if (
      remaining.some((id) => {
        const ownerId = ownerOf(game, view, id);
        return ownerId !== undefined && isTeammate(game, botId, ownerId);
      })
    )
      continue;
    if (remaining.some((id) => isHazardTerritory(game, view, id))) continue;
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
    const owners = territoryIds.map((id) => ownerOf(game, view, id));
    const firstOwner = owners[0];
    if (
      firstOwner === undefined ||
      firstOwner === botId ||
      isTeammate(game, botId, firstOwner) ||
      !owners.every((o) => o === firstOwner)
    )
      continue;

    let weakestId = territoryIds[0];
    let weakestTroops = Infinity;
    for (const id of territoryIds) {
      const troops = game.territoryTroops.get(id) ?? 0;
      if (troops < weakestTroops) {
        weakestTroops = troops;
        weakestId = id;
      }
    }
    candidates.push({
      continentId,
      ownerId: firstOwner,
      bonus: map.bonuses[continentId] ?? 0,
      weakestTerritoryId: weakestId,
    });
  }
  return candidates;
}
