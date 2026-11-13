import { isPlayerMuted } from '../../../../common/mutedPlayers';
import type { Player, PlayerStatus } from './rowTypes';

interface StatusInput {
  player: Player;
  isSelf: boolean;
  recolored: boolean;
  drawVoted: boolean;
  abortVoted: boolean;
}

export function playerStatuses({
  player,
  isSelf,
  recolored,
  drawVoted,
  abortVoted,
}: StatusInput): PlayerStatus[] {
  const statuses: PlayerStatus[] = [];
  if (!isSelf && isPlayerMuted(player.id))
    statuses.push({ key: 'muted', icon: '/icons/muted.svg', label: 'Muted' });
  if (recolored)
    statuses.push({
      key: 'recolored',
      icon: '/icons/palette.svg',
      label: 'Color changed on this device only',
    });
  if (player.eliminated)
    statuses.push({
      key: 'eliminated',
      icon: '/icons/death.svg',
      label: 'Eliminated',
    });
  if (player.surrendered)
    statuses.push({
      key: 'surrendered',
      icon: '/icons/flag.svg',
      label: 'Surrendered',
    });
  if (drawVoted)
    statuses.push({
      key: 'draw',
      icon: '/icons/draw.svg',
      label: 'Offered a draw',
    });
  if (abortVoted)
    statuses.push({
      key: 'abort',
      icon: '/icons/close.svg',
      label: 'Wants to abort the game',
    });
  if (!player.connected && !player.eliminated)
    statuses.push({
      key: 'disconnected',
      icon: '/icons/no-wifi.svg',
      label: 'Disconnected',
    });
  return statuses;
}
