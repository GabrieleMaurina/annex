import type { Sample } from './chartStats';

export interface ChartEvent {
  sample: number;
  kind: 'eliminated' | 'capital';
  playerId: number;
  killerId: number | null;
  count: number;
}

function stateOf(sample: Sample, playerId: number) {
  return sample.playerStates.find((s) => s.playerId === playerId);
}

function capitalsOf(sample: Sample, playerId: number) {
  return (
    sample.playerStats.find((s) => s.playerId === playerId)
      ?.capitalsConquered ?? 0
  );
}

export function chartEvents(samples: Sample[], playerIds: number[]) {
  return samples.flatMap((sample, s): ChartEvent[] => {
    if (s === 0) return [];
    const before = samples[s - 1];
    return playerIds.flatMap((playerId): ChartEvent[] => {
      const state = stateOf(sample, playerId);
      const events: ChartEvent[] = [];
      if (state?.eliminated && !stateOf(before, playerId)?.eliminated) {
        const killer = sample.playerStates.find((other) =>
          other.killedPlayerIds.includes(playerId),
        );
        events.push({
          sample: s,
          kind: 'eliminated',
          playerId,
          killerId: killer?.playerId ?? null,
          count: 1,
        });
      }
      const captured =
        capitalsOf(sample, playerId) - capitalsOf(before, playerId);
      if (captured > 0)
        events.push({
          sample: s,
          kind: 'capital',
          playerId,
          killerId: null,
          count: captured,
        });
      return events;
    });
  });
}
