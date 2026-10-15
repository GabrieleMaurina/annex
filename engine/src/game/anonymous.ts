import { Game } from '../types';

const PLAYER_COLOR_NAMES = [
  'Red',
  'Blue',
  'Green',
  'Yellow',
  'Purple',
  'Orange',
  'Black',
  'White',
  'Pink',
  'Cyan',
  'Brown',
  'Lime',
  'Indigo',
  'Amber',
  'Magenta',
  'Forest',
  'Steel',
  'Crimson',
  'Olive',
  'Violet',
];

export function usesAliases(game: Game): boolean {
  return game.anonymous === 'on' && !game.offline;
}

export function isAnonymous(game: Game): boolean {
  return usesAliases(game) && game.state !== 'ended';
}

export function isAnonymousPlaying(game: Game): boolean {
  return isAnonymous(game) && game.state === 'playing';
}

export function anonymousName(game: Game, playerId: number): string {
  const color = game.playerColors.get(playerId);
  return game.playerIds.includes(playerId) && color !== undefined
    ? PLAYER_COLOR_NAMES[color]
    : 'Anonymous';
}
