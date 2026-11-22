import { useMemo, useState } from 'react';
import { Button } from 'react-bootstrap';
import { lineAt, nearestIndex } from '../../common/charts/chartSearch';
import type {
  ChartPoint,
  ChartTip,
} from '../../common/charts/ChartTooltipArea';
import {
  ChartHit,
  ChartTooltipArea,
} from '../../common/charts/ChartTooltipArea';
import WhiteIcon from '../../common/icons/WhiteIcon';
import {
  ZOMBIE_TEXTURE_URL,
  playerColor,
  playerSwatch,
} from '../../lib/palette';
import type { GameState } from '../../lib/types';
import type { ChartEvent } from './chartEvents';
import { chartEvents } from './chartEvents';
import type { ChartMap } from './chartMetrics';
import { continentsHeldBySample, generationBySample } from './chartMetrics';
import type { Sample, Stat } from './chartStats';
import {
  CAPITALS,
  CAPITALS_CONQUERED,
  CAPITALS_LOST,
  CAPITAL_OWNERSHIP,
  CARDS_GAINED,
  CARDS_IN_HAND,
  CARDS_STOLEN,
  CONTINENT_BONUSES,
  GENERATION,
  LARGEST_STACK,
  PLAYERS_KILLED,
  POINTS,
  SETS_PLAYED,
  TAKEOVER_DASH,
  TAKEOVER_LABELS,
  TERRITORIES,
  TERRITORIES_CONQUERED,
  TERRITORIES_LOST,
  TERRITORY_OWNERSHIP,
  TROOPS,
  TROOPS_GAINED,
  TROOPS_KILLED,
  TROOPS_LOST,
  playerState,
  takeoverOf,
} from './chartStats';
import type { FoldedReplay } from './replay';

const WIDTH = 1000;
const HEIGHT = 280;
const MARGIN = { top: 10, right: 12, bottom: 22, left: 44 };
const Y_TICKS = 4;
const MAX_ROUND_LABELS = 10;
const DASH = 6;
const EVENT_SIZE = 8;
const EVENT_OUTLINE = 1.5;
const EVENT_ICONS = {
  eliminated: { path: '/icons/death.svg', label: 'Eliminated', size: 16 },
  capital: { path: '/icons/capital.svg', label: 'Capital captured', size: 20 },
};
const EVENT_Y = HEIGHT - MARGIN.bottom - EVENT_SIZE * 2;
const BAR_PADDING = 0.1;

type Player = GameState['players'][number];
type Mode = 'time' | 'rounds';

function axisFor(lowest: number, highest: number) {
  const step = Math.max(1, Math.ceil((highest - lowest) / Y_TICKS));
  const low = Math.floor(lowest / step) * step;
  const count = Math.max(Y_TICKS, Math.ceil((highest - low) / step));
  return {
    low,
    high: low + count * step,
    ticks: Array.from({ length: count + 1 }, (_, i) => low + i * step),
  };
}

function signed(value: number) {
  return `${value > 0 ? '+' : ''}${value.toLocaleString()}`;
}

function rankOf(stat: Stat, all: number[], value: number) {
  return (
    1 +
    all.filter((other) => (stat.lowerIsBetter ? other < value : other > value))
      .length
  );
}

function badges(players: Player[]) {
  return players.map((p) => (
    <span
      key={p.id}
      className="badge me-1"
      style={playerSwatch(p.color, p.isZombie)}
    >
      {p.name}
    </span>
  ));
}

function eventLabel(event: ChartEvent) {
  if (event.kind === 'eliminated') return 'Eliminated';
  return event.count > 1
    ? `Captured ${event.count} capitals`
    : 'Captured a capital';
}

interface GlyphProps {
  event: ChartEvent;
  color: string;
  cx: number;
  maskId: string;
}

