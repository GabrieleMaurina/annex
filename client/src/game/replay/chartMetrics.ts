import {
  continentHolderId,
  deployBreakdownFor,
  isProgressive,
  progressiveBonuses,
} from 'engine';
import type {
  GameState,
  ReplayTerritory,
  ReplayToxinTerritory,
} from '../../lib/types';
import type { FoldedReplay, ReplayData } from './replay';

export interface ChartMap {
  territories: { id: number; continentId: number }[];
  bonuses: number[];
}

function continentGroups(map: ChartMap): Map<number, number[]> {
  const groups = new Map<number, number[]>();
  for (const territory of map.territories) {
    if (territory.continentId < 0) continue;
    const list = groups.get(territory.continentId);
    if (list) list.push(territory.id);
    else groups.set(territory.continentId, [territory.id]);
  }
  return groups;
}

function blockedIds(
  radiation: number[],
  toxins: ReplayToxinTerritory[],
): Set<number> {
  return new Set([...radiation, ...toxins.map((t) => t.id)]);
}

function holdersByContinent(
  groups: Map<number, number[]>,
  territories: ReplayTerritory[],
  blocked: Set<number>,
): Map<number, number> {
  const ownerById = new Map(territories.map((t) => [t.id, t.ownerId]));
  const holders = new Map<number, number>();
  for (const [continentId, ids] of groups) {
    const holder = continentHolderId(
      ids.filter((id) => !blocked.has(id)).map((id) => ownerById.get(id)),
    );
    if (holder !== null) holders.set(continentId, holder);
  }
  return holders;
}

export function continentsHeldBySample(
  map: ChartMap,
  replay: ReplayData,
): Map<number, number>[] {
  const groups = continentGroups(map);
  const states = [
    {
      territories: replay.initial,
      blocked: blockedIds(replay.initialRadiation, []),
    },
    ...replay.frames.map((frame) => ({
      territories: frame.territories,
      blocked: blockedIds(frame.radiationTerritories, frame.toxinTerritories),
    })),
  ];
  return states.map(({ territories, blocked }) => {
    const counts = new Map<number, number>();
    for (const holder of holdersByContinent(
      groups,
      territories,
      blocked,
    ).values())
      counts.set(holder, (counts.get(holder) ?? 0) + 1);
    return counts;
  });
}

export function generationBySample(
  game: GameState,
  map: ChartMap,
  replay: FoldedReplay,
  capitalIds: Set<number>,
): Map<number, number>[] {
  const groups = continentGroups(map);
  const { initial, initialRadiation, frames } = replay.data;
  const payouts = map.bonuses.map(() => 0);
  let bonuses = isProgressive(game.continents)
    ? progressiveBonuses(game.continents, payouts)
    : game.continentBonuses.length > 0
      ? game.continentBonuses
      : map.bonuses;

  const turns = replay.turnMarkers.map((marker) => {
    const previous = frames[marker.afterFrame - 1];
    const next = frames[marker.afterFrame];
    const settled = next?.roundNumber === marker.roundNumber ? next : previous;
    const radiation = new Set(
      settled?.radiationTerritories ?? initialRadiation,
    );
    const territories = (previous?.territories ?? initial).filter(
      (t) => !radiation.has(t.id),
    );
    const blocked = blockedIds([...radiation], settled?.toxinTerritories ?? []);
    const held = [...holdersByContinent(groups, territories, blocked)]
      .filter(([, holder]) => holder === marker.playerId)
      .map(([continentId]) => continentId);
    const owned = territories.filter((t) => t.ownerId === marker.playerId);
    const breakdown = deployBreakdownFor(game, {
      roundNumber: marker.roundNumber,
      playerIndex: game.players.findIndex((p) => p.id === marker.playerId),
      territoryCount: owned.length,
      heldBonuses: held.reduce((sum, id) => sum + (bonuses[id] ?? 0), 0),
      capitalsControlled: owned.filter((t) => capitalIds.has(t.id)).length,
      kills:
        previous?.playerStates.find((s) => s.playerId === marker.playerId)
          ?.killedPlayerIds.length ?? 0,
    });
    if (isProgressive(game.continents)) {
      for (const id of held) payouts[id]++;
      bonuses = progressiveBonuses(game.continents, payouts);
    }
    return {
      afterFrame: marker.afterFrame,
      playerId: marker.playerId,
      troops: Object.values(breakdown).reduce((sum, n) => sum + n, 0),
    };
  });

  const latest = new Map<number, number>();
  let nextTurn = 0;
  return Array.from({ length: frames.length + 1 }, (_, sample) => {
    while (nextTurn < turns.length && turns[nextTurn].afterFrame <= sample) {
      latest.set(turns[nextTurn].playerId, turns[nextTurn].troops);
      nextTurn++;
    }
    return new Map(latest);
  });
}
