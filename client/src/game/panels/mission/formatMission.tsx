import type { ReactNode } from 'react';
import { contrastTextColor, playerColor } from '../../../lib/palette';
import type { GameState, Mission } from '../../../lib/types';

function formatList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return items.join(' and ');
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

export function formatMission(
  mission: Mission,
  players: GameState['players'],
  continentNames: Map<number, string>,
): ReactNode {
  if (mission.type === 'territories') {
    const percent = Math.round(mission.fraction * 100);
    return mission.minTroopsPerTerritory >= 2
      ? `Occupy ${percent}%+ of the territories, with ${mission.minTroopsPerTerritory}+ troops each.`
      : `Occupy ${percent}%+ of the territories.`;
  }
  if (mission.type === 'continents') {
    const names = formatList(
      mission.continentIds.map((id) => continentNames.get(id) ?? `#${id + 1}`),
    );
    return `Conquer continents ${names}.`;
  }
  const target = players.find((p) => p.id === mission.targetId);
  return (
    <>
      Eliminate{' '}
      <span
        className={target ? 'badge' : undefined}
        style={
          target
            ? {
                backgroundColor: playerColor(target.color),
                color: contrastTextColor(playerColor(target.color)),
              }
            : undefined
        }
      >
        {target?.name ?? 'your target'}
      </span>
      . If someone beats you to it, control 75%+ of the territories instead.
    </>
  );
}
