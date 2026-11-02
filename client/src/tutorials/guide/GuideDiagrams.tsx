import {
  DUNGEON_TONES,
  DUNGEON_VOID_COLOR,
  DUNGEON_WALL_COLOR,
  EARTH_TONES,
  SEA_COLOR,
  TEMPLE_SEAM_COLOR,
  TEMPLE_TONES,
  TEMPLE_VOID_COLOR,
  TEMPLE_WALL_COLOR,
  TILE_TONES,
  TILE_VOID_COLOR,
  TILE_WALL_COLOR,
} from 'engine';
import type { ReactNode } from 'react';
import { contrastTextColor, playerColor } from '../../lib/palette';
import { SECTION_CLASS } from '../../ui/containers/panelStyle';
import { LAND } from '../tutorialMap';
import { hexagonPoints, loopPath } from './shapes';

const MINI_SCALE = 10;
const MINI_CENTERS = LAND.centers.map(([x, y]) => [
  x / MINI_SCALE,
  y / MINI_SCALE,
]);
const MINI_LINKS = LAND.neighbors.flatMap((neighbors, a) =>
  neighbors.filter((b) => b > a).map((b) => [a, b]),
);
const MINI_RADIUS = 10;
const BLUE = 1;
const RED = 0;
const GREEN = 2;
const GOLD = '#e3a33b';

const MODES: {
  title: string;
  text: string;
  owners: number[];
  capitals?: number[];
  target?: number;
  hills?: number[];
  badge?: string;
}[] = [
  {
    title: 'Supremacy',
    text: 'Own the whole map, alone or as a team.',
    owners: [GREEN, GREEN, GREEN, GREEN, GREEN, GREEN, GREEN],
  },
  {
    title: 'Capitals',
    text: 'Hold every capital on the map.',
    owners: [GREEN, RED, GREEN, GREEN, BLUE, RED, GREEN],
    capitals: [0, 2, 6],
  },
  {
    title: 'Round limits',
    text: 'Hold the most territories when time runs out.',
    owners: [GREEN, GREEN, RED, GREEN, GREEN, BLUE, RED],
    badge: 'Round 5/5',
  },
  {
    title: 'Secret goals',
    text: 'Eliminate a hidden target or finish a mission.',
    owners: [GREEN, RED, BLUE, GREEN, GREEN, RED, BLUE],
    target: 5,
  },
  {
    title: 'Scoring',
    text: 'Score points every turn for hills or territories.',
    owners: [GREEN, GREEN, BLUE, RED, GREEN, RED, BLUE],
    hills: [1, 4],
  },
];

const DEFAULT_SETTINGS = [
  ['Blitz', 'Balanced'],
  ['Attack dice', '3'],
  ['Defence dice', '2'],
  ['Dice ties', 'Defence'],
  ['Cards', 'Constant'],
  ['Continents', '1x'],
  ['Placement', 'Random'],
  ['Fortification', 'Connected'],
  ['Fog of war', 'Off'],
  ['Turn duration', '2 minutes'],
];

const ISLANDS = [
  {
    x: 34,
    y: 34,
    radii: [24, 27, 22, 19, 23, 26, 25, 21],
    tone: 0,
    borders: 'M33,36 L37,2 M33,36 L4,50 M33,36 L62,52',
  },
  {
    x: 88,
    y: 40,
    radii: [20, 17, 22, 24, 19, 21, 18, 23],
    tone: 1,
    borders: 'M64,32 L90,42 L114,34',
  },
];
const EARTH_LANDS = [
  {
    tone: 2,
    d: 'M45,22 L48,25 L51,24 L54,21 L57,20 L60,22 L62,26 L63,23 L66,25 L68,22 L72,21 L77,17 L76,10 L70,8 L66,6 L63,9 L61,13 L58,13 L55,15 L52,15 L49,17 L50,20 Z',
  },
  { tone: 2, d: 'M48,12 L51,11 L52,15 L49,16 Z' },
  {
    tone: 5,
    d: 'M50,28 L56,26 L61,27 L66,28 L71,29 L74,36 L80,39 L77,45 L74,52 L72,57 L67,63 L62,62 L60,55 L58,49 L56,45 L51,43 L46,39 L47,33 Z',
  },
  { tone: 5, d: 'M76,54 L78,52 L77,58 L75,59 Z' },
];
const DUNGEON_ROOMS = [
  [8, 8, 32, 22],
  [52, 6, 26, 20],
  [88, 12, 24, 28],
  [12, 42, 34, 22],
  [60, 38, 30, 26],
];
const DUNGEON_HALLS = [
  [40, 16, 12, 5],
  [78, 14, 10, 5],
  [26, 30, 5, 12],
  [46, 50, 14, 5],
  [96, 40, 5, 12],
];
const TEMPLE_CENTER = [60, 36];
const TEMPLE_RINGS = [0, 7, 16, 25, 34];
const TEMPLE_SECTORS = [1, 5, 10, 10];
const TEMPLE_VOID_CELLS = ['3-2', '3-7'];
const TEMPLE_WALL_ARCS = [
  [16, 0, 72],
  [7, 144, 288],
  [25, 108, 216],
  [25, 288, 342],
];
const TEMPLE_WALL_SPOKES = [
  [36, 16, 34],
  [180, 7, 25],
  [252, 25, 34],
];

