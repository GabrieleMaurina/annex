import { useMemo, useState } from 'react';
import { Button } from 'react-bootstrap';
import type { PlayerHistoryPoint } from '../../lib/types';

const WIDTH = 1000;
const HEIGHT = 240;
const MARGIN = { top: 10, right: 12, bottom: 22, left: 44 };
const Y_TICKS = 4;
const X_TICKS = 4;
const ELO_PADDING = 10;

const compact = new Intl.NumberFormat(undefined, { notation: 'compact' });

interface Stat {
  label: string;
  values: (history: PlayerHistoryPoint[]) => number[];
}

const ELO: Stat = {
  label: 'Elo',
  values: (history) => [
    history[0].elo,
    ...history.map((p) => p.elo + p.eloDelta),
  ],
};

function cumulative(
  label: string,
  gain: (point: PlayerHistoryPoint) => number,
): Stat {
  return {
    label,
    values: (history) => {
      let sum = 0;
      return [0, ...history.map((p) => (sum += gain(p)))];
    },
  };
}

const CAREER_STATS: Stat[] = [
  cumulative('Games', () => 1),
  cumulative('Wins', (p) => (p.won ? 1 : 0)),
  cumulative('Troops gained', (p) => p.troopsGained),
  cumulative('Troops killed', (p) => p.troopsKilled),
  cumulative('Troops lost', (p) => p.troopsLost),
  cumulative('Territories conquered', (p) => p.territoriesConquered),
  cumulative('Players eliminated', (p) => p.playersKilled),
  cumulative('Capitals conquered', (p) => p.capitalsConquered),
  cumulative('Sets played', (p) => p.setsPlayed),
];

interface Props {
  history: PlayerHistoryPoint[];
  includeElo: boolean;
}

function CareerChart({ history, includeElo }: Props) {
  const stats = includeElo ? [ELO, ...CAREER_STATS] : CAREER_STATS;
  const [selected, setSelected] = useState(stats[0]);

  const times = useMemo(
    () => [history[0].startedAt, ...history.map((p) => p.endedAt)],
    [history],
  );
  const values = useMemo(() => selected.values(history), [selected, history]);

  const minTime = times[0];
  const timeSpan = Math.max(1, times[times.length - 1] - minTime);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const yMin =
    selected === ELO ? Math.max(0, Math.floor(low - ELO_PADDING)) : 0;
  const yTop = selected === ELO ? high + ELO_PADDING : high;
  const yStep = Math.max(1, Math.ceil((yTop - yMin) / Y_TICKS));
  const yMax = yMin + yStep * Y_TICKS;

  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const x = (time: number) =>
    MARGIN.left + ((time - minTime) / timeSpan) * plotWidth;
  const y = (value: number) =>
    MARGIN.top + (1 - (value - yMin) / (yMax - yMin)) * plotHeight;
  const path = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(times[i])},${y(v)}`)
    .join(' ');

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-center gap-1 mb-2">
        {stats.map((stat) => (
          <Button
            key={stat.label}
            size="sm"
            variant={stat.label === selected.label ? 'primary' : 'secondary'}
            aria-pressed={stat.label === selected.label}
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
        {Array.from({ length: Y_TICKS + 1 }, (_, i) => yMin + i * yStep).map(
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
                {selected === ELO ? value : compact.format(value)}
              </text>
            </g>
          ),
        )}
        {Array.from({ length: X_TICKS + 1 }, (_, i) => i / X_TICKS).map((t) => (
          <text
            key={`x${t}`}
            x={MARGIN.left + t * plotWidth}
            y={HEIGHT - 6}
            textAnchor={t === 0 ? 'start' : t === 1 ? 'end' : 'middle'}
            fontSize={11}
            fill="currentColor"
            className="text-body-secondary"
          >
            {new Date(minTime + t * timeSpan).toLocaleDateString()}
          </text>
        ))}
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinejoin="round"
          className="text-primary"
        />
        {values.map((v, i) => (
          <circle
            key={i}
            cx={x(times[i])}
            cy={y(v)}
            r={2.5}
            fill="currentColor"
            className="text-primary"
          >
            <title>
              {new Date(times[i]).toLocaleString()}: {v.toLocaleString()}
            </title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

export default CareerChart;
