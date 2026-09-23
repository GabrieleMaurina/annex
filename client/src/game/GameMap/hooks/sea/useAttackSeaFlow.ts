import { useCallback, useEffect, useRef, useState } from 'react';
import { connector } from '../../../../connector';
import type { Ack, BlitzOutcome, GameState } from '../../../../lib/types';
import { DICE_ROLL_STEP_DURATION, DICE_ROLL_STEPS } from '../../../animations';
import {
  getAttackSeaStartCandidates,
  getSeaDefenders,
} from '../../../logic/attackSea';
import type { SeaTerritory } from '../../../mapData';
import type { AttackType, DiceRoll } from '../../../panels/attack/AttackPanel';

type AttackSeaProbabilitiesAck =
  | {
      ok: true;
      game: GameState;
      blitzWinProbabilities: number[];
      blitzOutcomes?: BlitzOutcome[];
    }
  | { ok: false; error: string };

type AttackSeaResultAck =
  | {
      ok: true;
      game: GameState;
      blitzWinProbabilities: number[];
      blitzOutcomes?: BlitzOutcome[];
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
  const [attackSeaRegularShips, setAttackSeaRegularShips] = useState(1);
  const [attackSeaBlitzShips, setAttackSeaBlitzShips] = useState(1);
  const [attackSeaSelectedType, setAttackSeaSelectedType] =
    useState<AttackType>('regular');
  const [attackSeaWinProbabilities, setAttackSeaWinProbabilities] = useState<
    number[] | null
  >(null);
  const [attackSeaBlitzOutcomes, setAttackSeaBlitzOutcomes] = useState<
    BlitzOutcome[] | null
  >(null);
  const [trackedAttackSeaKey, setTrackedAttackSeaKey] = useState('');
  const [attackSeaDiceRoll, setAttackSeaDiceRoll] = useState<DiceRoll | null>(
    null,
  );
  const [attackSeaDiceSettled, setAttackSeaDiceSettled] = useState(true);
  const attackSeaDiceRollIdRef = useRef(0);
  const attackSeaInputRef = useRef<HTMLInputElement>(null);
  const attackSeaBlitzInputRef = useRef<HTMLInputElement>(null);

  const attackSeaStartCandidates =
    turnPhase === 'attack' && isMyTurn
      ? getAttackSeaStartCandidates(seaTerritories, seas, selfId)
      : new Set<number>();
  const attackSeaDefenders =
    attackSeaTerritoryId !== null
      ? getSeaDefenders(seas, attackSeaTerritoryId, selfId)
      : [];
  const attackSeaOwnShips = shipsAt(seas, attackSeaTerritoryId, selfId);
  const attackSeaMaxRegularShips = Math.min(3, attackSeaOwnShips);
  const attackSeaMaxBlitzShips = attackSeaOwnShips;
  const attackSeaDefenderValid =
    attackSeaDefenderId === null ||
    attackSeaDefenders.some((d) => d.playerId === attackSeaDefenderId);

  const attackSeaKey = `${attackSeaTerritoryId}-${attackSeaDefenderId}`;
  if (trackedAttackSeaKey !== attackSeaKey) {
    setTrackedAttackSeaKey(attackSeaKey);
    setAttackSeaSelectedType('regular');
    if (attackSeaMaxRegularShips >= 1)
      setAttackSeaRegularShips(attackSeaMaxRegularShips);
    if (attackSeaMaxBlitzShips >= 1)
      setAttackSeaBlitzShips(attackSeaMaxBlitzShips);
  } else {
    if (
      attackSeaMaxRegularShips >= 1 &&
      attackSeaRegularShips > attackSeaMaxRegularShips
    )
      setAttackSeaRegularShips(attackSeaMaxRegularShips);
    if (
      attackSeaMaxBlitzShips >= 1 &&
      attackSeaBlitzShips > attackSeaMaxBlitzShips
    )
      setAttackSeaBlitzShips(attackSeaMaxBlitzShips);
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

  const requestAttackSeaDefender = useCallback(
    (defenderId: number) => {
      connector.attackSeaSelectDefender(
        { defenderId },
        (res: AttackSeaProbabilitiesAck) => {
          if (!res.ok) return;
          setGame(res.game);
          setAttackSeaWinProbabilities(res.blitzWinProbabilities);
          setAttackSeaBlitzOutcomes(res.blitzOutcomes ?? null);
        },
      );
    },
    [setGame],
  );

  const selectAttackSeaDefender = useCallback(
    (defenderId: number) => {
      setAttackSeaDiceRoll(null);
      setAttackSeaDiceSettled(true);
      requestAttackSeaDefender(defenderId);
    },
    [requestAttackSeaDefender],
  );

  const submitAttackSea = useCallback(() => {
    const seaTerritoryId = attackSeaTerritoryId;
    if (seaTerritoryId === null) return;
    const ships =
      attackSeaSelectedType === 'regular'
        ? attackSeaRegularShips
        : attackSeaBlitzShips;
    connector.attackSea(
      { type: attackSeaSelectedType, ships },
      (res: AttackSeaResultAck) => {
        if (!res.ok) return;
        setGame(res.game);
        const hasDiceRoll = res.attackerDice.length > 0;
        if (hasDiceRoll) {
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
            setAttackSeaWinProbabilities(res.blitzWinProbabilities);
            setAttackSeaBlitzOutcomes(res.blitzOutcomes ?? null);
          }, DICE_ROLL_STEPS * DICE_ROLL_STEP_DURATION);
        } else {
          setAttackSeaWinProbabilities(res.blitzWinProbabilities);
          setAttackSeaBlitzOutcomes(res.blitzOutcomes ?? null);
        }
      },
    );
  }, [
    attackSeaTerritoryId,
    attackSeaSelectedType,
    attackSeaRegularShips,
    attackSeaBlitzShips,
    setGame,
  ]);

  const quickAttackSea = useCallback(
    (territoryId: number) => {
      if (getSeaDefenders(seas, territoryId, selfId).length !== 1) {
        selectAttackSeaStart(territoryId);
        return;
      }
      setAttackSeaDiceRoll(null);
      setAttackSeaDiceSettled(true);
      connector.quickAttackSea({ territoryId }, (res: Ack) => {
        if (res.ok) setGame(res.game);
      });
    },
    [seas, selfId, selectAttackSeaStart, setGame],
  );

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

  if (attackSeaDefenderId === null && attackSeaWinProbabilities !== null) {
    setAttackSeaWinProbabilities(null);
  }
  if (attackSeaDefenderId === null && attackSeaBlitzOutcomes !== null) {
    setAttackSeaBlitzOutcomes(null);
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

  useEffect(() => {
    if (
      !attackSeaPanelOpen ||
      attackSeaDefenderId === null ||
      !attackSeaDefenderValid ||
      attackSeaWinProbabilities !== null
    )
      return;
    requestAttackSeaDefender(attackSeaDefenderId);
  }, [
    attackSeaPanelOpen,
    attackSeaDefenderId,
    attackSeaDefenderValid,
    attackSeaWinProbabilities,
    requestAttackSeaDefender,
  ]);

  return {
    attackSeaSelectedType,
    setAttackSeaSelectedType,
    attackSeaRegularShips,
    setAttackSeaRegularShips,
    attackSeaBlitzShips,
    setAttackSeaBlitzShips,
    attackSeaMaxRegularShips,
    attackSeaMaxBlitzShips,
    attackSeaWinProbabilities,
    attackSeaBlitzOutcomes,
    attackSeaInputRef,
    attackSeaBlitzInputRef,
    attackSeaDiceRoll,
    setAttackSeaDiceRoll,
    attackSeaRevealing,
    attackSeaDiceOnly,
    attackSeaStartCandidates,
    attackSeaDefenders,
    selectAttackSeaStart,
    selectAttackSeaDefender,
    submitAttackSea,
    quickAttackSea,
    cancelAttackSea,
    attackSeaPanelOpen,
  };
}
