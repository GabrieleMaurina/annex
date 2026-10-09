import { useState } from 'react';
import type { BotSpeed } from '../../../../lib/types';
import type { GameMapProps } from '../../props';

export const BOT_TOAST_DELAY_MS: Record<BotSpeed, number | undefined> = {
  slow: undefined,
  medium: 2500,
  fast: 1000,
};

export function useTurnToasts({
  turnPhase,
  roundNumber,
  turnPlayerIndex,
  troopsToDeploy,
  isCapitals,
  players,
  botSpeed,
  isMyTurn,
  hasSetToPlay,
  addToasts,
}: Pick<
  GameMapProps,
  | 'turnPhase'
  | 'roundNumber'
  | 'turnPlayerIndex'
  | 'troopsToDeploy'
  | 'isCapitals'
  | 'players'
  | 'botSpeed'
> & {
  isMyTurn: boolean;
  hasSetToPlay: boolean;
  addToasts: (messages: string[], delay?: number) => void;
}) {
  const [processedDeployPhaseKey, setProcessedDeployPhaseKey] = useState<
    string | null
  >(null);
  const [capitalModeAnnounced, setCapitalModeAnnounced] = useState(false);
  const currentTurnPlayer = players[turnPlayerIndex];

  const deployPhaseKey =
    turnPhase === 'deploy' && currentTurnPlayer
      ? `${roundNumber}-${turnPlayerIndex}`
      : null;
  if (
    deployPhaseKey !== null &&
    processedDeployPhaseKey !== deployPhaseKey &&
    currentTurnPlayer
  ) {
    setProcessedDeployPhaseKey(deployPhaseKey);
    addToasts(
      [
        `${currentTurnPlayer.name} received ${troopsToDeploy} troops at the start of their turn`,
        ...(isMyTurn && hasSetToPlay
          ? ['You have a card set available to play!']
          : []),
      ],
      currentTurnPlayer.isBot ? BOT_TOAST_DELAY_MS[botSpeed] : undefined,
    );
  }

  if (isCapitals && !capitalModeAnnounced && roundNumber >= 2) {
    setCapitalModeAnnounced(true);
    addToasts(['Capitals mode activated']);
  }
}
