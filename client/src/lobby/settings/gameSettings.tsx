import {
  defaultMaxPoints,
  isBlitzOffAllowed,
  MAX_DICE,
  MAX_HILLS,
  MAX_POINTS_VALUES,
  MIN_HILLS,
} from 'engine';
import type { ReactNode } from 'react';
import {
  GAME_MODES,
  type GameMode,
  type GameSettingsInput,
} from '../../lib/types';
import {
  BOT_DIFFICULTIES,
  BOT_DIFFICULTY_LABELS,
  BOT_PERSONALITIES,
  BOT_PERSONALITY_LABELS,
} from '../botOptions';
import {
  ALLIANCES_HELP,
  ATTACK_DICE_HELP,
  BLITZ_HELP,
  BOUNTIES_HELP,
  CARDS_HELP,
  CONTINENTS_HELP,
  DEFENCE_DICE_HELP,
  DICE_TIES_HELP,
  DISCONNECT_BOT_DIFFICULTY_HELP,
  DISCONNECT_BOT_PERSONALITY_HELP,
  ENTRENCHMENTS_HELP,
  FOG_OF_WAR_HELP,
  FORTIFICATION_HELP,
  HILLS_HELP,
  INITIAL_TROOPS_HELP,
  MAX_POINTS_HELP,
  MIN_TROOPS_HELP,
  NUKES_HELP,
  PLACEMENT_HELP,
  PORTALS_HELP,
  RADIATIONS_HELP,
  ROUND_TROOPS_HELP,
  STARVATION_HELP,
  SUPPLY_LINES_HELP,
  TOXINS_HELP,
  TROOPS_PER_TERRITORY_HELP,
  TURN_DURATION_HELP,
} from './settingsHelp';

export const GAME_SETTING_SECTIONS = [
  'Setup',
  'Combat',
  'Reinforcements',
  'Hazards',
  'Players',
  'Bots',
  'Session',
] as const;

export type GameSettingSection = (typeof GAME_SETTING_SECTIONS)[number];

export const GENERATED_MAP_VALUE = 'generated';

export interface GameSettingOption {
  value: string;
  label: string;
}

export interface GameSettingDef {
  key: string;
  label: string;
  section: GameSettingSection;
  numeric?: boolean;
  modes?: GameMode[];
  options: GameSettingOption[];
  help: ReactNode;
}

export function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return sec === 0 ? `${min} min` : `${min} min ${sec} sec`;
}

function onOff(): GameSettingOption[] {
  return [
    { value: 'off', label: 'Off' },
    { value: 'on', label: 'On' },
  ];
}

function options(...values: string[]): GameSettingOption[] {
  return values.map((value) => ({ value, label: value }));
}

