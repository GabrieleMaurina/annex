import type { AllianceViewState } from '../../lib/types';

export const ALLIANCE_ICONS: Record<AllianceViewState, string> = {
  allied: '/icons/handshake.svg',
  requestReceived: '/icons/help.svg',
  requestSent: '/icons/stopwatch.svg',
  none: '/icons/swords.svg',
};

export const ALLIANCE_CELL_LABELS: Record<AllianceViewState, string> = {
  allied: 'Allied. Click to keep or terminate',
  requestReceived: 'Alliance request received. Click to answer',
  requestSent: 'Alliance request sent. Click to cancel it',
  none: 'Not allied. Click to propose an alliance',
};