function MiniMap({ mode }: { mode: (typeof MODES)[number] }) {
  return (
    <svg viewBox="28 14 124 72" width={124} height={72} aria-hidden="true">
      {MINI_LINKS.map(([a, b]) => (
        <line
          key={`${a}-${b}`}
          x1={MINI_CENTERS[a][0]}
          y1={MINI_CENTERS[a][1]}
          x2={MINI_CENTERS[b][0]}
          y2={MINI_CENTERS[b][1]}
          stroke="currentColor"
          strokeOpacity={0.35}
          strokeWidth={2}
        />
      ))}
      {MINI_CENTERS.map(([x, y], id) => {
        const fill = playerColor(mode.owners[id]);
        return mode.capitals?.includes(id) ? (
          <rect
            key={id}
            x={x - MINI_RADIUS}
            y={y - MINI_RADIUS}
            width={MINI_RADIUS * 2}
            height={MINI_RADIUS * 2}
            fill={fill}
            stroke="#000000"
            strokeWidth={1.5}
          />
        ) : (
          <circle
            key={id}
            cx={x}
            cy={y}
            r={MINI_RADIUS}
            fill={fill}
            stroke="#000000"
            strokeWidth={1.5}
          />
        );
      })}
      {mode.hills?.map((id) => {
        const [x, y] = MINI_CENTERS[id];
        return (
          <polygon
            key={id}
            points={`${x - 6},${y + 4} ${x},${y - 6} ${x + 6},${y + 4}`}
            fill={GOLD}
            stroke="#000000"
            strokeWidth={1}
          />
        );
      })}
      {mode.target !== undefined && (
        <g
          stroke={GOLD}
          strokeWidth={2}
          fill="none"
          transform={`translate(${MINI_CENTERS[mode.target][0]} ${MINI_CENTERS[mode.target][1]})`}
        >
          <circle r={MINI_RADIUS + 4} />
          <line x1={-MINI_RADIUS - 8} x2={MINI_RADIUS + 8} y1={0} y2={0} />
          <line y1={-MINI_RADIUS - 8} y2={MINI_RADIUS + 8} x1={0} x2={0} />
        </g>
      )}
      {mode.badge && (
        <g>
          <rect x={64} y={16} width={52} height={12} rx={3} fill={GOLD} />
          <text
            x={90}
            y={22}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={8}
            fontWeight="bold"
            fill={contrastTextColor(GOLD)}
          >
            {mode.badge}
          </text>
        </g>
      )}
    </svg>
  );
}

