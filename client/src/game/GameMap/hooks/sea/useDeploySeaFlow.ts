import { useCallback, useRef, useState } from 'react';
import { connector } from '../../../../connector';
import type { Ack, GameState } from '../../../../lib/types';
import type { SeaTerritory, Territory } from '../../../mapData';

export const SHIP_COST = 3;

export function useDeploySeaFlow({
  selectedTerritoryId,
  territories,
  seaTerritories,
  ownerById,
  troopsToDeploy,
  turnPhase,
  isMyTurn,
  paused,
  selfId,
  setGame,
}: {
  selectedTerritoryId: number | null;
  territories: Territory[];
  seaTerritories: SeaTerritory[];
  ownerById: Map<number, GameState['territories'][number]>;
  troopsToDeploy: number;
  turnPhase: GameState['turnPhase'];
  isMyTurn: boolean;
  paused: boolean;
  selfId: number | null;
  setGame: (game: GameState) => void;
}) {
  const [deploySeaTerritoryId, setDeploySeaTerritoryId] = useState<
    number | null
  >(null);
  const [deploySeaShips, setDeploySeaShips] = useState(1);
  const [trackedKey, setTrackedKey] = useState('');
  const deploySeaInputRef = useRef<HTMLInputElement>(null);

  const active = turnPhase === 'deploy' && isMyTurn && !paused;

  if (!active && deploySeaTerritoryId !== null) {
    setDeploySeaTerritoryId(null);
  }

  const isSeaAdjacentToTerritory = useCallback(
    (seaTerritoryId: number, territoryId: number) =>
      territories
        .find((t) => t.id === territoryId)
        ?.neighbors.includes(seaTerritoryId) ?? false,
    [territories],
  );

  const deploySeaCandidates = active
    ? new Set(
        seaTerritories
          .filter((s) => {
            const adjacentOwned = territories.filter(
              (t) =>
                t.neighbors.includes(s.id) &&
                ownerById.get(t.id)?.ownerId === selfId,
            );
            if (adjacentOwned.length === 0) return false;
            if (troopsToDeploy >= SHIP_COST) return true;
            return adjacentOwned.some(
              (t) => (ownerById.get(t.id)?.troops ?? 0) - 1 >= SHIP_COST,
            );
          })
          .map((s) => s.id),
      )
    : new Set<number>();

  const comboActive =
    deploySeaTerritoryId !== null &&
    selectedTerritoryId !== null &&
    isSeaAdjacentToTerritory(deploySeaTerritoryId, selectedTerritoryId);

  const territoryTroops =
    comboActive && selectedTerritoryId !== null
      ? (ownerById.get(selectedTerritoryId)?.troops ?? 0)
      : 0;
  const deploySeaMaxShips = comboActive
    ? Math.floor((territoryTroops - 1) / SHIP_COST)
    : Math.floor(troopsToDeploy / SHIP_COST);

  const trackKey = `${deploySeaTerritoryId}-${comboActive ? selectedTerritoryId : 'pool'}`;
  if (trackedKey !== trackKey) {
    setTrackedKey(trackKey);
    if (deploySeaTerritoryId !== null && deploySeaMaxShips >= 1)
      setDeploySeaShips(deploySeaMaxShips);
  } else if (deploySeaMaxShips >= 1 && deploySeaShips > deploySeaMaxShips) {
    setDeploySeaShips(deploySeaMaxShips);
  }

  const selectDeploySea = useCallback((seaTerritoryId: number) => {
    setDeploySeaTerritoryId(seaTerritoryId);
  }, []);

  const cancelDeploySea = useCallback(() => setDeploySeaTerritoryId(null), []);

  const buyShips = useCallback(
    (seaTerritoryId: number, combo: boolean, ships: number) => {
      const sourceTerritoryId = combo
        ? selectedTerritoryId
        : (territories.find(
            (t) =>
              t.neighbors.includes(seaTerritoryId) &&
              ownerById.get(t.id)?.ownerId === selfId,
          )?.id ?? null);
      if (sourceTerritoryId === null) return;
      connector.buyShips(
        { sourceTerritoryId, seaTerritoryId, ships, fromPool: !combo },
        (res: Ack) => {
          if (res.ok) {
            setGame(res.game);
            setDeploySeaTerritoryId(null);
            if (combo) {
              connector.selectTerritory(
                { territoryId: null },
                (selectRes: Ack) => {
                  if (selectRes.ok) setGame(selectRes.game);
                },
              );
            }
          }
        },
      );
    },
    [selectedTerritoryId, territories, ownerById, selfId, setGame],
  );

  const submitDeploySea = useCallback(() => {
    if (deploySeaTerritoryId === null) return;
    buyShips(deploySeaTerritoryId, comboActive, deploySeaShips);
  }, [deploySeaTerritoryId, comboActive, deploySeaShips, buyShips]);

  const quickDeploySea = useCallback(
    (seaTerritoryId: number) => {
      const combo =
        selectedTerritoryId !== null &&
        isSeaAdjacentToTerritory(seaTerritoryId, selectedTerritoryId);
      const ships = combo
        ? Math.floor(
            ((ownerById.get(selectedTerritoryId)?.troops ?? 0) - 1) / SHIP_COST,
          )
        : Math.floor(troopsToDeploy / SHIP_COST);
      if (ships >= 1) buyShips(seaTerritoryId, combo, ships);
    },
    [
      selectedTerritoryId,
      isSeaAdjacentToTerritory,
      ownerById,
      troopsToDeploy,
      buyShips,
    ],
  );

  const deploySeaPanelOpen = active && deploySeaTerritoryId !== null;

  return {
    deploySeaCandidates,
    deploySeaTerritoryId,
    selectDeploySea,
    cancelDeploySea,
    isSeaAdjacentToTerritory,
    comboActive,
    deploySeaShips,
    setDeploySeaShips,
    deploySeaMaxShips,
    deploySeaInputRef,
    submitDeploySea,
    quickDeploySea,
    deploySeaPanelOpen,
  };
}
