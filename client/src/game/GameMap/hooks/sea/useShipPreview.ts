import type { RefObject } from 'react';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import {
  areAnimationsDisabled,
  holdShip,
  onAnimationsToggle,
  releaseShip,
} from '../../../animations';
import type { SeaTerritory, Territory } from '../../../mapData';
import type { ClickableRegions } from '../../../regions/clickableRegions';
import { shipSlideTargets } from './shipSlides';

interface HeldShip {
  playerId: number;
  x: number;
  y: number;
}

export function useShipPreview({
  pathRuns,
  selfId,
  regions,
  territoriesRef,
  seaTerritoriesRef,
  startAnimationLoop,
}: {
  pathRuns: number[][];
  selfId: number | null;
  regions: ClickableRegions | null;
  territoriesRef: RefObject<Territory[]>;
  seaTerritoriesRef: RefObject<SeaTerritory[]>;
  startAnimationLoop: () => void;
}) {
  const heldRef = useRef(new Map<number, HeldShip>());
  const signature = JSON.stringify(pathRuns);
  const animationsDisabled = useSyncExternalStore(
    onAnimationsToggle,
    areAnimationsDisabled,
  );

  useEffect(() => {
    const held = heldRef.current;
    const next = new Map<number, HeldShip>();
    if (selfId !== null && !animationsDisabled) {
      const positionOf = (id: number) =>
        territoriesRef.current.find((t) => t.id === id) ??
        seaTerritoriesRef.current.find((t) => t.id === id);
      for (const { seaId, target } of shipSlideTargets(
        JSON.parse(signature) as number[][],
        regions,
        seaTerritoriesRef.current,
        positionOf,
      ))
        next.set(seaId, { playerId: selfId, x: target.x, y: target.y });
    }
    for (const [seaId, ship] of held)
      if (!next.has(seaId)) releaseShip(seaId, ship.playerId);
    for (const [seaId, ship] of next) {
      const before = held.get(seaId);
      if (before && before.x === ship.x && before.y === ship.y) continue;
      holdShip(seaId, ship.playerId, { x: ship.x, y: ship.y });
    }
    heldRef.current = next;
    startAnimationLoop();
  }, [
    signature,
    selfId,
    animationsDisabled,
    regions,
    territoriesRef,
    seaTerritoriesRef,
    startAnimationLoop,
  ]);

  useEffect(
    () => () => {
      for (const [seaId, ship] of heldRef.current)
        releaseShip(seaId, ship.playerId);
      heldRef.current = new Map();
    },
    [],
  );
}
