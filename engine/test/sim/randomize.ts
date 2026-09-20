import {
  Fill,
  FILL_VALUES,
  GenerateMapParams,
  GENERATION_TYPE_VALUES,
  GenerationType,
  MAP_SIZE_VALUES,
  MapSize,
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
];

const FORTIFICATIONS: Fortification[] = [
  'Connected',
  'Neighboring',
  'Unrestricted',
];
const CARDS_MODES: CardsMode[] = [
  'Constant',
  'Linear',
  'Exponential',
  'Linear Per Player',
  'Exponential Per Player',
  'Off',
];
const GAME_MODES: GameMode[] = [
  'Supremacy',
  'Supremacy 3/4',
  'Supremacy 2/3',
  'Capitals',
  'Team Deathmatch',
  'Continent',
  '5-Round',
  '10-Round',
  'Assassin',
  'Mission',
  'Player Kills',
  'Troop Kills',
];
const BLITZ_VALUES: Blitz[] = ['Balanced', 'True', 'Fair', 'Off'];
const PLACEMENT_VALUES: Placement[] = ['Random', 'Random', 'Semi', 'Custom'];

export interface BotIdentity {
  difficulty: BotDifficulty;
  personality: BotPersonality;
}

function pick<T>(rng: () => number, xs: readonly T[]): T {
  return xs[Math.floor(rng() * xs.length)];
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

export function randomMapParams(
  rng: () => number,
  seed: string,
): GenerateMapParams {
  return {
    seed,
    size: pick<MapSize>(rng, MAP_SIZE_VALUES),
    type: pick<GenerationType>(rng, GENERATION_TYPE_VALUES),
    fill: pick<Fill>(rng, FILL_VALUES),
    seas: rng() < 0.5,
  };
}

export interface RandomSettings {
  settings: Record<string, unknown>;
  teams: number[] | null;
}

export function randomGameSettings(
  rng: () => number,
  botCount: number,
): RandomSettings {
  const gameMode = pick(rng, GAME_MODES);
  const defenceDice = rng() < 0.5 ? 2 : 3;
  const alliancesAllowed = gameMode !== 'Team Deathmatch';

  const settings: Record<string, unknown> = {
    gameMode,
    defenceDice,
    fortification: pick(rng, FORTIFICATIONS),
    cards: pick(rng, CARDS_MODES),
    blitz: pick(rng, BLITZ_VALUES),
    placement: pick(rng, PLACEMENT_VALUES),
    fogOfWar: rng() < 0.3 ? 'on' : 'off',
    entrenchments: defenceDice === 2 && rng() < 0.3 ? 'on' : 'off',
    supplyLines: rng() < 0.3 ? 'on' : 'off',
    roundTroops: rng() < 0.3 ? 'on' : 'off',
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
  };

  let teams: number[] | null = null;
  if (gameMode === 'Team Deathmatch') {
    const teamCount = pick(rng, [2, 2, 3] as const);
    teams = Array.from({ length: botCount }, (_, i) => i % teamCount);
  }

  return { settings, teams };
}
