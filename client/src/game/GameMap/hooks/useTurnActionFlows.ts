import { useCallback, useRef, useState } from 'react';
import { connector } from '../../../connector';
import type { Ack, Fortification, GameState } from '../../../lib/types';
import { getEntrenchCandidates } from '../../logic/entrench';
import {
  getFortifyEndCandidates,
  getFortifyStartCandidates,
} from '../../logic/fortify';
import type { Territory } from '../../mapData';
import { getToxinsCandidates, toxinsCost } from '../../toxins/toxins';

export function useTurnActionFlows({
  fortifyStartTerritoryId,
  fortifyEndTerritoryId,
  territories,
  ownerById,
  selfId,
  fortification,
  portalTerritoryIds,
  portalsEnabled,
  turnPhase,
  isMyTurn,
  paused,
  selectedTerritoryId,
  toxins,
  cards,
  nextSetBaseValues,
  toxinById,
  setGame,
}: {
  fortifyStartTerritoryId: number | null;
  fortifyEndTerritoryId: number | null;
  territories: Territory[];
  ownerById: Map<number, GameState['territories'][number]>;
  selfId: number | null;
  fortification: Fortification;
  portalTerritoryIds: number[];
  portalsEnabled: boolean;
  turnPhase: GameState['turnPhase'];
  isMyTurn: boolean;
  paused: boolean;
  selectedTerritoryId: number | null;
  toxins: GameState['toxins'];
  cards: GameState['cards'];
  nextSetBaseValues: GameState['nextSetBaseValues'];
  toxinById: Set<number>;
  setGame: (game: GameState) => void;
}) {
  const [fortifyTroops, setFortifyTroops] = useState(1);
  const [trackedFortifyEndTerritoryId, setTrackedFortifyEndTerritoryId] =
    useState<number | null>(null);
  const fortifyInputRef = useRef<HTMLInputElement>(null);
  const [entrenchTroops, setEntrenchTroops] = useState(1);
  const entrenchInputRef = useRef<HTMLInputElement>(null);

  const fortifyStartCandidates =
    turnPhase === 'fortify' && isMyTurn
      ? getFortifyStartCandidates(
          territories,
          ownerById,
          selfId,
          fortification,
          portalTerritoryIds,
          portalsEnabled,
        )
      : new Set<number>();
  const fortifyEndCandidates =
    turnPhase === 'fortify' && isMyTurn && fortifyStartTerritoryId !== null
      ? getFortifyEndCandidates(
          territories,
          ownerById,
          selfId,
          fortifyStartTerritoryId,
          fortification,
          portalTerritoryIds,
          portalsEnabled,
        )
      : new Set<number>();
  const fortifyMaxTroops =
    fortifyStartTerritoryId !== null
      ? (ownerById.get(fortifyStartTerritoryId)?.troops ?? 1) - 1
      : 1;

  if (trackedFortifyEndTerritoryId !== fortifyEndTerritoryId) {
    setTrackedFortifyEndTerritoryId(fortifyEndTerritoryId);
    if (fortifyEndTerritoryId !== null) setFortifyTroops(fortifyMaxTroops);
  }

  const selectFortifyStart = useCallback(
    (territoryId: number | null) => {
      connector.fortifySelectStart({ territoryId }, (res: Ack) => {
        if (res.ok) setGame(res.game);
      });
    },
    [setGame],
  );

  const cancelFortify = useCallback(
    () => selectFortifyStart(null),
    [selectFortifyStart],
  );

  const selectFortifyEnd = useCallback(
    (territoryId: number) => {
      connector.fortifySelectEnd({ territoryId }, (res: Ack) => {
        if (res.ok) setGame(res.game);
      });
    },
    [setGame],
  );

  const submitFortify = useCallback(() => {
    connector.fortify({ troops: fortifyTroops }, (res: Ack) => {
      if (!res.ok) return;
      setGame(res.game);
    });
  }, [fortifyTroops, setGame]);

  const entrenchCandidates = isMyTurn
    ? getEntrenchCandidates(territories, ownerById, selfId)
    : new Set<number>();
  const entrenchMaxTroops =
    selectedTerritoryId !== null
      ? (ownerById.get(selectedTerritoryId)?.troops ?? 1) - 1
      : 1;
  const entrenchCurrentTurns =
    selectedTerritoryId !== null
      ? (ownerById.get(selectedTerritoryId)?.entrenchedTurns ?? 0)
      : 0;

  const submitEntrench = useCallback(() => {
    if (selectedTerritoryId === null) return;
    connector.entrench(
      { territoryId: selectedTerritoryId, troops: entrenchTroops },
      (res: Ack) => {
        if (!res.ok) return;
        setGame(res.game);
      },
    );
  }, [selectedTerritoryId, entrenchTroops, setGame]);

  const toxinsCostValue = toxinsCost(toxins, cards, nextSetBaseValues);
  const toxinsWastedTroops =
    selectedTerritoryId !== null
      ? Math.max(
          0,
          (ownerById.get(selectedTerritoryId)?.troops ?? 0) - toxinsCostValue,
        )
      : 0;
  const toxinsCandidates = isMyTurn
    ? getToxinsCandidates(
        territories,
        ownerById,
        selfId,
        toxinsCostValue,
        toxinById,
        portalTerritoryIds,
        portalsEnabled,
      )
    : new Set<number>();

  const submitToxins = useCallback(() => {
    if (selectedTerritoryId === null) return;
    connector.toxins({ territoryId: selectedTerritoryId }, (res: Ack) => {
      if (!res.ok) return;
      setGame(res.game);
    });
  }, [selectedTerritoryId, setGame]);

  const fortifyPanelOpen =
    turnPhase === 'fortify' &&
    isMyTurn &&
    !paused &&
    fortifyEndTerritoryId !== null;
  const entrenchPanelOpen =
    turnPhase === 'entrench' &&
    isMyTurn &&
    !paused &&
    selectedTerritoryId !== null;
  const toxinsPanelOpen =
    turnPhase === 'toxins' &&
    isMyTurn &&
    !paused &&
    selectedTerritoryId !== null;

  return {
    fortifyTroops,
    setFortifyTroops,
    fortifyInputRef,
    entrenchInputRef,
    fortifyStartCandidates,
    fortifyEndCandidates,
    fortifyMaxTroops,
    selectFortifyStart,
    cancelFortify,
    selectFortifyEnd,
    submitFortify,
    fortifyPanelOpen,
    entrenchTroops,
    setEntrenchTroops,
    entrenchCandidates,
    entrenchMaxTroops,
    entrenchCurrentTurns,
    submitEntrench,
    entrenchPanelOpen,
    toxinsCostValue,
    toxinsWastedTroops,
    toxinsCandidates,
    submitToxins,
    toxinsPanelOpen,
  };
}
