import { useCallback, useEffect, useRef, useState } from 'react';
import { socket } from '../../../lib/socket';
import type { Ack, GameState } from '../../../lib/types';
import { DICE_ROLL_STEP_DURATION, DICE_ROLL_STEPS } from '../../animations';
import {
  getAttackEndCandidates,
  getAttackStartCandidates,
} from '../../logic/attack';
import type { Territory } from '../../mapData';
import type { AttackType, DiceRoll } from '../../panels/AttackPanel';

type AttackSelectEndAck =
  | { ok: true; game: GameState; blitzWinProbabilities: number[] }
  | { ok: false; error: string };

type AttackResultAck =
  | {
      ok: true;
      game: GameState;
      blitzWinProbabilities: number[];
      attackerDice: number[];
      defenderDice: number[];
    }
  | { ok: false; error: string };

export function useAttackFlow({
  attackStartTerritoryId,
  attackEndTerritoryId,
  attackConquestMinTroops,
  territories,
  ownerById,
  selfId,
  portalTerritoryIds,
  portalsEnabled,
  unusableTerritoryById,
  turnPhase,
  isMyTurn,
  paused,
  setGame,
}: {
  attackStartTerritoryId: number | null;
  attackEndTerritoryId: number | null;
  attackConquestMinTroops: number | null;
  territories: Territory[];
  ownerById: Map<number, GameState['territories'][number]>;
  selfId: number | null;
  portalTerritoryIds: number[];
  portalsEnabled: boolean;
  unusableTerritoryById: Set<number>;
  turnPhase: GameState['turnPhase'];
  isMyTurn: boolean;
  paused: boolean;
  setGame: (game: GameState) => void;
}) {
  const [attackWinProbabilities, setAttackWinProbabilities] = useState<
    number[] | null
  >(null);
  const [attackSelectedType, setAttackSelectedType] =
    useState<AttackType>('regular');
  const [attackRegularTroops, setAttackRegularTroops] = useState<1 | 2 | 3>(1);
  const [attackBlitzTroops, setAttackBlitzTroops] = useState(1);
  const blitzInputRef = useRef<HTMLInputElement>(null);
  const [attackMoveTroops, setAttackMoveTroops] = useState(1);
  const attackMoveInputRef = useRef<HTMLInputElement>(null);
  const [attackDiceRoll, setAttackDiceRoll] = useState<DiceRoll | null>(null);
  const [attackDiceSettled, setAttackDiceSettled] = useState(true);
  const attackDiceRollIdRef = useRef(0);
  const [attackPreRevealSnapshot, setAttackPreRevealSnapshot] = useState<{
    maxBlitzTroops: number;
    blitzWinProbabilities: number[];
    selectedType: AttackType;
    regularTroops: 1 | 2 | 3;
    blitzTroops: number;
  } | null>(null);
  const attackOptionIndexRef = useRef(0);

  const maxBlitzTroops =
    attackStartTerritoryId !== null
      ? Math.max(1, (ownerById.get(attackStartTerritoryId)?.troops ?? 1) - 1)
      : 1;

  const selectAttackStart = useCallback(
    (territoryId: number | null) => {
      socket.emit('game:attackSelectStart', { territoryId }, (res: Ack) => {
        if (!res.ok) return;
        setGame(res.game);
        if (territoryId !== null) setAttackDiceRoll(null);
      });
    },
    [setGame],
  );

  const cancelAttack = useCallback(
    () => selectAttackStart(null),
    [selectAttackStart],
  );

  const applyAttackProbabilities = useCallback(
    (blitzWinProbabilities: number[]) => {
      setAttackWinProbabilities(blitzWinProbabilities);
      setAttackSelectedType('blitz');
      setAttackRegularTroops(1);
      setAttackBlitzTroops(Math.max(1, blitzWinProbabilities.length));
    },
    [],
  );

  const continueAttackSelection = useCallback(
    (blitzWinProbabilities: number[]) => {
      setAttackWinProbabilities(blitzWinProbabilities);
      const newMaxBlitz = blitzWinProbabilities.length;
      const newMaxRegular = Math.min(newMaxBlitz, 3);
      setAttackRegularTroops(
        (prev) => Math.min(prev, newMaxRegular) as 1 | 2 | 3,
      );
      setAttackBlitzTroops((prev) => Math.min(prev, newMaxBlitz));
    },
    [],
  );

  const selectAttackEnd = useCallback(
    (territoryId: number) => {
      socket.emit(
        'game:attackSelectEnd',
        { territoryId },
        (res: AttackSelectEndAck) => {
          if (!res.ok) return;
          setGame(res.game);
          applyAttackProbabilities(res.blitzWinProbabilities);
        },
      );
    },
    [setGame, applyAttackProbabilities],
  );

  const performAttackMove = useCallback(
    (troops: number, conqueredTerritoryId: number | null) => {
      socket.emit('game:attackMove', { troops }, (res: Ack) => {
        if (!res.ok) return;
        setGame(res.game);
        if (conqueredTerritoryId !== null) {
          const freshOwnerById = new Map(
            res.game.territories.map((t) => [t.id, t]),
          );
          const candidates = getAttackStartCandidates(
            territories,
            freshOwnerById,
            selfId,
            portalTerritoryIds,
            portalsEnabled,
            unusableTerritoryById,
          );
          if (candidates.has(conqueredTerritoryId)) {
            selectAttackStart(conqueredTerritoryId);
          }
        }
      });
    },
    [
      territories,
      selfId,
      portalTerritoryIds,
      portalsEnabled,
      unusableTerritoryById,
      setGame,
      selectAttackStart,
    ],
  );

  const submitAttack = useCallback(() => {
    const preRevealSnapshot = {
      maxBlitzTroops,
      blitzWinProbabilities: attackWinProbabilities ?? [],
      selectedType: attackSelectedType,
      regularTroops: attackRegularTroops,
      blitzTroops: attackBlitzTroops,
    };
    const payload =
      attackSelectedType === 'regular'
        ? { type: 'regular' as const, troops: attackRegularTroops }
        : { type: 'blitz' as const, troops: attackBlitzTroops };
    socket.emit('game:attack', payload, (res: AttackResultAck) => {
      if (!res.ok) return;
      const hasDiceRoll =
        res.attackerDice.length > 0 && attackEndTerritoryId !== null;
      setGame(
        hasDiceRoll && res.game.state === 'ended'
          ? { ...res.game, state: 'playing' }
          : res.game,
      );
      const conqueredTerritoryId = res.game.attackEndTerritoryId;
      let autoMoveTroops: number | null = null;
      if (res.game.attackConquestMinTroops !== null) {
        const startTerritory = res.game.territories.find(
          (t) => t.id === attackStartTerritoryId,
        );
        const minMove = res.game.attackConquestMinTroops;
        const maxMove = startTerritory
          ? Math.max(minMove, startTerritory.troops - 1)
          : minMove;
        setAttackMoveTroops(maxMove);
        if (minMove === maxMove) autoMoveTroops = maxMove;
      }

      if (hasDiceRoll) {
        attackDiceRollIdRef.current += 1;
        const rollId = attackDiceRollIdRef.current;
        setAttackPreRevealSnapshot(preRevealSnapshot);
        setAttackDiceRoll({
          attackerDice: res.attackerDice,
          defenderDice: res.defenderDice,
          territoryId: attackEndTerritoryId!,
          id: rollId,
        });
        setAttackDiceSettled(false);
        setTimeout(() => {
          if (attackDiceRollIdRef.current !== rollId) return;
          setAttackDiceSettled(true);
          setAttackPreRevealSnapshot(null);
          if (res.game.state === 'ended') {
            setGame(res.game);
          } else if (res.game.attackConquestMinTroops !== null) {
            if (autoMoveTroops !== null) {
              performAttackMove(autoMoveTroops, conqueredTerritoryId);
            } else {
              setAttackDiceRoll((prev) => (prev?.id === rollId ? null : prev));
            }
          } else if (res.game.attackEndTerritoryId !== null) {
            continueAttackSelection(res.blitzWinProbabilities);
          }
        }, DICE_ROLL_STEPS * DICE_ROLL_STEP_DURATION);
      } else if (autoMoveTroops !== null) {
        performAttackMove(autoMoveTroops, conqueredTerritoryId);
      } else if (
        res.game.attackConquestMinTroops === null &&
        res.game.attackEndTerritoryId !== null
      ) {
        continueAttackSelection(res.blitzWinProbabilities);
      }
    });
  }, [
    attackSelectedType,
    attackRegularTroops,
    attackBlitzTroops,
    attackStartTerritoryId,
    attackEndTerritoryId,
    maxBlitzTroops,
    attackWinProbabilities,
    setGame,
    continueAttackSelection,
    performAttackMove,
  ]);

  const submitAttackMove = useCallback(() => {
    performAttackMove(attackMoveTroops, attackEndTerritoryId);
  }, [attackMoveTroops, attackEndTerritoryId, performAttackMove]);

  const attackPendingConquest = attackConquestMinTroops !== null;
  const attackStartCandidates =
    turnPhase === 'attack' && isMyTurn && !attackPendingConquest
      ? getAttackStartCandidates(
          territories,
          ownerById,
          selfId,
          portalTerritoryIds,
          portalsEnabled,
          unusableTerritoryById,
        )
      : new Set<number>();
  const attackEndCandidates =
    turnPhase === 'attack' &&
    isMyTurn &&
    attackStartTerritoryId !== null &&
    attackEndTerritoryId === null
      ? getAttackEndCandidates(
          territories,
          ownerById,
          selfId,
          attackStartTerritoryId,
          portalTerritoryIds,
          portalsEnabled,
          unusableTerritoryById,
        )
      : new Set<number>();
  const attackMoveMinTroops = attackConquestMinTroops ?? 1;
  const attackMoveMaxTroops =
    attackStartTerritoryId !== null
      ? Math.max(1, (ownerById.get(attackStartTerritoryId)?.troops ?? 1) - 1)
      : 1;
  const maxRegularTroops = Math.min(maxBlitzTroops, 3);

  useEffect(() => {
    attackOptionIndexRef.current =
      attackSelectedType === 'blitz'
        ? maxRegularTroops
        : attackRegularTroops - 1;
  });

  const cycleAttackOption = useCallback(
    (direction: 1 | -1) => {
      const optionCount = maxRegularTroops + 1;
      const nextIndex =
        (attackOptionIndexRef.current + direction + optionCount) % optionCount;
      attackOptionIndexRef.current = nextIndex;
      setAttackDiceRoll(null);
      if (nextIndex === maxRegularTroops) {
        setAttackSelectedType('blitz');
      } else {
        setAttackSelectedType('regular');
        setAttackRegularTroops((nextIndex + 1) as 1 | 2 | 3);
      }
    },
    [maxRegularTroops],
  );

  if (attackEndTerritoryId === null && attackWinProbabilities !== null) {
    setAttackWinProbabilities(null);
  }

  const attackRevealing = attackDiceRoll !== null && !attackDiceSettled;
  const attackDiceOnly =
    attackDiceSettled &&
    attackEndTerritoryId === null &&
    attackDiceRoll !== null;
  const attackShowPendingConquest = attackPendingConquest && attackDiceSettled;
  const attackPanelOpen =
    turnPhase === 'attack' &&
    isMyTurn &&
    !paused &&
    (attackRevealing ||
      (attackEndTerritoryId !== null &&
        (attackPendingConquest || attackWinProbabilities !== null)) ||
      attackDiceOnly);

  if (!attackPanelOpen && attackDiceRoll !== null) {
    setAttackDiceRoll(null);
    setAttackDiceSettled(true);
    setAttackPreRevealSnapshot(null);
  }

  useEffect(() => {
    if (!attackDiceOnly) return;
    const rollId = attackDiceRoll?.id;
    const timer = setTimeout(() => {
      setAttackDiceRoll((prev) => (prev?.id === rollId ? null : prev));
    }, 2000);
    return () => clearTimeout(timer);
  }, [attackDiceOnly, attackDiceRoll?.id]);

  const attackDisplay =
    attackRevealing && attackPreRevealSnapshot
      ? attackPreRevealSnapshot
      : {
          maxBlitzTroops,
          blitzWinProbabilities: attackWinProbabilities ?? [],
          selectedType: attackSelectedType,
          regularTroops: attackRegularTroops,
          blitzTroops: attackBlitzTroops,
        };

  return {
    attackWinProbabilities,
    attackSelectedType,
    setAttackSelectedType,
    attackRegularTroops,
    setAttackRegularTroops,
    attackBlitzTroops,
    setAttackBlitzTroops,
    blitzInputRef,
    attackMoveTroops,
    setAttackMoveTroops,
    attackMoveInputRef,
    attackDiceRoll,
    setAttackDiceRoll,
    attackDiceSettled,
    maxBlitzTroops,
    selectAttackStart,
    cancelAttack,
    selectAttackEnd,
    performAttackMove,
    submitAttack,
    submitAttackMove,
    attackPendingConquest,
    attackStartCandidates,
    attackEndCandidates,
    attackMoveMinTroops,
    attackMoveMaxTroops,
    maxRegularTroops,
    cycleAttackOption,
    attackRevealing,
    attackDiceOnly,
    attackShowPendingConquest,
    attackPanelOpen,
    attackDisplay,
  };
}
