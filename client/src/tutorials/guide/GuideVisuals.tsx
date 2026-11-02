import { SEA_COLOR, SEA_SIZE_MULTIPLIER } from '../../game/GameMap/helpers';
import { contrastTextColor, playerColor } from '../../lib/palette';
import { RANKS } from '../../lib/ranks';
import { SECTION_CLASS } from '../../ui/containers/panelStyle';
import { hexagonPoints, loopPath } from './shapes';

const VERTEX_RADIUS = 20;
const HEX_RADIUS = VERTEX_RADIUS * SEA_SIZE_MULTIPLIER;
const SHIP_RADIUS = VERTEX_RADIUS * 1.3;
const FLEET_DISTANCE = HEX_RADIUS + SHIP_RADIUS + 4;
const FLEETS = [
  { color: 0, ships: 3 },
  { color: 1, ships: 2 },
  { color: 2, ships: 1 },
];
const TERRITORY_OUTLINES = [
  [40, 44, 38, 31, 36, 43, 45, 40, 33, 37, 42, 36, 39, 44],
  [36, 42, 45, 40, 34, 38, 44, 41, 35, 31, 37, 42, 44, 38],
  [43, 37, 33, 39, 44, 40, 34, 38, 45, 41, 36, 32, 38, 42],
];
const YOU = playerColor(2);
const ENEMY = playerColor(0);
const RIVAL = playerColor(1);
const CARD_SETS = [
  { symbols: ['soldier', 'soldier', 'soldier'], troops: 4 },
  { symbols: ['humvee', 'humvee', 'humvee'], troops: 6 },
  { symbols: ['tank', 'tank', 'tank'], troops: 8 },
  { symbols: ['soldier', 'humvee', 'tank'], troops: 10 },
];

function points(list: number[][]): string {
  return list.map(([x, y]) => `${x},${y}`).join(' ');
}

function Troops({
  x,
  y,
  color,
  count,
}: {
  x: number;
  y: number;
  color: string;
  count: number;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      fontWeight="bold"
      fontSize={VERTEX_RADIUS}
      fill={contrastTextColor(color)}
    >
      {count}
    </text>
  );
}

function Marker({
  x,
  y,
  color,
  count,
}: {
  x: number;
  y: number;
  color: string;
  count: number;
}) {
  return (
    <>
      <circle
        cx={x}
        cy={y}
        r={VERTEX_RADIUS}
        fill={color}
        stroke="#000000"
        strokeWidth={2}
      />
      <Troops x={x} y={y} color={color} count={count} />
    </>
  );
}

function LegendItem({
  color,
  troops,
  capital,
  label,
  outline,
}: {
  color: string;
  troops: number;
  capital?: boolean;
  label: string;
  outline: number[];
}) {
  return (
    <div className="d-flex flex-column align-items-center gap-1">
      <svg viewBox="0 0 100 96" width={90} height={86} aria-hidden="true">
        <path
          d={loopPath(50, 48, outline)}
          fill={color}
          stroke="#000000"
          strokeWidth={3}
        />
        {capital && (
          <rect
            x={50 - VERTEX_RADIUS}
            y={48 - VERTEX_RADIUS}
            width={VERTEX_RADIUS * 2}
            height={VERTEX_RADIUS * 2}
            fill={color}
            stroke="#000000"
            strokeWidth={2}
          />
        )}
        <Troops x={50} y={48} color={color} count={troops} />
      </svg>
      <span className="small fw-semibold">{label}</span>
    </div>
  );
}

export function TerritoryLegend() {
  return (
    <div
      className={`${SECTION_CLASS} p-3 mb-3 d-flex flex-wrap justify-content-around gap-3`}
    >
      <LegendItem
        color={YOU}
        troops={5}
        label="Your territory"
        outline={TERRITORY_OUTLINES[0]}
      />
      <LegendItem
        color={ENEMY}
        troops={3}
        label="Enemy territory"
        outline={TERRITORY_OUTLINES[1]}
      />
      <LegendItem
        color={RIVAL}
        troops={7}
        capital
        label="Capital"
        outline={TERRITORY_OUTLINES[2]}
      />
    </div>
  );
}

export function TurnBarExample() {
  return (
    <div className="d-flex justify-content-center mb-3">
      <div
        className="py-2 px-3 border rounded d-flex align-items-center gap-2"
        style={{ backgroundColor: YOU, color: contrastTextColor(YOU) }}
      >
        <span>You</span>
        <span className="fw-bold" style={{ fontSize: '1.4em' }}>
          Deploy
        </span>
        <span>3</span>
        <span className="btn btn-primary btn-sm pe-none">Next Phase</span>
      </div>
    </div>
  );
}

