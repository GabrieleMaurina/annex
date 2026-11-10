import {
  DEFAULT_SIDES,
  MAX_DICE,
  MAX_SIDES,
  MIN_SIDES,
} from '../../src/game/combat/dice';
import {
  defaultMaxPoints,
  MAX_HILLS,
  MAX_POINTS_VALUES,
} from '../../src/game/progression/points';
import {
  isBlitzOffAllowed,
  TROOPS_PER_TERRITORY_VALUES,
} from '../../src/lifecycle/settings';
import {
  Fill,
  FILL_VALUES,
  GenerateMapParams,
  GENERATION_TYPE_VALUES,
  GenerationType,
  MAP_SIZE_VALUES,
  MapSize,
  TILE_SHAPE_VALUES,
  TileShape,
} from '../../src/mapgen/core/params';
import {
  Blitz,
  BotDifficulty,
  BotPersonality,
  CardsMode,
  Fortification,
  GameMode,
  Placement,
} from '../../src/types';

export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DIFFICULTIES: BotDifficulty[] = ['easy', 'medium', 'hard'];
export const PERSONALITIES: BotPersonality[] = [
  'balanced',
  'taker',
  'breaker',
  'killer',
  'vengeful',
  'defensive',
  'erratic',
  'police',
  'hoarder',
  'opportunist',
];

const FORTIFICATIONS: Fortification[] = [
  'connected',
  'neighboring',
  'unrestricted',
];
const CARDS_MODES: CardsMode[] = [
  'constant',
  'linear',
  'exponential',
  'linear per player',
  'exponential per player',
  'off',
];
const GAME_MODES: GameMode[] = [
  'supremacy',
  'supremacy 3/4',
  'supremacy 2/3',
  'capitals',
  'team deathmatch',
  'continent',
  '5-round',
  '10-round',
  'assassin',
  'mission',
  'player kills',
  'troop kills',
  'king of the hill',
  'empire',
];
const BLITZ_VALUES: Blitz[] = ['balanced', 'true', 'fair', 'off'];
const PLACEMENT_VALUES: Placement[] = ['random', 'semi', 'custom', 'single'];

export type Contestant = 'current' | 'baseline';

export interface BotIdentity {
  difficulty: BotDifficulty;
  personality: BotPersonality;
  contestant?: Contestant;
}

function pick<T>(rng: () => number, xs: readonly T[]): T {
  return xs[Math.floor(rng() * xs.length)];
}

function weightedDefault<T>(
  rng: () => number,
  values: readonly T[],
  defaultValue: T,
): T {
  if (rng() < 0.9) return defaultValue;
  return pick(
    rng,
    values.filter((value) => value !== defaultValue),
  );
}

function weightedOff<T extends string>(
  rng: () => number,
  onProbability: number,
  onValues: readonly T[],
): 'off' | T {
  if (rng() >= onProbability) return 'off';
  return pick(rng, onValues);
}

export function randomRoster(rng: () => number, size: number): BotIdentity[] {
  return Array.from({ length: size }, () => ({
    difficulty: pick(rng, DIFFICULTIES),
    personality: pick(rng, PERSONALITIES),
  }));
}

export function versusDifficulty(): BotDifficulty {
  const value = process.env.VERSUS_DIFFICULTY as BotDifficulty | undefined;
  return value && DIFFICULTIES.includes(value) ? value : 'hard';
}

export function versusRoster(rng: () => number, size: number): BotIdentity[] {
  const roster = randomRoster(rng, size - 2);
  for (const contestant of ['current', 'baseline'] as const)
    roster.splice(Math.floor(rng() * (roster.length + 1)), 0, {
      difficulty: versusDifficulty(),
      personality: 'balanced',
      contestant,
    });
  return roster;
}

export function randomMapParams(
  rng: () => number,
  seed: string,
): GenerateMapParams {
  const params = {
    seed,
    size: pick<MapSize>(rng, MAP_SIZE_VALUES),
    type: pick<GenerationType>(rng, GENERATION_TYPE_VALUES),
    fill: pick<Fill>(rng, FILL_VALUES),
    tile: pick<TileShape>(rng, TILE_SHAPE_VALUES),
    seas: rng() < 0.5,
    timed: rng() < 0.2,
    aspect: 'wide' as const,
    mountains: true,
    rivers: true,
  };
  const unlockable = params.type === 'tile' && rng() < 0.1;
  const directional = rng() < 0.2;
  const switched = (params.timed || directional) && rng() < 0.5;
  return unlockable
    ? {
        ...params,
        seas: false,
        timed: false,
        directional: false,
        switched: false,
        unlockable,
      }
    : { ...params, directional, switched, unlockable };
}

