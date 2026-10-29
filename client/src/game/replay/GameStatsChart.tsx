import { useMemo, useState } from 'react';
import { Button } from 'react-bootstrap';
import { contrastTextColor, playerColor } from '../../lib/palette';
import type {
  GameState,
  ReplayPlayerState,
  ReplayPlayerStats,
  ReplayTerritory,
} from '../../lib/types';
import type { FoldedReplay } from './replay';

const WIDTH = 1000;
const HEIGHT = 280;
const MARGIN = { top: 10, right: 12, bottom: 22, left: 44 };
const Y_TICKS = 4;
const MAX_ROUND_LABELS = 10;

interface Sample {
  territories: ReplayTerritory[];
  playerStates: ReplayPlayerState[];
  playerStats: ReplayPlayerStats[];
}

type CounterKey = Exclude<keyof ReplayPlayerStats, 'playerId'>;

interface Stat {
  label: string;
  value: (sample: Sample, playerId: number) => number;
}

function counter(key: CounterKey) {
  return (sample: Sample, playerId: number) =>
    sample.playerStats.find((s) => s.playerId === playerId)?.[key] ?? 0;
}

function playerState(sample: Sample, playerId: number) {
  return sample.playerStates.find((s) => s.playerId === playerId);
}

const TROOPS: Stat = {
  label: 'Troops',
  value: (sample, playerId) =>
    sample.territories
      .filter((t) => t.ownerId === playerId)
      .reduce((sum, t) => sum + t.troops, 0),
};

const TERRITORIES: Stat = {
  label: 'Territories',
  value: (sample, playerId) =>
    sample.territories.filter((t) => t.ownerId === playerId).length,
};

const POINTS: Stat = {
  label: 'Points',
  value: (sample, playerId) => playerState(sample, playerId)?.points ?? 0,
};

const PLAYERS_KILLED: Stat = {
  label: 'Players Killed',
  value: (sample, playerId) =>
    playerState(sample, playerId)?.killedPlayerIds.length ?? 0,
};

const TROOPS_GAINED: Stat = {
  label: 'Troops Gained',
  value: counter('troopsGained'),
};
const TROOPS_KILLED: Stat = {
  label: 'Troops Killed',
  value: counter('troopsKilled'),
};
const TROOPS_LOST: Stat = {
  label: 'Troops Lost',
  value: counter('troopsLost'),
};
const TERRITORIES_CONQUERED: Stat = {
  label: 'Territories Conquered',
  value: counter('territoriesConquered'),
};
const TERRITORIES_LOST: Stat = {
  label: 'Territories Lost',
  value: counter('territoriesLost'),
};
const CAPITALS_CONQUERED: Stat = {
  label: 'Capitals Conquered',
  value: counter('capitalsConquered'),
};
const CAPITALS_LOST: Stat = {
  label: 'Capitals Lost',
  value: counter('capitalsLost'),
};
const CARDS_GAINED: Stat = {
  label: 'Cards Gained',
  value: counter('cardsGained'),
};
const SETS_PLAYED: Stat = {
  label: 'Sets Played',
  value: counter('setsPlayed'),
};

interface Props {
  players: GameState['players'];
  replay: FoldedReplay;
  isCapitals: boolean;
  isPointsMode: boolean;
}

function GameStatsChart({ players, replay, isCapitals, isPointsMode }: Props) {
  const stats = [
    TROOPS,
    TERRITORIES,
    ...(isPointsMode ? [POINTS] : []),
    PLAYERS_KILLED,
    ...(replay.hasStats
      ? [
          TROOPS_GAINED,
          TROOPS_KILLED,
          TROOPS_LOST,
          TERRITORIES_CONQUERED,
          TERRITORIES_LOST,
          ...(isCapitals ? [CAPITALS_CONQUERED, CAPITALS_LOST] : []),
          CARDS_GAINED,
          SETS_PLAYED,
        ]
      : []),
  ];
  const [selected, setSelected] = useState(TROOPS);

  const { frames, initial } = replay.data;
  const samples = useMemo<Sample[]>(
    () => [
      { territories: initial, playerStates: [], playerStats: [] },
      ...frames,
    ],
    [frames, initial],
  );
  const series = useMemo(
    () =>
      players.map((p) => ({
        player: p,
        values: samples.map((sample) => selected.value(sample, p.id)),
      })),
    [players, samples, selected],
  );
  const roundStarts = useMemo(
    () =>
      frames.flatMap((frame, i) =>
        i === 0 || frames[i - 1].roundNumber !== frame.roundNumber
          ? [{ index: i, round: frame.roundNumber }]
          : [],
      ),
    [frames],
  );

  const maxValue = Math.max(1, ...series.flatMap((s) => s.values));
  const yStep = Math.ceil(maxValue / Y_TICKS);
  const yMax = yStep * Y_TICKS;
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const x = (index: number) =>
    MARGIN.left + (index / Math.max(1, samples.length - 1)) * plotWidth;
  const y = (value: number) => MARGIN.top + (1 - value / yMax) * plotHeight;
  const labelEvery = Math.ceil(roundStarts.length / MAX_ROUND_LABELS);

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-center gap-1 mb-2">
        {stats.map((stat) => (
          <Button
            key={stat.label}
            size="sm"
            variant={
              stat.label === selected.label ? 'primary' : 'outline-primary'
            }
            onClick={() => setSelected(stat)}
          >
            {stat.label}
          </Button>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-100"
        role="img"
        aria-label={`${selected.label} over time`}
      >
        {Array.from({ length: Y_TICKS + 1 }, (_, i) => i * yStep).map(
          (value) => (
            <g key={`y${value}`} className="text-body-secondary">
              <line
                x1={MARGIN.left}
                x2={WIDTH - MARGIN.right}
                y1={y(value)}
                y2={y(value)}
                stroke="currentColor"
                strokeOpacity={0.25}
              />
              <text
                x={MARGIN.left - 4}
                y={y(value)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={11}
                fill="currentColor"
              >
                {value}
              </text>
            </g>
          ),
        )}
        {roundStarts
          .filter((_, i) => i % labelEvery === 0)
          .map(({ index, round }) => (
            <text
              key={`r${round}`}
              x={x(index)}
              y={HEIGHT - 6}
              textAnchor="middle"
              fontSize={11}
              fill="currentColor"
              className="text-body-secondary"
            >
              Round {round}
            </text>
          ))}
        {series.map(({ player, values }) => (
          <path
            key={player.id}
            d={values
              .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`)
              .join(' ')}
            fill="none"
            stroke={playerColor(player.color)}
            strokeWidth={2}
            strokeLinejoin="round"
          >
            <title>{player.name}</title>
          </path>
        ))}
      </svg>
      <div className="d-flex flex-wrap justify-content-center gap-1 mt-1">
        {players.map((p) => (
          <span
            key={p.id}
            className="badge"
            style={{
              backgroundColor: playerColor(p.color),
              color: contrastTextColor(playerColor(p.color)),
            }}
          >
            {p.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export default GameStatsChart;