function AttackPair({
  label,
  left,
  right,
  arrow,
}: {
  label: string;
  left: { color: string; count: number };
  right: { color: string; count: number };
  arrow: boolean;
}) {
  return (
    <div className="d-flex flex-column align-items-center gap-1">
      <svg viewBox="0 0 160 50" width={160} height={50} aria-hidden="true">
        {arrow && (
          <>
            <defs>
              <marker
                id="guide-arrow"
                viewBox="0 0 10 10"
                refX={8}
                refY={5}
                markerWidth={5}
                markerHeight={5}
                orient="auto"
              >
                <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
              </marker>
            </defs>
            <line
              x1={48}
              y1={25}
              x2={108}
              y2={25}
              stroke="currentColor"
              strokeWidth={3}
              markerEnd="url(#guide-arrow)"
            />
          </>
        )}
        <Marker x={25} y={25} color={left.color} count={left.count} />
        <Marker x={135} y={25} color={right.color} count={right.count} />
      </svg>
      <span className="small fw-semibold">{label}</span>
    </div>
  );
}

export function AttackExample() {
  return (
    <div
      className={`${SECTION_CLASS} p-3 mb-3 d-flex flex-wrap justify-content-around gap-3`}
    >
      <AttackPair
        label="4 troops attack 1"
        left={{ color: YOU, count: 4 }}
        right={{ color: ENEMY, count: 1 }}
        arrow
      />
      <AttackPair
        label="Conquered, 3 troops moved in"
        left={{ color: YOU, count: 1 }}
        right={{ color: YOU, count: 3 }}
        arrow={false}
      />
    </div>
  );
}

export function CardSets() {
  return (
    <div className="row g-2 mb-3">
      {CARD_SETS.map((set) => (
        <div key={set.symbols.join()} className="col-6 col-md-3">
          <div className={`${SECTION_CLASS} p-2 h-100 text-center`}>
            <div className="d-flex justify-content-center gap-1 mb-1">
              {set.symbols.map((symbol, i) => (
                <span key={i} className="bg-white border rounded p-1 lh-1">
                  <img
                    src={`/images/${symbol}.svg`}
                    width={22}
                    height={22}
                    alt={symbol}
                  />
                </span>
              ))}
            </div>
            <div className="fw-bold">+{set.troops} troops</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function RankLadder() {
  return (
    <div className="row g-2 mb-3">
      {RANKS.map((rank) => (
        <div key={rank.name} className="col-4 col-md-3 col-lg-2">
          <div
            className={`${SECTION_CLASS} p-2 h-100 d-flex flex-column align-items-center text-center`}
          >
            <img
              src={`/ranks/${rank.image}.svg`}
              width={32}
              height={32}
              alt=""
            />
            <span className="small fw-semibold">{rank.name}</span>
            <span className="small text-body-secondary">{rank.minElo}+</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SeaDiagram() {
  const ship = [
    [SHIP_RADIUS, 0],
    [-SHIP_RADIUS * 0.6, SHIP_RADIUS * 0.7],
    [-SHIP_RADIUS * 0.6, -SHIP_RADIUS * 0.7],
  ];
  const extent = FLEET_DISTANCE + SHIP_RADIUS + 4;
  return (
    <svg
      viewBox={`${-extent} ${-extent} ${extent * 2} ${extent * 2}`}
      width={extent * 2}
      height={extent * 2}
      role="img"
      aria-label="A sea with three fleets around it"
    >
      <polygon
        points={hexagonPoints(0, 0, HEX_RADIUS)}
        fill={SEA_COLOR}
        stroke="#000000"
        strokeWidth={2}
      />
      {FLEETS.map((fleet, i) => {
        const angle = (Math.PI * 2 * i) / FLEETS.length - Math.PI / 2;
        const x = FLEET_DISTANCE * Math.cos(angle);
        const y = FLEET_DISTANCE * Math.sin(angle);
        const fill = playerColor(fleet.color);
        return (
          <g key={fleet.color}>
            <polygon
              points={points(ship)}
              transform={`translate(${x} ${y}) rotate(${(angle * 180) / Math.PI + 90})`}
              fill={fill}
              stroke="#000000"
              strokeWidth={2}
            />
            <text
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fontWeight="bold"
              fontSize={VERTEX_RADIUS * 0.7}
              fill={contrastTextColor(fill)}
            >
              {fleet.ships}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
