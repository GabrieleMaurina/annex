import type { AllianceViewState } from '../../lib/types';

export const ALLIANCE_ICONS: Record<AllianceViewState, string> = {
  allied: '🤝',
  requestReceived: '❓',
  requestSent: '⏳',
  none: '⚔',
};

export const ALLIANCE_CELL_LABELS: Record<AllianceViewState, string> = {
  allied: 'Allied',
  requestReceived: 'Alliance request received',
  requestSent: 'Alliance request sent',
  none: 'Not allied',
};
