import type { EloHistoryPoint } from '../../lib/types';

const WIDTH = 1000;
const HEIGHT = 64;
const MARGIN = { top: 6, right: 12, bottom: 12, left: 34 };
const TICKS = 2;

interface Point {
  time: number;
  elo: number;
  delta: number | null;
}

interface Props {
  history: EloHistoryPoint[];
}

function EloChart({ history }: Props) {
  if (history.length === 0) return null;

  const points: Point[] = [
    { time: history[0].startedAt, elo: history[0].elo, delta: null },
    ...history.map((h) => ({
      time: h.endedAt,
      elo: h.elo + h.eloDelta,
      delta: h.eloDelta,
    })),
  ];

  const minTime = points[0].time;
  const timeSpan = Math.max(1, points[points.length - 1].time - minTime);
  const elos = points.map((p) => p.elo);
  const padding = Math.max(10, (Math.max(...elos) - Math.min(...elos)) * 0.1);
  const minElo = Math.max(0, Math.floor(Math.min(...elos) - padding));
  const maxElo = Math.ceil(Math.max(...elos) + padding);

  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const x = (time: number) =>
    MARGIN.left + ((time - minTime) / timeSpan) * plotWidth;
  const y = (elo: number) =>
    MARGIN.top + (1 - (elo - minElo) / (maxElo - minElo)) * plotHeight;

  const ticks = Array.from({ length: TICKS + 1 }, (_, i) => i / TICKS);
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.time)},${y(p.elo)}`)
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-100"
      role="img"
      aria-label="Elo over time"
    >
      {ticks.map((t) => {
        const elo = minElo + t * (maxElo - minElo);
        return (
          <g key={`y${t}`} className="text-body-secondary">
            <line
              x1={MARGIN.left}
              x2={WIDTH - MARGIN.right}
              y1={y(elo)}
              y2={y(elo)}
              stroke="currentColor"
              strokeOpacity={0.25}
            />
            <text
              x={MARGIN.left - 4}
              y={y(elo)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={9}
              fill="currentColor"
            >
              {Math.round(elo)}
            </text>
          </g>
        );
      })}
      {ticks.map((t) => (
        <text
          key={`x${t}`}
          x={MARGIN.left + t * plotWidth}
          y={HEIGHT - 2}
          textAnchor={t === 0 ? 'start' : t === 1 ? 'end' : 'middle'}
          fontSize={9}
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
        strokeWidth={1.5}
        className="text-primary"
      />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={x(p.time)}
          cy={y(p.elo)}
          r={2}
          fill="currentColor"
          className="text-primary"
        >
          <title>
            {new Date(p.time).toLocaleString()}: {p.elo}
            {p.delta === null ? '' : ` (${p.delta > 0 ? '+' : ''}${p.delta})`}
          </title>
        </circle>
      ))}
    </svg>
  );
}

export default EloChart;