function EventGlyph({ event, color, cx, maskId }: GlyphProps) {
  const { size } = EVENT_ICONS[event.kind];
  const left = cx - size / 2;
  const top = EVENT_Y - size / 2;
  return (
    <>
      <mask
        id={maskId}
        maskUnits="userSpaceOnUse"
        x={left}
        y={top}
        width={size}
        height={size}
        style={{ maskType: 'alpha' }}
      >
        <image
          href={EVENT_ICONS[event.kind].path}
          x={left}
          y={top}
          width={size}
          height={size}
        />
      </mask>
      <g filter="url(#event-outline)">
        <rect
          x={left}
          y={top}
          width={size}
          height={size}
          fill={color}
          mask={`url(#${maskId})`}
        />
      </g>
    </>
  );
}

interface Props {
  game: GameState;
  map: ChartMap | null;
  players: GameState['players'];
  replay: FoldedReplay;
  isCapitals: boolean;
  capitalIds: Set<number>;
  isPointsMode: boolean;
}

function GameStatsChart({
  game,
  map,
  players,
  replay,
  isCapitals,
  capitalIds,
  isPointsMode,
}: Props) {
  const hasContinents =
    map !== null &&
    game.continents !== 'off' &&
    map.territories.some((t) => t.continentId >= 0);
  const hasGeneration = map !== null && replay.turnMarkers.length > 0;
  const stats = [
    TERRITORY_OWNERSHIP,
    ...(isCapitals ? [CAPITAL_OWNERSHIP] : []),
    TROOPS,
    TERRITORIES,
    ...(isCapitals ? [CAPITALS] : []),
    LARGEST_STACK,
    ...(game.cards !== 'off' ? [CARDS_IN_HAND] : []),
    ...(hasContinents ? [CONTINENT_BONUSES] : []),
    ...(hasGeneration ? [GENERATION] : []),
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
          CARDS_STOLEN,
          SETS_PLAYED,
        ]
      : []),
  ];
  const [mode, setMode] = useState<Mode>('time');
  const [choice, setChoice] = useState(TERRITORY_OWNERSHIP);
  const isBars = mode === 'rounds';
  const visibleStats = isBars ? stats.filter((stat) => !stat.stacked) : stats;
  const selected = visibleStats.includes(choice) ? choice : visibleStats[0];
  const isStacked = !isBars && !!selected.stacked;

  const { frames, initial } = replay.data;
  const continentsHeld = useMemo(
    () =>
      map && selected === CONTINENT_BONUSES
        ? continentsHeldBySample(map, replay.data)
        : null,
    [map, replay.data, selected],
  );
  const generation = useMemo(
    () =>
      map && selected === GENERATION
        ? generationBySample(game, map, replay, capitalIds)
        : null,
    [game, map, replay, capitalIds, selected],
  );
  const samples = useMemo<Sample[]>(() => {
    const base = [
      { territories: initial, playerStates: [], playerStats: [], hands: [] },
      ...frames,
    ];
    if (!continentsHeld && !generation) return base;
    return base.map((sample, i) => ({
      ...sample,
      continentsHeld: continentsHeld?.[i],
      generation: generation?.[i],
    }));
  }, [frames, initial, continentsHeld, generation]);
  const series = useMemo(
    () =>
      players.map((p) => ({
        player: p,
        values: samples.map((sample) =>
          selected.value(sample, p.id, capitalIds),
        ),
        takeovers: samples.slice(1).map((sample) => takeoverOf(sample, p.id)),
      })),
    [players, samples, selected, capitalIds],
  );
  const events = useMemo(
    () =>
      chartEvents(
        samples,
        players.map((p) => p.id),
      ),
    [samples, players],
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
  const positions = useMemo(
    () => [
      0,
      ...roundStarts.flatMap(({ index }, k) => {
        const count = (roundStarts[k + 1]?.index ?? frames.length) - index;
        return Array.from({ length: count }, (_, j) => k + (j + 1) / count);
      }),
    ],
    [roundStarts, frames.length],
  );
  const roundChanges = useMemo(
    () =>
      series.map(({ values }) =>
        roundStarts.map(
          ({ index }, k) =>
            values[roundStarts[k + 1]?.index ?? frames.length] - values[index],
        ),
      ),
    [series, roundStarts, frames.length],
  );
  const runs = useMemo(() => {
    const groups = Array.from({ length: samples.length - 1 }, (_, s) =>
      series.map(({ values }) =>
        series.flatMap((other, j) =>
          other.values[s] === values[s] && other.values[s + 1] === values[s + 1]
            ? [j]
            : [],
        ),
      ),
    );
    return series.flatMap(({ player, values, takeovers }, p) => {
      const starts = groups.flatMap((group, s) =>
        s === 0 ||
        group[p].join() !== groups[s - 1][p].join() ||
        takeovers[s] !== takeovers[s - 1]
          ? [s]
          : [],
      );
      return starts.map((start, k) => ({
        player,
        values,
        takeover: takeovers[start],
        start,
        end: starts[k + 1] ?? groups.length,
        rank: groups[start][p].indexOf(p),
        size: groups[start][p].length,
      }));
    });
  }, [samples.length, series]);

  const stackedBands = useMemo(() => {
    const floors = samples.map(() => 0);
    return series.map(({ player, values, takeovers }) => {
      const lower = [...floors];
      values.forEach((v, s) => {
        floors[s] += v;
      });
      const spans = takeovers.flatMap((takeover, s) => {
        if (!takeover || takeovers[s - 1] === takeover) return [];
        const next = takeovers.findIndex((t, i) => i > s && t !== takeover);
        return [
          { takeover, start: s, end: next === -1 ? takeovers.length : next },
        ];
      });
      return { player, lower, upper: [...floors], spans };
    });
  }, [samples, series]);

  const takeoverKinds = (['surrendered', 'disconnected'] as const).filter(
    (kind) => series.some((s) => s.takeovers.includes(kind)),
  );

  const axis = isBars
    ? axisFor(
        Math.min(0, ...roundChanges.flat()),
        Math.max(1, ...roundChanges.flat()),
      )
    : axisFor(
        0,
        Math.max(
          1,
          ...(isStacked
            ? (stackedBands.at(-1)?.upper ?? [])
            : series.flatMap((s) => s.values)),
        ),
      );
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const roundCount = Math.max(1, roundStarts.length);
  const xAt = (position: number) =>
    MARGIN.left + (position / roundCount) * plotWidth;
  const x = (sample: number) => xAt(positions[sample]);
  const y = (value: number) =>
    MARGIN.top + (1 - (value - axis.low) / (axis.high - axis.low)) * plotHeight;
  const valueAt = (viewY: number) =>
    axis.low + (1 - (viewY - MARGIN.top) / plotHeight) * (axis.high - axis.low);
  const positionAt = (fraction: number) =>
    ((fraction * WIDTH - MARGIN.left) / plotWidth) * roundCount;
  const labelEvery = Math.ceil(roundStarts.length / MAX_ROUND_LABELS);
  const barSpan = 1 - 2 * BAR_PADDING;
  const barX = (round: number, index: number) =>
    round + BAR_PADDING + (index / series.length) * barSpan;

  function eventTip(point: ChartPoint): ChartTip | null {
    const hits = events.flatMap((event, index) => {
      const distance = Math.hypot(
        (x(event.sample) / WIDTH - point.x) / point.reachX,
        (EVENT_Y / HEIGHT - point.y) / point.reachY,
      );
      return distance <= 1 ? [{ event, index, distance }] : [];
    });
    if (hits.length === 0) return null;
    const { event, index } = hits.reduce((best, hit) =>
      hit.distance < best.distance ? hit : best,
    );
    const player = players.find((p) => p.id === event.playerId)!;
    const killer = players.find((p) => p.id === event.killerId);
    return {
      id: `event-${index}`,
      title: badges([player]),
      rows: [
        { label: 'Event', value: eventLabel(event) },
        { label: 'Round', value: frames[event.sample - 1].roundNumber },
        ...(killer ? [{ label: 'By', value: killer.name }] : []),
      ],
      marker: {
        x: x(event.sample) / WIDTH,
        y: EVENT_Y / HEIGHT,
        color: playerColor(player.color),
      },
    };
  }

  function lineTip(point: ChartPoint): ChartTip | null {
    const position = positionAt(point.x);
    const sample = nearestIndex(positions, position);
    let seriesIndex: number;
    if (isStacked) {
      const value = valueAt(point.y * HEIGHT);
      seriesIndex = stackedBands.findIndex(
        ({ lower, upper }) =>
          lineAt(positions, lower, position) <= value &&
          value <= lineAt(positions, upper, position),
      );
      if (seriesIndex < 0) return null;
    } else {
      const distances = series.map((s) =>
        Math.abs(y(lineAt(positions, s.values, position)) / HEIGHT - point.y),
      );
      const least = Math.min(...distances);
      if (least > point.reachY) return null;
      seriesIndex = distances.indexOf(least);
    }
    const { values, takeovers, player } = series[seriesIndex];
    const value = values[sample];
    const sharing = isStacked
      ? [player]
      : series.filter((s) => s.values[sample] === value).map((s) => s.player);
    const alone = sharing.length === 1;
    const frame = frames[sample - 1];
    const total = stackedBands.at(-1)?.upper[sample] ?? 0;
    const takeover = takeovers[sample - 1];
    const status = [
      ...(alone && takeover ? [TAKEOVER_LABELS[takeover]] : []),
      ...(alone && playerState(samples[sample], player.id)?.eliminated
        ? ['Eliminated']
        : []),
    ].join(', ');
    const roundStart =
      roundStarts.filter((r) => r.index <= sample - 1).length - 1;
    const band = stackedBands[seriesIndex];
    const markerValue = isStacked
      ? (band.lower[sample] + band.upper[sample]) / 2
      : value;
    return {
      id: `${seriesIndex}-${sample}`,
      title: badges(sharing),
      rows: [
        { label: 'Round', value: frame ? frame.roundNumber : 'Start' },
        { label: selected.label, value: value.toLocaleString() },
        ...(alone && frame
          ? [
              {
                label: 'Change this round',
                value: signed(value - values[roundStarts[roundStart].index]),
              },
            ]
          : []),
        {
          label: 'Rank',
          value: `${rankOf(
            selected,
            series.map((s) => s.values[sample]),
            value,
          )} of ${series.length}`,
        },
        ...(isStacked && total > 0
          ? [
              {
                label: 'Share',
                value: `${((value / total) * 100).toFixed(1)}%`,
              },
            ]
          : []),
        ...(status ? [{ label: 'Status', value: status }] : []),
      ],
      marker: {
        x: x(sample) / WIDTH,
        y: y(markerValue) / HEIGHT,
        color: playerColor(player.color),
      },
    };
  }

  function roundTip(point: ChartPoint): ChartTip | null {
    const position = positionAt(point.x);
    const round = Math.floor(position);
    const within = (position - round - BAR_PADDING) / barSpan;
    if (round < 0 || round >= roundStarts.length) return null;
    if (within < 0 || within >= 1) return null;
    const index = Math.floor(within * series.length);
    const { player, values } = series[index];
    const change = roundChanges[index][round];
    const ends = [y(0), y(change)].map((v) => v / HEIGHT);
    if (
      point.y < Math.min(...ends) - point.reachY ||
      point.y > Math.max(...ends) + point.reachY
    )
      return null;
    const end = roundStarts[round + 1]?.index ?? frames.length;
    return {
      id: `${index}-${round}`,
      title: badges([player]),
      rows: [
        { label: 'Round', value: roundStarts[round].round },
        { label: 'Change', value: signed(change) },
        { label: selected.label, value: values[end].toLocaleString() },
        {
          label: 'Rank',
          value: `${rankOf(
            selected,
            roundChanges.map((changes) => changes[round]),
            change,
          )} of ${series.length}`,
        },
      ],
      marker: {
        x: xAt(barX(round, index + 0.5)) / WIDTH,
        y: y(change) / HEIGHT,
        color: playerColor(player.color),
      },
    };
  }

  const tipAt = (point: ChartPoint) =>
    isBars ? roundTip(point) : (eventTip(point) ?? lineTip(point));

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-center gap-1 mb-2">
        {(['time', 'rounds'] as const).map((option) => (
          <Button
            key={option}
            size="sm"
            variant={option === mode ? 'primary' : 'secondary'}
            onClick={() => setMode(option)}
          >
            {option === 'time' ? 'Over time' : 'Per round'}
          </Button>
        ))}
      </div>
      <div className="d-flex flex-wrap justify-content-center gap-1 mb-2">
        {visibleStats.map((stat) => (
          <Button
            key={stat.label}
            size="sm"
            variant={stat.label === selected.label ? 'primary' : 'secondary'}
            onClick={() => setChoice(stat)}
          >
            {stat.label}
          </Button>
        ))}
      </div>
      <ChartTooltipArea>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-100 d-block"
          role="img"
          aria-label={`${selected.label} ${isBars ? 'per round' : 'over time'}`}
        >
          {axis.ticks.map((value) => (
            <g key={`y${value}`} className="text-body-secondary">
              <line
                x1={MARGIN.left}
                x2={WIDTH - MARGIN.right}
                y1={y(value)}
                y2={y(value)}
                stroke="currentColor"
                strokeOpacity={value === 0 && isBars ? 0.8 : 0.25}
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
          ))}
          {roundStarts.map(
            ({ round }, k) =>
              k % labelEvery === 0 && (
                <text
                  key={`r${round}`}
                  x={xAt(k + 0.5)}
                  y={HEIGHT - 6}
                  textAnchor="middle"
                  fontSize={11}
                  fill="currentColor"
                  className="text-body-secondary"
                >
                  Round {round}
                </text>
              ),
          )}
          <defs>
            <pattern
              id="takeover-surrendered"
              width={8}
              height={8}
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect
                width={4}
                height={8}
                fill="var(--bs-body-bg)"
                opacity={0.6}
              />
            </pattern>
            <pattern
              id="takeover-disconnected"
              width={6}
              height={6}
              patternUnits="userSpaceOnUse"
            >
              <circle
                cx={3}
                cy={3}
                r={1.5}
                fill="var(--bs-body-bg)"
                opacity={0.6}
              />
            </pattern>
            <filter
              id="event-outline"
              x="-30%"
              y="-30%"
              width="160%"
              height="160%"
            >
              <feMorphology
                in="SourceAlpha"
                operator="dilate"
                radius={EVENT_OUTLINE}
                result="grown"
              />
              <feFlood
                style={{ floodColor: 'var(--bs-body-bg)' }}
                result="fill"
              />
              <feComposite
                in="fill"
                in2="grown"
                operator="in"
                result="outline"
              />
              <feMerge>
                <feMergeNode in="outline" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <pattern
              id="zombie-texture"
              width={12}
              height={12}
              patternUnits="userSpaceOnUse"
            >
              <image href={ZOMBIE_TEXTURE_URL} width={12} height={12} />
            </pattern>
          </defs>
          {isStacked &&
            stackedBands.map(({ player, lower, upper, spans }) => {
              const area = (start: number, end: number) =>
                `${upper
                  .slice(start, end + 1)
                  .map(
                    (v, k) => `${k === 0 ? 'M' : 'L'}${x(start + k)},${y(v)}`,
                  )
                  .join(' ')} ${lower
                  .slice(start, end + 1)
                  .map((v, k) => `L${x(start + k)},${y(v)}`)
                  .reverse()
                  .join(' ')} Z`;
              const full = area(0, upper.length - 1);
              return (
                <g key={player.id}>
                  <path
                    d={full}
                    fill={playerColor(player.color)}
                    stroke="var(--bs-body-bg)"
                    strokeWidth={1}
                  />
                  {player.isZombie && (
                    <path d={full} fill="url(#zombie-texture)" />
                  )}
                  {spans.map(({ takeover, start, end }) => (
                    <path
                      key={start}
                      d={area(start, end)}
                      fill={`url(#takeover-${takeover})`}
                    />
                  ))}
                </g>
              );
            })}
          {!isBars &&
            !isStacked &&
            runs.map(({ player, values, takeover, start, end, rank, size }) => (
              <path
                key={`${player.id}-${start}`}
                d={values
                  .slice(start, end + 1)
                  .map(
                    (v, k) => `${k === 0 ? 'M' : 'L'}${x(start + k)},${y(v)}`,
                  )
                  .join(' ')}
                fill="none"
                stroke={playerColor(player.color)}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap={
                  takeover === 'disconnected' ? 'round' : undefined
                }
                strokeDasharray={
                  size > 1
                    ? `${DASH} ${(size - 1) * DASH}`
                    : takeover
                      ? TAKEOVER_DASH[takeover]
                      : undefined
                }
                strokeDashoffset={-rank * DASH}
              />
            ))}
          {isBars &&
            roundChanges.map((changes, index) =>
              changes.map((change, round) => (
                <rect
                  key={`${index}-${round}`}
                  x={xAt(barX(round, index))}
                  width={(plotWidth / roundCount) * (barSpan / series.length)}
                  y={Math.min(y(0), y(change))}
                  height={Math.abs(y(change) - y(0))}
                  fill={playerColor(series[index].player.color)}
                />
              )),
            )}
          {!isBars &&
            events.map((event, index) => (
              <line
                key={`line-${index}`}
                x1={x(event.sample)}
                x2={x(event.sample)}
                y1={MARGIN.top}
                y2={HEIGHT - MARGIN.bottom}
                stroke={playerColor(
                  players.find((p) => p.id === event.playerId)!.color,
                )}
                strokeOpacity={0.5}
                strokeDasharray="4 4"
              />
            ))}
          {!isBars &&
            events.map((event, index) => (
              <EventGlyph
                key={`glyph-${index}`}
                event={event}
                color={playerColor(
                  players.find((p) => p.id === event.playerId)!.color,
                )}
                cx={x(event.sample)}
                maskId={`event-mask-${index}`}
              />
            ))}
          <ChartHit
            x={MARGIN.left}
            y={MARGIN.top}
            width={plotWidth}
            height={plotHeight}
            tipAt={tipAt}
          />
        </svg>
      </ChartTooltipArea>
      <div className="d-flex flex-wrap justify-content-center gap-1 mt-1">
        {players.map((p) => (
          <span
            key={p.id}
            className="badge"
            style={playerSwatch(p.color, p.isZombie)}
          >
            {p.name}
          </span>
        ))}
      </div>
      {!isBars && events.length > 0 && (
        <div className="d-flex flex-wrap justify-content-center gap-3 text-body-secondary small mt-1">
          {(['eliminated', 'capital'] as const)
            .filter((kind) => events.some((e) => e.kind === kind))
            .map((kind) => (
              <span
                key={kind}
                className="d-inline-flex align-items-center gap-1"
              >
                <WhiteIcon path={EVENT_ICONS[kind].path} size={12} />
                {EVENT_ICONS[kind].label}
              </span>
            ))}
        </div>
      )}
      {takeoverKinds.length > 0 && (
        <div className="text-center text-body-secondary small mt-1">
          {takeoverKinds
            .map((kind) =>
              kind === 'surrendered'
                ? 'Dashed or striped: bot after surrender'
                : 'Dotted: disconnected',
            )
            .join(' · ')}
        </div>
      )}
    </div>
  );
}

export default GameStatsChart;