export interface RandomSettings {
  settings: Record<string, unknown>;
  teams: number[] | null;
}

function randomSides(rng: () => number): number {
  return MIN_SIDES + Math.floor(rng() * (MAX_SIDES - MIN_SIDES + 1));
}

export function randomGameSettings(
  rng: () => number,
  botCount: number,
): RandomSettings {
  const gameMode = pick(rng, GAME_MODES);
  const defaultDice = rng() < 0.95;
  const attackDice = defaultDice ? 3 : 1 + Math.floor(rng() * MAX_DICE);
  const defenceDice = defaultDice ? 2 : 1 + Math.floor(rng() * attackDice);
  const defaultSides = rng() < 0.95;
  const attackSides = defaultSides ? DEFAULT_SIDES : randomSides(rng);
  const defenceSides = defaultSides ? DEFAULT_SIDES : randomSides(rng);
  const alliancesAllowed = gameMode !== 'team deathmatch';
  const cards = weightedDefault(rng, CARDS_MODES, 'constant');
  const roundTroops = rng() < 0.3 ? 'on' : 'off';
  const initialTroops = rng() < 0.9 ? 3 : 1 + Math.floor(rng() * 100);
  const defaultIncome = rng() < 0.9;
  const troopsPerTerritory = defaultIncome
    ? 1 / 3
    : pick(rng, TROOPS_PER_TERRITORY_VALUES);
  const minTroops = defaultIncome ? 3 : Math.floor(rng() * 101);
  const blitzOffAllowed = isBlitzOffAllowed({
    roundTroops,
    cards,
    troopsPerTerritory,
    initialTroops,
    minTroops,
  });

  const settings: Record<string, unknown> = {
    gameMode,
    defenceDice,
    attackDice,
    attackSides,
    defenceSides,
    diceTies: defaultDice
      ? 'defence'
      : pick(rng, ['defence', 'attack', 'tie'] as const),
    fortification: weightedDefault(rng, FORTIFICATIONS, 'connected'),
    cards,
    blitz: weightedDefault(
      rng,
      blitzOffAllowed ? BLITZ_VALUES : BLITZ_VALUES.filter((b) => b !== 'off'),
      'balanced',
    ),
    placement: weightedDefault(rng, PLACEMENT_VALUES, 'random'),
    fogOfWar: rng() < 0.3 ? 'on' : 'off',
    entrenchments: defenceDice < MAX_DICE && rng() < 0.3 ? 'on' : 'off',
    supplyLines: rng() < 0.3 ? 'on' : 'off',
    roundTroops,
    bounties: rng() < 0.3 ? 'on' : 'off',
    nukes: rng() < 0.2 ? 'on' : 'off',
    portals: weightedOff(rng, 0.25, ['static', 'dynamic'] as const),
    radiations: weightedOff(rng, 0.25, [
      'static',
      'dynamic',
      'expanding',
    ] as const),
    starvation: weightedOff(rng, 0.25, [
      'territory',
      'total',
      'percent',
    ] as const),
    toxins: weightedOff(rng, 0.25, ['temporary', 'permanent'] as const),
    alliances: alliancesAllowed && rng() < 0.25 ? 'on' : 'off',
    continents: rng() < 0.25 ? 'off' : '1x',
  };

  let teams: number[] | null = null;
  if (gameMode === 'team deathmatch') {
    const teamCount = pick(rng, [2, 2, 3] as const);
    teams = Array.from({ length: botCount }, (_, i) => i % teamCount);
  }
  settings.initialTroops = initialTroops;
  settings.minTroops = minTroops;
  settings.troopsPerTerritory = troopsPerTerritory;
  const pointsDefault = defaultMaxPoints(gameMode);
  if (pointsDefault !== undefined) {
    settings.maxPoints =
      rng() < 0.9 ? pointsDefault : pick(rng, MAX_POINTS_VALUES);
  }
  if (gameMode === 'king of the hill')
    settings.hills = rng() < 0.9 ? 3 : 1 + Math.floor(rng() * MAX_HILLS);
  if (gameMode === 'capitals') {
    settings.capitalRefund = rng() < 0.1 ? 'on' : 'off';
    settings.startingCapitals = rng() < 0.7 ? 1 : 2 + Math.floor(rng() * 2);
  }

  return { settings, teams };
}
