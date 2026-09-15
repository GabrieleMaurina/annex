import { useCallback, useEffect, useRef, useState } from 'react';
import { connector } from '../../../../connector';
import type { Ack, GameState } from '../../../../lib/types';
import { DICE_ROLL_STEP_DURATION, DICE_ROLL_STEPS } from '../../../animations';
import {
  getAttackSeaStartCandidates,
  getSeaDefenders,
} from '../../../logic/attackSea';
import type { SeaTerritory } from '../../../mapData';
import type { DiceRoll } from '../../../panels/AttackPanel';

type AttackSeaResultAck =
  | {
      ok: true;
      game: GameState;
      attackerDice: number[];
      defenderDice: number[];
    }
  | { ok: false; error: string };

function shipsAt(
  seas: GameState['seas'],
  seaTerritoryId: number | null,
  playerId: number | null,
): number {
  if (seaTerritoryId === null || playerId === null) return 0;
  const sea = seas.find((s) => s.id === seaTerritoryId);
  return sea?.ships.find((b) => b.playerId === playerId)?.ships ?? 0;
}

export function useAttackSeaFlow({
  attackSeaTerritoryId,
  attackSeaDefenderId,
  seaTerritories,
  seas,
  selfId,
  turnPhase,
  isMyTurn,
  paused,
  setGame,
}: {
  attackSeaTerritoryId: number | null;
  attackSeaDefenderId: number | null;
  seaTerritories: SeaTerritory[];
  seas: GameState['seas'];
  selfId: number | null;
  turnPhase: GameState['turnPhase'];
  isMyTurn: boolean;
  paused: boolean;
  setGame: (game: GameState) => void;
}) {
  const [attackSeaShips, setAttackSeaShips] = useState(1);
  const [trackedAttackSeaKey, setTrackedAttackSeaKey] = useState('');
  const [attackSeaDiceRoll, setAttackSeaDiceRoll] = useState<DiceRoll | null>(
    null,
  );
  const [attackSeaDiceSettled, setAttackSeaDiceSettled] = useState(true);
  const attackSeaDiceRollIdRef = useRef(0);
  const attackSeaInputRef = useRef<HTMLInputElement>(null);

  const attackSeaStartCandidates =
    turnPhase === 'attack' && isMyTurn
      ? getAttackSeaStartCandidates(seaTerritories, seas, selfId)
      : new Set<number>();
  const attackSeaDefenders =
    attackSeaTerritoryId !== null
      ? getSeaDefenders(seas, attackSeaTerritoryId, selfId)
      : [];
  const attackSeaMaxShips = Math.min(
    3,
    shipsAt(seas, attackSeaTerritoryId, selfId),
  );
  const attackSeaDefenderValid =
    attackSeaDefenderId === null ||
    attackSeaDefenders.some((d) => d.playerId === attackSeaDefenderId);

  const attackSeaKey = `${attackSeaTerritoryId}-${attackSeaDefenderId}`;
  if (trackedAttackSeaKey !== attackSeaKey) {
    setTrackedAttackSeaKey(attackSeaKey);
    if (attackSeaMaxShips >= 1) setAttackSeaShips(attackSeaMaxShips);
  } else if (attackSeaMaxShips >= 1 && attackSeaShips > attackSeaMaxShips) {
    setAttackSeaShips(attackSeaMaxShips);
  }

  const selectAttackSeaStart = useCallback(
    (territoryId: number | null) => {
      setAttackSeaDiceRoll(null);
      setAttackSeaDiceSettled(true);
      connector.attackSeaSelectStart({ territoryId }, (res: Ack) => {
        if (res.ok) setGame(res.game);
      });
    },
    [setGame],
  );

  const cancelAttackSea = useCallback(
    () => selectAttackSeaStart(null),
    [selectAttackSeaStart],
  );

  const selectAttackSeaDefender = useCallback(
    (defenderId: number) => {
      setAttackSeaDiceRoll(null);
      setAttackSeaDiceSettled(true);
      connector.attackSeaSelectDefender({ defenderId }, (res: Ack) => {
        if (res.ok) setGame(res.game);
      });
    },
    [setGame],
  );

  const submitAttackSea = useCallback(() => {
    const seaTerritoryId = attackSeaTerritoryId;
    if (seaTerritoryId === null) return;
    connector.attackSea(
      { ships: attackSeaShips },
      (res: AttackSeaResultAck) => {
        if (!res.ok) return;
        setGame(res.game);
        attackSeaDiceRollIdRef.current += 1;
        const rollId = attackSeaDiceRollIdRef.current;
        setAttackSeaDiceRoll({
          attackerDice: res.attackerDice,
          defenderDice: res.defenderDice,
          territoryId: seaTerritoryId,
          id: rollId,
        });
        setAttackSeaDiceSettled(false);
        setTimeout(() => {
          if (attackSeaDiceRollIdRef.current !== rollId) return;
          setAttackSeaDiceSettled(true);
        }, DICE_ROLL_STEPS * DICE_ROLL_STEP_DURATION);
      },
    );
  }, [attackSeaShips, attackSeaTerritoryId, setGame]);

  const attackSeaRevealing =
    attackSeaDiceRoll !== null && !attackSeaDiceSettled;
  const attackSeaDiceOnly =
    attackSeaDiceSettled &&
    attackSeaTerritoryId === null &&
    attackSeaDiceRoll !== null;
  const attackSeaPanelOpen =
    turnPhase === 'attack' &&
    isMyTurn &&
    !paused &&
    (attackSeaTerritoryId !== null || attackSeaRevealing || attackSeaDiceOnly);

  if (!attackSeaPanelOpen && attackSeaDiceRoll !== null) {
    setAttackSeaDiceRoll(null);
    setAttackSeaDiceSettled(true);
  }

  useEffect(() => {
    if (!attackSeaDiceOnly) return;
    const rollId = attackSeaDiceRoll?.id;
    const timer = setTimeout(() => {
      setAttackSeaDiceRoll((prev) => (prev?.id === rollId ? null : prev));
    }, 2000);
    return () => clearTimeout(timer);
  }, [attackSeaDiceOnly, attackSeaDiceRoll?.id]);

  useEffect(() => {
    if (attackSeaTerritoryId === null || attackSeaDefenderValid) return;
    connector.attackSeaSelectStart(
      { territoryId: attackSeaTerritoryId },
      (res: Ack) => {
        if (res.ok) setGame(res.game);
      },
    );
  }, [attackSeaTerritoryId, attackSeaDefenderValid, setGame]);

  return {
    attackSeaShips,
    setAttackSeaShips,
    attackSeaMaxShips,
    attackSeaInputRef,
    attackSeaDiceRoll,
    setAttackSeaDiceRoll,
    attackSeaRevealing,
    attackSeaDiceOnly,
    attackSeaStartCandidates,
    attackSeaDefenders,
    selectAttackSeaStart,
    selectAttackSeaDefender,
    submitAttackSea,
    cancelAttackSea,
    attackSeaPanelOpen,
  };
}
