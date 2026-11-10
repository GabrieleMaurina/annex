import { ReplayEntry } from '../export';
import { GameDataSource } from './gameData';

type ChartRow = Record<string, number | null>;
type ActionEntry = Extract<ReplayEntry, { kind: 'action' }>;

interface Tally {
  territories: number;
  troops: number;
  capitals: number;
}

const RESERVED_COLUMNS = new Set(['frame', 'round']);

const COUNTERS = [
  'troopsGained',
  'troopsKilled',
  'troopsLost',
  'territoriesConquered',
  'territoriesLost',
  'capitalsConquered',
  'capitalsLost',
  'cardsGained',
  'cardsStolen',
  'setsPlayed',
] as const;

function playerColumns(players: GameDataSource['players']) {
  return new Map(
    players.map((p) => {
      const clash =
        RESERVED_COLUMNS.has(p.name) ||
        players.filter((other) => other.name === p.name).length > 1;
      return [p.playerId, clash ? `${p.name} (${p.playerId})` : p.name];
    }),
  );
}

function chartKeys(
  isCapitals: boolean,
  pointsMode: boolean,
  hasStats: boolean,
) {
  return [
    'troops',
    'territories',
    ...(isCapitals ? ['capitals'] : []),
    ...(pointsMode ? ['points'] : []),
    'playersKilled',
    ...(hasStats
      ? COUNTERS.filter((key) => isCapitals || !key.startsWith('capitals'))
      : []),
  ];
}

export function buildCharts(
  game: GameDataSource,
  isCapitals: boolean,
  pointsMode: boolean,
): Record<string, ChartRow[]> {
  const columns = playerColumns(game.players);
  const capitalIds = new Set(game.capitalTerritoryIds);
  const tallies = new Map<number, Tally>(
    game.players.map((p) => [
      p.playerId,
      { territories: 0, troops: 0, capitals: 0 },
    ]),
  );
  const territories = new Map<number, { ownerId: number; troops: number }>();
  const counters = new Map<number, ActionEntry['statsDelta'][number]>();
  let states = new Map<number, ActionEntry['playerStates'][number]>();

  function place(id: number, ownerId: number, troops: number) {
    const previous = territories.get(id);
    if (previous) {
      const tally = tallies.get(previous.ownerId);
      if (tally) {
        tally.territories -= 1;
        tally.troops -= previous.troops;
        if (capitalIds.has(id)) tally.capitals -= 1;
      }
      territories.delete(id);
    }
    const tally = tallies.get(ownerId);
    if (!tally) return;
    territories.set(id, { ownerId, troops });
    tally.territories += 1;
    tally.troops += troops;
    if (capitalIds.has(id)) tally.capitals += 1;
  }

  const actions = game.replay.frames.filter((entry) => entry.kind === 'action');
  const hasStats = actions.some((entry) => entry.statsDelta?.length);
  const keys = chartKeys(isCapitals, pointsMode, hasStats);
  const charts: Record<string, ChartRow[]> = Object.fromEntries(
    keys.map((key) => [key, []]),
  );

  function sample(frame: number, round: number | null) {
    const values = game.players.map((p) => {
      const tally = tallies.get(p.playerId);
      const counter = counters.get(p.playerId);
      return {
        troops: tally?.troops ?? 0,
        territories: tally?.territories ?? 0,
        capitals: tally?.capitals ?? 0,
        points: states.get(p.playerId)?.points ?? 0,
        playersKilled: states.get(p.playerId)?.killedPlayerIds.length ?? 0,
        ...Object.fromEntries(
          COUNTERS.map((key) => [key, counter?.[key] ?? 0]),
        ),
      } as Record<string, number>;
    });
    for (const key of keys) {
      const row: ChartRow = { frame, round };
      game.players.forEach((p, i) => {
        row[columns.get(p.playerId) ?? ''] = values[i][key];
      });
      charts[key].push(row);
    }
  }

  for (const t of game.replay.initialTerritories)
    place(t.id, t.ownerId, t.troops);
  sample(0, null);

  actions.forEach((entry, i) => {
    for (const delta of entry.mapDelta)
      place(delta.id, delta.ownerId, delta.troops);
    for (const stats of entry.statsDelta ?? [])
      counters.set(stats.playerId, stats);
    states = new Map((entry.playerStates ?? []).map((s) => [s.playerId, s]));
    sample(i + 1, entry.roundNumber);
  });

  return charts;
}
