import { useState } from 'react';
import type { GameMapProps } from '../../props';

export function useTurnToasts({
  turnPhase,
  roundNumber,
  turnPlayerIndex,
  troopsToDeploy,
  isCapitals,
  players,
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
> & {
  isMyTurn: boolean;
  hasSetToPlay: boolean;
  addToasts: (messages: string[]) => void;
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
    addToasts([
      `${currentTurnPlayer.name} received ${troopsToDeploy} troops at the start of their turn`,
      ...(isMyTurn && hasSetToPlay
        ? ['You have a card set available to play!']
        : []),
    ]);
  }

  if (isCapitals && !capitalModeAnnounced && roundNumber >= 2) {
    setCapitalModeAnnounced(true);
    addToasts(['Capitals mode activated']);
  }
}