export function ModeExamples() {
  return (
    <div className="row g-2 mb-3">
      {MODES.map((mode) => (
        <div key={mode.title} className="col-6 col-md-4">
          <div
            className={`${SECTION_CLASS} p-2 h-100 d-flex flex-column align-items-center text-center`}
          >
            <MiniMap mode={mode} />
            <span className="small fw-semibold">{mode.title}</span>
            <span className="small text-body-secondary">{mode.text}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DefaultSettings() {
  return (
    <div className={`${SECTION_CLASS} p-2 mb-3`}>
      <div className="small fw-semibold text-body-secondary mb-2">
        A new game starts with
      </div>
      <div className="row g-2">
        {DEFAULT_SETTINGS.map(([name, value]) => (
          <div key={name} className="col-6 col-md-4">
            <div className="border rounded px-2 py-1 d-flex justify-content-between gap-2 small">
              <span>{name}</span>
              <span className="fw-bold">{value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MapThumbnail({
  label,
  background,
  children,
}: {
  label: string;
  background: string;
  children: ReactNode;
}) {
  return (
    <div className="d-flex flex-column align-items-center gap-1">
      <svg
        viewBox="0 0 120 72"
        width={120}
        height={72}
        className="rounded border"
        aria-hidden="true"
      >
        <rect width={120} height={72} fill={background} />
        {children}
      </svg>
      <span className="small fw-semibold">{label}</span>
    </div>
  );
}

function polar(radius: number, degrees: number): string {
  const angle = ((degrees - 90) * Math.PI) / 180;
  return `${TEMPLE_CENTER[0] + radius * Math.cos(angle)},${TEMPLE_CENTER[1] + radius * Math.sin(angle)}`;
}

function arc(radius: number, from: number, to: number, sweep: 0 | 1): string {
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  return `A${radius},${radius} 0 ${large} ${sweep} ${polar(radius, to)}`;
}

function TempleMaze() {
  const cells = TEMPLE_SECTORS.flatMap((count, ring) =>
    Array.from({ length: count }, (_, sector) => {
      const inner = TEMPLE_RINGS[ring];
      const outer = TEMPLE_RINGS[ring + 1];
      const from = (360 / count) * sector;
      const to = (360 / count) * (sector + 1);
      const d =
        ring === 0
          ? `M${polar(outer, 0)} ${arc(outer, 0, 180, 1)} ${arc(outer, 180, 360, 1)} Z`
          : `M${polar(outer, from)} ${arc(outer, from, to, 1)} L${polar(inner, to)} ${arc(inner, to, from, 0)} Z`;
      const key = `${ring}-${sector}`;
      return (
        <path
          key={key}
          d={d}
          fill={
            TEMPLE_VOID_CELLS.includes(key)
              ? TEMPLE_VOID_COLOR
              : TEMPLE_TONES[Math.floor((from + to) / 2 / 90)]
          }
          stroke={TEMPLE_SEAM_COLOR}
          strokeWidth={0.6}
        />
      );
    }),
  );
  return (
    <>
      {cells}
      <g fill="none" stroke={TEMPLE_WALL_COLOR} strokeWidth={2.5}>
        {TEMPLE_WALL_ARCS.map(([radius, from, to]) => (
          <path
            key={`${radius}-${from}`}
            d={`M${polar(radius, from)} ${arc(radius, from, to, 1)}`}
          />
        ))}
        {TEMPLE_WALL_SPOKES.map(([degrees, inner, outer]) => (
          <path
            key={`${degrees}-${inner}`}
            d={`M${polar(inner, degrees)} L${polar(outer, degrees)}`}
          />
        ))}
      </g>
    </>
  );
}

function HexGrid() {
  const hexes = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 8; col++) {
      const x = 10 + col * 15.6 + (row % 2) * 7.8;
      const y = 8 + row * 13.5;
      hexes.push(
        <polygon
          key={`${row}-${col}`}
          points={hexagonPoints(x, y, 8.4)}
          fill={TILE_TONES[(row * 3 + col) % 4]}
          stroke={TILE_WALL_COLOR}
          strokeWidth={1.5}
        />,
      );
    }
  }
  return <>{hexes}</>;
}

export function MapTypes() {
  return (
    <div
      className={`${SECTION_CLASS} p-3 mb-3 d-flex flex-wrap justify-content-around gap-3`}
    >
      <MapThumbnail label="Terrain" background={SEA_COLOR}>
        <line
          x1={50}
          y1={37}
          x2={78}
          y2={40}
          stroke="#000000"
          strokeWidth={1.5}
          strokeDasharray="3 2"
        />
        {ISLANDS.map((island, i) => {
          const outline = loopPath(island.x, island.y, island.radii);
          return (
            <g key={island.x}>
              <clipPath id={`guide-island-${i}`}>
                <path d={outline} />
              </clipPath>
              <path d={outline} fill={EARTH_TONES[island.tone]} />
              <path
                d={island.borders}
                clipPath={`url(#guide-island-${i})`}
                fill="none"
                stroke="#000000"
                strokeWidth={1.5}
              />
              <path d={outline} fill="none" stroke="#000000" strokeWidth={2} />
            </g>
          );
        })}
      </MapThumbnail>
      <MapThumbnail label="Dungeon" background={DUNGEON_VOID_COLOR}>
        {[...DUNGEON_HALLS, ...DUNGEON_ROOMS].map(([x, y, w, h], i) => (
          <rect
            key={i}
            x={x}
            y={y}
            width={w}
            height={h}
            fill={DUNGEON_TONES[i % DUNGEON_TONES.length]}
            stroke={DUNGEON_WALL_COLOR}
            strokeWidth={2}
          />
        ))}
      </MapThumbnail>
      <MapThumbnail label="Temple" background={TEMPLE_VOID_COLOR}>
        <TempleMaze />
      </MapThumbnail>
      <MapThumbnail label="Tile" background={TILE_VOID_COLOR}>
        <HexGrid />
      </MapThumbnail>
      <MapThumbnail label="Earth" background={TILE_VOID_COLOR}>
        <clipPath id="guide-globe">
          <circle cx={60} cy={36} r={30} />
        </clipPath>
        <circle cx={60} cy={36} r={30} fill={SEA_COLOR} />
        <g clipPath="url(#guide-globe)">
          {EARTH_LANDS.map((land) => (
            <path
              key={land.d}
              d={land.d}
              fill={EARTH_TONES[land.tone]}
              stroke="#000000"
              strokeWidth={0.8}
              strokeLinejoin="round"
            />
          ))}
        </g>
        <ellipse
          cx={60}
          cy={36}
          rx={14}
          ry={30}
          fill="none"
          stroke="#ffffff"
          strokeOpacity={0.4}
        />
        <line
          x1={30}
          y1={36}
          x2={90}
          y2={36}
          stroke="#ffffff"
          strokeOpacity={0.4}
        />
        <circle cx={60} cy={36} r={30} fill="none" stroke="#000000" />
      </MapThumbnail>
    </div>
  );
}
