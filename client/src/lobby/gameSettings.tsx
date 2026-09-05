import type { ReactNode } from 'react';
import {
  BOT_DIFFICULTIES,
  BOT_DIFFICULTY_LABELS,
  BOT_PERSONALITIES,
  BOT_PERSONALITY_LABELS,
} from './botOptions';
import {
  ALLIANCES_HELP,
  BLITZ_HELP,
  BOUNTIES_HELP,
  CARDS_HELP,
  DEFENCE_DICE_HELP,
  DISCONNECT_BOT_DIFFICULTY_HELP,
  DISCONNECT_BOT_PERSONALITY_HELP,
  ENTRENCHMENTS_HELP,
  FOG_OF_WAR_HELP,
  FORTIFICATION_HELP,
  PLACEMENT_HELP,
  PORTALS_HELP,
  RADIATIONS_HELP,
  ROUND_TROOPS_HELP,
  STARVATION_HELP,
  SUPPLY_LINES_HELP,
  TOXINS_HELP,
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

function caps(...values: string[]): GameSettingOption[] {
  return values.map((value) => ({
    value,
    label: value.charAt(0).toUpperCase() + value.slice(1),
  }));
}

const TURN_DURATIONS = [60, 90, 120, 150, 180, 300];

export const GAME_SETTINGS: GameSettingDef[] = [
  {
    key: 'placement',
    label: 'Placement',
    section: 'Setup',
    options: options('Random', 'Semi', 'Custom'),
    help: PLACEMENT_HELP,
  },
  {
    key: 'fortification',
    label: 'Fortification',
    section: 'Setup',
    options: options('Connected', 'Neighboring', 'Unrestricted'),
    help: FORTIFICATION_HELP,
  },
  {
    key: 'blitz',
    label: 'Blitz',
    section: 'Combat',
    options: options('Balanced', 'True'),
    help: BLITZ_HELP,
  },
  {
    key: 'defenceDice',
    label: 'Defence Dice',
    section: 'Combat',
    numeric: true,
    options: options('2', '3'),
    help: DEFENCE_DICE_HELP,
  },
  {
    key: 'entrenchments',
    label: 'Entrenchments',
    section: 'Combat',
    options: onOff(),
    help: ENTRENCHMENTS_HELP,
  },
  {
    key: 'cards',
    label: 'Cards',
    section: 'Reinforcements',
    options: options(
      'Constant',
      'Linear',
      'Exponential',
      'Linear Per Player',
      'Exponential Per Player',
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
