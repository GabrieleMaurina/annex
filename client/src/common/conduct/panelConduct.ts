import { DAY_MS } from 'engine';
import { connector } from '../../connector';
import { getOwnAccount, isLoggedIn } from '../../lib/player';
import type { GameState } from '../../lib/types';

export interface PanelConduct {
  live: boolean;
  masked: boolean;
  allowFriend: boolean;
  allowBlock: boolean;
  httpBlock: boolean;
  gameId?: string;
  viewerId: number | null;
  allowReport: boolean;
}

export function panelConduct(
  players: GameState['players'],
  selfId: number | null,
  storedGameId: string | undefined,
  endedAt: number | null,
  gameEnded: boolean,
  anonymous: boolean,
): PanelConduct | null {
  if (!isLoggedIn() || connector.isOffline()) return null;
  if (storedGameId === undefined)
    return {
      live: true,
      masked: anonymous && !gameEnded,
      allowFriend: gameEnded,
      allowBlock: !anonymous || gameEnded,
      httpBlock: gameEnded,
      viewerId: selfId,
      allowReport: players.some((p) => p.id === selfId),
    };
  const accountId = getOwnAccount()?.id;
  const viewer = players.find((p) => !!p.userId && p.userId === accountId);
  return {
    live: false,
    masked: false,
    allowFriend: true,
    allowBlock: true,
    httpBlock: true,
    gameId: storedGameId,
    viewerId: viewer?.id ?? null,
    allowReport: !!viewer && endedAt !== null && Date.now() - endedAt < DAY_MS,
  };
}
