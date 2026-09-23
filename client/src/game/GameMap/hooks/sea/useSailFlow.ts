import { useCallback, useRef, useState } from 'react';
import { connector } from '../../../../connector';
import type { Ack, GameState } from '../../../../lib/types';
import {
  getSailEndCandidates,
  getSailStartCandidates,
} from '../../../logic/sail';
import type { SeaTerritory } from '../../../mapData';

function shipsAt(
  seas: GameState['seas'],
  seaTerritoryId: number | null,
  playerId: number | null,
): number {
  if (seaTerritoryId === null) return 0;
  const sea = seas.find((s) => s.id === seaTerritoryId);
  return sea?.ships.find((b) => b.playerId === playerId)?.ships ?? 0;
}

export function useSailFlow({
  sailStartTerritoryId,
  sailEndTerritoryId,
  seaTerritories,
  seas,
  selfId,
  turnPhase,
  isMyTurn,
  paused,
  setGame,
}: {
  sailStartTerritoryId: number | null;
  sailEndTerritoryId: number | null;
  seaTerritories: SeaTerritory[];
  seas: GameState['seas'];
  selfId: number | null;
  turnPhase: GameState['turnPhase'];
  isMyTurn: boolean;
  paused: boolean;
  setGame: (game: GameState) => void;
}) {
  const [sailShips, setSailShips] = useState(1);
  const [trackedSailEndTerritoryId, setTrackedSailEndTerritoryId] = useState<
    number | null
  >(null);
  const sailInputRef = useRef<HTMLInputElement>(null);

  const sailStartCandidates =
    turnPhase === 'sail' && isMyTurn
      ? getSailStartCandidates(seaTerritories, seas, selfId)
      : new Set<number>();
  const sailEndCandidates =
    turnPhase === 'sail' && isMyTurn && sailStartTerritoryId !== null
      ? getSailEndCandidates(seaTerritories, sailStartTerritoryId)
      : new Set<number>();
  const sailMaxShips = shipsAt(seas, sailStartTerritoryId, selfId);

  if (trackedSailEndTerritoryId !== sailEndTerritoryId) {
    setTrackedSailEndTerritoryId(sailEndTerritoryId);
    if (sailEndTerritoryId !== null) setSailShips(sailMaxShips);
  }

  const selectSailStart = useCallback(
    (territoryId: number | null) => {
      connector.sailSelectStart({ territoryId }, (res: Ack) => {
        if (res.ok) setGame(res.game);
      });
    },
    [setGame],
  );

  const cancelSail = useCallback(
    () => selectSailStart(null),
    [selectSailStart],
  );

  const selectSailEnd = useCallback(
    (territoryId: number) => {
      connector.sailSelectEnd({ territoryId }, (res: Ack) => {
        if (res.ok) setGame(res.game);
      });
    },
    [setGame],
  );

  const submitSail = useCallback(() => {
    connector.sail({ ships: sailShips }, (res: Ack) => {
      if (!res.ok) return;
      setGame(res.game);
    });
  }, [sailShips, setGame]);

  const quickSail = useCallback(
    (territoryId: number) => {
      connector.quickSail({ territoryId }, (res: Ack) => {
        if (res.ok) setGame(res.game);
      });
    },
    [setGame],
  );

  const sailPanelOpen =
    turnPhase === 'sail' && isMyTurn && !paused && sailEndTerritoryId !== null;

  return {
    sailShips,
    setSailShips,
    sailInputRef,
    sailMaxShips,
    sailStartCandidates,
    sailEndCandidates,
    selectSailStart,
    selectSailEnd,
    submitSail,
    quickSail,
    cancelSail,
    sailPanelOpen,
  };
}
