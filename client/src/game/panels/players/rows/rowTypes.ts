import type { CSSProperties } from 'react';
import { contrastTextColor, playerColor } from '../../../../lib/palette';
import { playSound } from '../../../../lib/sounds';
import type { AllianceViewState, GameState } from '../../../../lib/types';
import type { EmojiPop } from '../../../logic/emoji';
import { EMOJI_POP_DURATION } from '../../../logic/emoji';
import type { Progress, StatDef } from '../playerStats';

export type Player = GameState['players'][number];

export interface PlayerStatus {
  key: string;
  icon: string;
  label: string;
}

export interface AllianceCellProps {
  state: AllianceViewState;
  cooldown: boolean;
  setRef: (playerId: number, element: HTMLElement | null) => void;
  onClick: (playerId: number) => void;
}

export interface RowProps {
  player: Player;
  label: string;
  isSelf: boolean;
  isTurn: boolean;
  selected: boolean;
  statuses: PlayerStatus[];
  stats: StatDef[];
  progress: Progress;
  showTeamBadge: boolean;
  emojiTargeting: boolean;
  rowClickable: boolean;
  pop: EmojiPop | undefined;
  alliance: AllianceCellProps | null;
  setRowRef: (playerId: number, element: HTMLElement | null) => void;
  onSelect: (playerId: number) => void;
  onEmojiClick: (playerId: number) => void;
}

export function playerColorStyle(player: Player): CSSProperties {
  const background = playerColor(player.color);
  return {
    '--player-color': background,
    '--player-fg': contrastTextColor(background),
  } as CSSProperties;
}

export function rowClassName(row: RowProps, base: string): string {
  return [
    'player-row position-relative overflow-hidden',
    base,
    row.isSelf ? 'is-self' : '',
    row.isTurn ? 'is-turn' : '',
    row.selected ? 'is-selected' : '',
    row.player.eliminated ? 'opacity-50' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function rowRootProps(row: RowProps) {
  const { player, pop } = row;
  return {
    ref: (element: HTMLElement | null) => row.setRowRef(player.id, element),
    role: 'button',
    'data-no-click-sound': true,
    onClick: () => {
      if (!row.emojiTargeting) row.onSelect(player.id);
      if (row.rowClickable) row.onEmojiClick(player.id);
      else if (!row.emojiTargeting) playSound('click');
    },
    style: {
      ...playerColorStyle(player),
      cursor: row.rowClickable && row.emojiTargeting ? 'crosshair' : undefined,
      animation: pop
        ? `annexEmojiHighlight${pop.id % 2 === 0 ? '' : 'Alt'} ${EMOJI_POP_DURATION}ms ease-out forwards`
        : undefined,
    } as CSSProperties,
  };
}