export function titleCase(value: string): string {
  return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function caps(...values: string[]): GameSettingOption[] {
  return values.map((value) => ({ value, label: titleCase(value) }));
}

const TURN_DURATIONS = [60, 90, 120, 150, 180, 300];
const INITIAL_TROOPS = Array.from({ length: 100 }, (_, i) => i + 1);
const DICE = Array.from({ length: MAX_DICE }, (_, i) => i + 1);
const HILLS = Array.from(
  { length: MAX_HILLS - MIN_HILLS + 1 },
  (_, i) => MIN_HILLS + i,
);
const MIN_TROOPS = Array.from({ length: 101 }, (_, i) => i);
const TROOPS_PER_TERRITORY_FRACTIONS = [5, 4, 3, 2].map((d) => ({
  value: String(1 / d),
  label: `1/${d}`,
}));

export const GAME_SETTINGS: GameSettingDef[] = [
  {
    key: 'maxPoints',
    label: 'Max Points',
    section: 'Setup',
    numeric: true,
    modes: ['king of the hill', 'empire'],
    options: options(...MAX_POINTS_VALUES.map(String)),
    help: MAX_POINTS_HELP,
  },
  {
    key: 'hills',
    label: 'Hills',
    section: 'Setup',
    numeric: true,
    modes: ['king of the hill'],
    options: options(...HILLS.map(String)),
    help: HILLS_HELP,
  },
  {
    key: 'placement',
    label: 'Placement',
    section: 'Setup',
    options: caps('random', 'semi', 'custom'),
    help: PLACEMENT_HELP,
  },
  {
    key: 'initialTroops',
    label: 'Initial Troops',
    section: 'Setup',
    numeric: true,
    options: INITIAL_TROOPS.map((troops) => ({
      value: String(troops),
      label: String(troops),
    })),
    help: INITIAL_TROOPS_HELP,
  },
  {
    key: 'fortification',
    label: 'Fortification',
    section: 'Setup',
    options: caps('connected', 'neighboring', 'unrestricted'),
    help: FORTIFICATION_HELP,
  },
  {
    key: 'blitz',
    label: 'Blitz',
    section: 'Combat',
    options: caps('balanced', 'true', 'fair', 'off'),
    help: BLITZ_HELP,
  },
  {
    key: 'attackDice',
    label: 'Attack Dice',
    section: 'Combat',
    numeric: true,
    options: options(...DICE.map(String)),
    help: ATTACK_DICE_HELP,
  },
  {
    key: 'defenceDice',
    label: 'Defence Dice',
    section: 'Combat',
    numeric: true,
    options: options(...DICE.map(String)),
    help: DEFENCE_DICE_HELP,
  },
  {
    key: 'diceTies',
    label: 'Dice Ties',
    section: 'Combat',
    options: caps('defence', 'attack', 'tie'),
    help: DICE_TIES_HELP,
  },
  {
    key: 'entrenchments',
    label: 'Entrenchments',
    section: 'Combat',
    options: onOff(),
    help: ENTRENCHMENTS_HELP,
  },
  {
    key: 'troopsPerTerritory',
    label: 'Troops Per Territory',
    section: 'Reinforcements',
    numeric: true,
    options: [
      ...TROOPS_PER_TERRITORY_FRACTIONS,
      ...options(...INITIAL_TROOPS.map(String)),
    ],
    help: TROOPS_PER_TERRITORY_HELP,
  },
  {
    key: 'minTroops',
    label: 'Min Troops',
    section: 'Reinforcements',
    numeric: true,
    options: options(...MIN_TROOPS.map(String)),
    help: MIN_TROOPS_HELP,
  },
  {
    key: 'continents',
    label: 'Continents',
    section: 'Reinforcements',
    options: onOff(),
    help: CONTINENTS_HELP,
  },
  {
    key: 'cards',
    label: 'Cards',
    section: 'Reinforcements',
    options: caps(
      'constant',
      'linear',
      'exponential',
      'linear per player',
      'exponential per player',
      'off',
    ),
    help: CARDS_HELP,
  },
  {
    key: 'roundTroops',
    label: 'Round Troops',
    section: 'Reinforcements',
    options: onOff(),
    help: ROUND_TROOPS_HELP,
  },
  {
    key: 'bounties',
    label: 'Bounties',
    section: 'Reinforcements',
    options: onOff(),
    help: BOUNTIES_HELP,
  },
  {
    key: 'supplyLines',
    label: 'Supply Lines',
    section: 'Reinforcements',
    options: onOff(),
    help: SUPPLY_LINES_HELP,
  },
  {
    key: 'portals',
    label: 'Portals',
    section: 'Hazards',
    options: caps('off', 'static', 'dynamic'),
    help: PORTALS_HELP,
  },
  {
    key: 'radiations',
    label: 'Radiations',
    section: 'Hazards',
    options: caps('off', 'static', 'dynamic', 'expanding'),
    help: RADIATIONS_HELP,
  },
  {
    key: 'nukes',
    label: 'Nukes',
    section: 'Hazards',
    options: onOff(),
    help: NUKES_HELP,
  },
  {
    key: 'toxins',
    label: 'Toxins',
    section: 'Hazards',
    options: caps('off', 'temporary', 'permanent'),
    help: TOXINS_HELP,
  },
  {
    key: 'starvation',
    label: 'Starvation',
    section: 'Hazards',
    options: caps('off', 'territory', 'total', 'percent'),
    help: STARVATION_HELP,
  },
  {
    key: 'fogOfWar',
    label: 'Fog Of War',
    section: 'Players',
    options: onOff(),
    help: FOG_OF_WAR_HELP,
  },
  {
    key: 'alliances',
    label: 'Alliances',
    section: 'Players',
    options: onOff(),
    help: ALLIANCES_HELP,
  },
  {
    key: 'disconnectBotPersonality',
    label: 'Disconnect Personality',
    section: 'Bots',
    options: BOT_PERSONALITIES.map((value) => ({
      value,
      label: BOT_PERSONALITY_LABELS[value],
    })),
    help: DISCONNECT_BOT_PERSONALITY_HELP,
  },
  {
    key: 'disconnectBotDifficulty',
    label: 'Disconnect Difficulty',
    section: 'Bots',
    options: BOT_DIFFICULTIES.map((value) => ({
      value,
      label: BOT_DIFFICULTY_LABELS[value],
    })),
    help: DISCONNECT_BOT_DIFFICULTY_HELP,
  },
  {
    key: 'turnDuration',
    label: 'Turn Duration',
    section: 'Session',
    numeric: true,
    options: TURN_DURATIONS.map((seconds) => ({
      value: String(seconds),
      label: formatDuration(seconds),
    })),
    help: TURN_DURATION_HELP,
  },
];

function pick<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)];
}

function pickNearDefault(
  options: GameSettingOption[],
  defaultValue: unknown,
): GameSettingOption {
  const defaultIndex = options.findIndex(
    (o) => o.value === String(defaultValue),
  );
  const weights = options.map(
    (_, i) => 1 / (1 + Math.abs(i - defaultIndex)) ** 2,
  );
  let remaining =
    Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let i = 0; i < options.length; i++) {
    remaining -= weights[i];
    if (remaining < 0) return options[i];
  }
  return options[defaultIndex];
}

export function randomGameSettings(
  defaults: GameSettingsInput,
): GameSettingsInput {
  const gameMode = pick(GAME_MODES);
  const settings: Record<string, string | number> = { gameMode };
  for (const def of GAME_SETTINGS) {
    const { value } = def.numeric
      ? pickNearDefault(
          def.options,
          def.key === 'maxPoints'
            ? (defaultMaxPoints(gameMode) ?? defaults.maxPoints)
            : defaults[def.key as keyof GameSettingsInput],
        )
      : pick(def.options);
    settings[def.key] = def.numeric ? Number(value) : value;
  }
  if (
    settings.blitz === 'off' &&
    !isBlitzOffAllowed({
      roundTroops: String(settings.roundTroops),
      cards: String(settings.cards),
      troopsPerTerritory: Number(settings.troopsPerTerritory),
      initialTroops: Number(settings.initialTroops),
      minTroops: Number(settings.minTroops),
    })
  )
    settings.blitz = pick(['balanced', 'true', 'fair']);
  if (settings.gameMode === 'team deathmatch') settings.alliances = 'off';
  settings.defenceDice = Math.min(
    Number(settings.defenceDice),
    Number(settings.attackDice),
  );
  if (Number(settings.defenceDice) >= MAX_DICE) settings.entrenchments = 'off';
  return settings as GameSettingsInput;
}
