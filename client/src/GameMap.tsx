import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Toast, ToastContainer } from 'react-bootstrap';
import {
  areAnimationsDisabled,
  DICE_ROLL_STEP_DURATION,
  DICE_ROLL_STEPS,
  drawAnimations,
  drawFortifyPath,
  getAnimationDuration,
  hasActiveAnimations,
  pruneAnimations,
  setContinuousAnimation,
  startAnimation,
} from './animations';
import { getAttackEndCandidates, getAttackStartCandidates } from './attack';
import AttackPanel, { type AttackType, type DiceRoll } from './AttackPanel';
import {
  getFortifyEndCandidates,
  getFortifyPath,
  getFortifyStartCandidates,
} from './fortify';
import {
  DEFAULT_IMAGE_HEIGHT,
  DEFAULT_IMAGE_WIDTH,
  loadGameMap,
  type Territory,
} from './mapData';
import {
  buildWrappedPathSegments,
  clamp,
  clampOffset,
  getClampedOffset as computeClampedOffset,
  getScales as computeScales,
  getAnchoredPanelPosition,
} from './mapMath';
import { continentColor, contrastTextColor, playerColor } from './palette';
import PlayersPanel from './PlayersPanel';
import { socket } from './socket';
import { playSound } from './sounds';
import TroopPanel from './TroopPanel';
import TurnPanel from './TurnPanel';
import TurnProgressBar from './TurnProgressBar';
import type { Ack, GameState, TurnDuration, TurnPhase } from './types';

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

interface Props {
  mapName: string;
  players: GameState['players'];
  spectators: GameState['spectators'];
  ownership: GameState['territories'];
  isTeamDeathmatch: boolean;
  selfId: number | null;
  turnNumber: number;
  turnPlayerIndex: number;
  turnPhase: TurnPhase;
  turnDuration: TurnDuration;
  troopsToDeploy: number;
  turnStartedAt: number;
  selectedTerritoryId: number | null;
  fortifyStartTerritoryId: number | null;
  fortifyEndTerritoryId: number | null;
  attackStartTerritoryId: number | null;
  attackEndTerritoryId: number | null;
  attackConquestMinTroops: number | null;
  setGame: (game: GameState) => void;
  setChatOpen: Dispatch<SetStateAction<boolean>>;
  navigate: (path: string) => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

interface Point {
  x: number;
  y: number;
}

interface Transform {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

type DragState = {
  startPos: Point;
  startTransform: Point;
  moved: boolean;
} | null;

const VERTEX_RADIUS = 20;
const HIT_TOLERANCE = 6;
const DRAG_THRESHOLD = 4;
const MIN_ZOOM = 1;
const MAX_ZOOM = 10;
const TROOP_PANEL_GAP = 10;
const TROOP_PANEL_HEIGHT = 50;
const TROOP_PANEL_WIDTH = 350;
const ATTACK_PANEL_WIDTH = 460;
const ATTACK_PANEL_HEIGHT = 160;
const SCREEN_EDGE_MARGIN = 8;
const TURN_PANEL_RESERVED_HEIGHT = 70;

const STATE_STYLE = {
  normal: { stroke: '#000000', width: 2 },
  selectable: { stroke: '#888888', width: 7 },
  hovered: { stroke: '#bbbbbb', width: 7 },
  selected: { stroke: '#ffffff', width: 7 },
};

function GameMap({
  mapName,
  players,
  spectators,
  ownership,
  isTeamDeathmatch,
  selfId,
  turnNumber,
  turnPlayerIndex,
  turnPhase,
  turnDuration,
  troopsToDeploy,
  turnStartedAt,
  selectedTerritoryId,
  fortifyStartTerritoryId,
  fortifyEndTerritoryId,
  attackStartTerritoryId,
  attackEndTerritoryId,
  attackConquestMinTroops,
  setGame,
  setChatOpen,
  navigate,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<DragState>(null);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [transform, setTransform] = useState<Transform>({
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [size, setSize] = useState({
    w: window.innerWidth,
    h: window.innerHeight,
  });
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);
  const [processedDeployPhaseKey, setProcessedDeployPhaseKey] = useState<
    string | null
  >(null);
  const [deployTroops, setDeployTroops] = useState(0);
  const [trackedSelectedTerritoryId, setTrackedSelectedTerritoryId] = useState<
    number | null
  >(null);
  const deployInputRef = useRef<HTMLInputElement>(null);
  const [fortifyTroops, setFortifyTroops] = useState(1);
  const [trackedFortifyEndTerritoryId, setTrackedFortifyEndTerritoryId] =
    useState<number | null>(null);
  const fortifyInputRef = useRef<HTMLInputElement>(null);
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
  const [imgDims, setImgDims] = useState({
    w: DEFAULT_IMAGE_WIDTH,
    h: DEFAULT_IMAGE_HEIGHT,
  });
  const [, forceRedraw] = useState(0);
  const animationLoopActiveRef = useRef(false);
  const frozenTroopsRef = useRef<Map<number, number>>(new Map());
  const ownerByIdRef = useRef(
    new Map<number, GameState['territories'][number]>(),
  );
  const territoriesRef = useRef<Territory[]>([]);
  const colorByPlayerIdRef = useRef(new Map<number, number>());
  const attackOptionIndexRef = useRef(0);

  function startAnimationLoop() {
    if (animationLoopActiveRef.current) return;
    animationLoopActiveRef.current = true;
    function step() {
      pruneAnimations();
      forceRedraw((n) => n + 1);
      if (hasActiveAnimations()) {
        requestAnimationFrame(step);
      } else {
        animationLoopActiveRef.current = false;
      }
    }
    requestAnimationFrame(step);
  }

  useEffect(() => {
    loadGameMap(mapName).then(({ territories, imageSrc }) => {
      setTerritories(territories);
      setTransform({ zoom: 1, offsetX: 0, offsetY: 0 });
      if (!imageSrc) {
        imageRef.current = null;
        setImgDims({ w: DEFAULT_IMAGE_WIDTH, h: DEFAULT_IMAGE_HEIGHT });
        return;
      }
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
        setTransform({ zoom: 1, offsetX: 0, offsetY: 0 });
      };
      img.src = imageSrc;
    });
  }, [mapName]);

  const currentTurnPlayer = players[turnPlayerIndex];
  const isMyTurn = currentTurnPlayer?.id === selfId;
  const ownerById = new Map(ownership.map((o) => [o.id, o]));
  const maxBlitzTroops =
    attackStartTerritoryId !== null
      ? Math.max(1, (ownerById.get(attackStartTerritoryId)?.troops ?? 1) - 1)
      : 1;
  useEffect(() => {
    ownerByIdRef.current = ownerById;
    territoriesRef.current = territories;
    colorByPlayerIdRef.current = new Map(
      players.map((pl) => [pl.id, pl.color]),
    );
  });

  const selectTerritory = useCallback(
    (territoryId: number | null) => {
      socket.emit('game:selectTerritory', { territoryId }, (res: Ack) => {
        if (res.ok) setGame(res.game);
      });
    },
    [setGame],
  );

  const selectFortifyStart = useCallback(
    (territoryId: number | null) => {
      socket.emit('game:fortifySelectStart', { territoryId }, (res: Ack) => {
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
      socket.emit('game:fortifySelectEnd', { territoryId }, (res: Ack) => {
        if (res.ok) setGame(res.game);
      });
    },
    [setGame],
  );

  const submitFortify = useCallback(() => {
    socket.emit('game:fortify', { troops: fortifyTroops }, (res: Ack) => {
      if (res.ok) setGame(res.game);
    });
  }, [fortifyTroops, setGame]);

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
      if (attackSelectedType === 'regular') {
        setAttackRegularTroops(
          (prev) => Math.min(prev, newMaxRegular) as 1 | 2 | 3,
        );
      } else {
        setAttackBlitzTroops((prev) => Math.min(prev, newMaxBlitz));
      }
    },
    [attackSelectedType],
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
        if (attackStartTerritoryId !== null)
          frozenTroopsRef.current.delete(attackStartTerritoryId);
        if (conqueredTerritoryId !== null) {
          frozenTroopsRef.current.delete(conqueredTerritoryId);
          const freshOwnerById = new Map(
            res.game.territories.map((t) => [t.id, t]),
          );
          const candidates = getAttackStartCandidates(
            territories,
            freshOwnerById,
            selfId,
          );
          if (candidates.has(conqueredTerritoryId)) {
            selectAttackStart(conqueredTerritoryId);
          }
        }
      });
    },
    [attackStartTerritoryId, territories, selfId, setGame, selectAttackStart],
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
      setGame(res.game);

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

      const hasDiceRoll =
        res.attackerDice.length > 0 && attackEndTerritoryId !== null;
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
          if (res.game.attackConquestMinTroops !== null) {
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

  const fortifyStartCandidates =
    turnPhase === 'fortify' && isMyTurn
      ? getFortifyStartCandidates(territories, ownerById, selfId)
      : new Set<number>();
  const fortifyEndCandidates =
    turnPhase === 'fortify' && isMyTurn && fortifyStartTerritoryId !== null
      ? getFortifyEndCandidates(
          territories,
          ownerById,
          selfId,
          fortifyStartTerritoryId,
        )
      : new Set<number>();
  const fortifyMaxTroops =
    fortifyStartTerritoryId !== null
      ? (ownerById.get(fortifyStartTerritoryId)?.troops ?? 1) - 1
      : 1;
  const fortifyPathOwnerId =
    fortifyStartTerritoryId !== null
      ? (ownerById.get(fortifyStartTerritoryId)?.ownerId ?? null)
      : null;
  const fortifyPath =
    fortifyStartTerritoryId !== null &&
    fortifyEndTerritoryId !== null &&
    fortifyPathOwnerId !== null
      ? getFortifyPath(
          territories,
          ownerById,
          fortifyPathOwnerId,
          fortifyStartTerritoryId,
          fortifyEndTerritoryId,
        )
      : [];

  const attackPendingConquest = attackConquestMinTroops !== null;
  const attackStartCandidates =
    turnPhase === 'attack' && isMyTurn && !attackPendingConquest
      ? getAttackStartCandidates(territories, ownerById, selfId)
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

  const deployPhaseKey =
    turnPhase === 'deploy' && currentTurnPlayer
      ? `${turnNumber}-${turnPlayerIndex}`
      : null;
  if (
    deployPhaseKey !== null &&
    processedDeployPhaseKey !== deployPhaseKey &&
    currentTurnPlayer
  ) {
    setProcessedDeployPhaseKey(deployPhaseKey);
    setToasts((prev) => [
      ...prev,
      {
        id: Date.now(),
        message: `${currentTurnPlayer.name} received ${troopsToDeploy} troops at the start of the turn`,
      },
    ]);
  }

  if (trackedSelectedTerritoryId !== selectedTerritoryId) {
    setTrackedSelectedTerritoryId(selectedTerritoryId);
    if (selectedTerritoryId !== null) setDeployTroops(troopsToDeploy);
  }

  if (trackedFortifyEndTerritoryId !== fortifyEndTerritoryId) {
    setTrackedFortifyEndTerritoryId(fortifyEndTerritoryId);
    if (fortifyEndTerritoryId !== null) setFortifyTroops(fortifyMaxTroops);
  }

  function colorForPlayer(playerId: number | undefined): string {
    if (playerId === undefined) return '#ffffff';
    const colorIndex = colorByPlayerIdRef.current.get(playerId);
    return colorIndex !== undefined ? playerColor(colorIndex) : '#ffffff';
  }

  useEffect(() => {
    function playTroopChangeEffect(
      sound: string,
      { territoryId, troops }: { territoryId: number; troops: number },
    ) {
      playSound(sound);
      if (areAnimationsDisabled()) return;
      const territory = territoriesRef.current.find(
        (t) => t.id === territoryId,
      );
      const ownerId = ownerByIdRef.current.get(territoryId)?.ownerId;
      if (territory)
        startAnimation(
          'deploy',
          territory.x,
          territory.y,
          `+${troops}`,
          colorForPlayer(ownerId),
        );
      const currentTroops = ownerByIdRef.current.get(territoryId)?.troops;
      if (currentTroops !== undefined) {
        frozenTroopsRef.current.set(territoryId, currentTroops);
        setTimeout(() => {
          frozenTroopsRef.current.delete(territoryId);
        }, getAnimationDuration('deploy'));
      }
      startAnimationLoop();
    }
    function onDeployed(payload: { territoryId: number; troops: number }) {
      playTroopChangeEffect('deploy', payload);
    }
    function onFortified(payload: { territoryId: number; troops: number }) {
      playTroopChangeEffect('fortify', payload);
    }
    function onAttackMoved(payload: { territoryId: number; troops: number }) {
      playTroopChangeEffect('fortify', payload);
    }
    socket.on('game:deployed', onDeployed);
    socket.on('game:fortified', onFortified);
    socket.on('game:attackMoved', onAttackMoved);
    return () => {
      socket.off('game:deployed', onDeployed);
      socket.off('game:fortified', onFortified);
      socket.off('game:attackMoved', onAttackMoved);
    };
  }, []);

  useEffect(() => {
    function explode(territoryId: number, losses: number, playerId: number) {
      const territory = territoriesRef.current.find(
        (t) => t.id === territoryId,
      );
      if (!territory) return;
      startAnimation(
        'explosion',
        territory.x,
        territory.y,
        `-${losses}`,
        colorForPlayer(playerId),
      );
      const currentTroops = ownerByIdRef.current.get(territoryId)?.troops;
      if (currentTroops === undefined) return;
      frozenTroopsRef.current.set(territoryId, currentTroops);
      setTimeout(() => {
        frozenTroopsRef.current.delete(territoryId);
      }, getAnimationDuration('explosion'));
    }
    function onAttacked(payload: {
      attackingTerritoryId: number;
      defendingTerritoryId: number;
      attackerId: number;
      defenderId: number;
      attackLosses: number;
      defenceLosses: number;
      type: 'regular' | 'blitz';
    }) {
      const delay =
        payload.type === 'regular'
          ? DICE_ROLL_STEPS * DICE_ROLL_STEP_DURATION
          : 0;
      setTimeout(() => {
        playSound('explode');
        if (areAnimationsDisabled()) return;
        if (payload.attackLosses > 0)
          explode(
            payload.attackingTerritoryId,
            payload.attackLosses,
            payload.attackerId,
          );
        if (payload.defenceLosses > 0)
          explode(
            payload.defendingTerritoryId,
            payload.defenceLosses,
            payload.defenderId,
          );
        startAnimationLoop();
      }, delay);
    }
    socket.on('game:attacked', onAttacked);
    return () => {
      socket.off('game:attacked', onAttacked);
    };
  }, []);

  useEffect(() => {
    const arrowActive =
      (turnPhase === 'fortify' &&
        fortifyStartTerritoryId !== null &&
        fortifyEndTerritoryId !== null) ||
      (turnPhase === 'attack' &&
        attackStartTerritoryId !== null &&
        attackEndTerritoryId !== null);
    setContinuousAnimation(arrowActive);
    if (arrowActive) startAnimationLoop();
    return () => setContinuousAnimation(false);
  }, [
    turnPhase,
    fortifyStartTerritoryId,
    fortifyEndTerritoryId,
    attackStartTerritoryId,
    attackEndTerritoryId,
  ]);

  useEffect(() => {
    function onSelected() {
      playSound('select');
    }
    socket.on('game:selected', onSelected);
    return () => {
      socket.off('game:selected', onSelected);
    };
  }, []);

  const deployPanelOpen =
    turnPhase === 'deploy' && isMyTurn && selectedTerritoryId !== null;
  const fortifyPanelOpen =
    turnPhase === 'fortify' && isMyTurn && fortifyEndTerritoryId !== null;
  const attackRevealing = attackDiceRoll !== null && !attackDiceSettled;
  const attackDiceOnly =
    attackDiceSettled &&
    attackEndTerritoryId === null &&
    attackDiceRoll !== null;
  const attackShowPendingConquest = attackPendingConquest && attackDiceSettled;
  const attackPanelOpen =
    turnPhase === 'attack' &&
    isMyTurn &&
    (attackRevealing ||
      (attackEndTerritoryId !== null &&
        (attackPendingConquest || attackWinProbabilities !== null)) ||
      attackDiceOnly);

  if (!attackPanelOpen && attackDiceRoll !== null) {
    setAttackDiceRoll(null);
    setAttackDiceSettled(true);
    setAttackPreRevealSnapshot(null);
  }

  const submitDeploy = useCallback(() => {
    if (selectedTerritoryId === null) return;
    socket.emit(
      'game:deploy',
      { territoryId: selectedTerritoryId, troops: deployTroops },
      (res: Ack) => {
        if (res.ok) setGame(res.game);
      },
    );
  }, [selectedTerritoryId, deployTroops, setGame]);

  function isInteractable(t: Territory): boolean {
    if (!isMyTurn) return false;
    if (turnPhase === 'deploy') return ownerById.get(t.id)?.ownerId === selfId;
    if (turnPhase === 'fortify') {
      if (fortifyStartTerritoryId === null)
        return fortifyStartCandidates.has(t.id);
      if (fortifyEndTerritoryId === null) return fortifyEndCandidates.has(t.id);
      return false;
    }
    if (turnPhase === 'attack') {
      if (attackPendingConquest) return false;
      if (attackStartTerritoryId === null)
        return attackStartCandidates.has(t.id);
      if (attackEndTerritoryId === null) return attackEndCandidates.has(t.id);
      return false;
    }
    return true;
  }

  useEffect(() => {
    function onResize() {
      setSize({ w: window.innerWidth, h: window.innerHeight });
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (
          isMyTurn &&
          turnPhase === 'fortify' &&
          fortifyStartTerritoryId !== null
        ) {
          cancelFortify();
          return;
        }
        if (
          isMyTurn &&
          turnPhase === 'attack' &&
          attackStartTerritoryId !== null &&
          !attackPendingConquest
        ) {
          cancelAttack();
          return;
        }
        if (isMyTurn && turnPhase === 'attack' && attackDiceOnly) {
          setAttackDiceRoll(null);
          return;
        }
        if (isMyTurn && selectedTerritoryId !== null) {
          selectTerritory(null);
          return;
        }
        setPanelCollapsed(true);
        setChatOpen(false);
        return;
      }
      if (e.key === 'Enter' && deployPanelOpen) {
        if (!isTypingTarget(e.target) || e.target === deployInputRef.current) {
          e.preventDefault();
          submitDeploy();
          return;
        }
      }
      if (e.key === 'Enter' && fortifyPanelOpen) {
        if (!isTypingTarget(e.target) || e.target === fortifyInputRef.current) {
          e.preventDefault();
          submitFortify();
          return;
        }
      }
      if (e.key === 'Enter' && attackPanelOpen && attackShowPendingConquest) {
        if (
          !isTypingTarget(e.target) ||
          e.target === attackMoveInputRef.current
        ) {
          e.preventDefault();
          submitAttackMove();
          return;
        }
      }
      if (
        e.key === 'Enter' &&
        attackPanelOpen &&
        !attackShowPendingConquest &&
        !attackDiceOnly &&
        !attackRevealing
      ) {
        if (!isTypingTarget(e.target) || e.target === blitzInputRef.current) {
          e.preventDefault();
          submitAttack();
          return;
        }
      }
      if (
        attackPanelOpen &&
        !attackShowPendingConquest &&
        !attackDiceOnly &&
        (e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
        e.target === blitzInputRef.current
      ) {
        e.preventDefault();
        const delta = e.key === 'ArrowUp' ? 1 : -1;
        setAttackDiceRoll(null);
        setAttackSelectedType('blitz');
        setAttackBlitzTroops((prev) =>
          Math.min(maxBlitzTroops, Math.max(1, prev + delta)),
        );
        return;
      }
      if (
        attackPanelOpen &&
        !attackShowPendingConquest &&
        !attackDiceOnly &&
        !isTypingTarget(e.target) &&
        (e.key === 'ArrowUp' ||
          e.key === 'ArrowDown' ||
          e.key === 'ArrowLeft' ||
          e.key === 'ArrowRight')
      ) {
        e.preventDefault();
        const direction =
          e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
        cycleAttackOption(direction);
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (e.key === 'Tab') {
        e.preventDefault();
        setPanelCollapsed((prev) => !prev);
      } else if (e.key.toLowerCase() === 't') {
        setChatOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    isMyTurn,
    turnPhase,
    selectedTerritoryId,
    selectTerritory,
    setChatOpen,
    deployPanelOpen,
    submitDeploy,
    fortifyStartTerritoryId,
    cancelFortify,
    fortifyPanelOpen,
    submitFortify,
    attackStartTerritoryId,
    attackPendingConquest,
    attackShowPendingConquest,
    attackDiceOnly,
    attackRevealing,
    cancelAttack,
    attackPanelOpen,
    submitAttack,
    submitAttackMove,
    maxBlitzTroops,
    cycleAttackOption,
  ]);

  function getImageDims(): { w: number; h: number } {
    return imgDims;
  }

  function getScales(canvasW: number, canvasH: number, zoom: number) {
    const { w: imgW, h: imgH } = getImageDims();
    return computeScales(canvasW, canvasH, zoom, imgW, imgH);
  }

  function getClampedOffset(
    canvasW: number,
    canvasH: number,
    zoom: number,
    x: number,
    y: number,
  ) {
    const { w: imgW, h: imgH } = getImageDims();
    return computeClampedOffset(canvasW, canvasH, zoom, imgW, imgH, x, y);
  }

  function getTerritoryScreenPos(t: Territory): Point {
    const { scaleX, scaleY } = getScales(size.w, size.h, transform.zoom);
    const { x: offsetX, y: offsetY } = getClampedOffset(
      size.w,
      size.h,
      transform.zoom,
      transform.offsetX,
      transform.offsetY,
    );
    return { x: t.x * scaleX + offsetX, y: t.y * scaleY + offsetY };
  }

  useEffect(() => {
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      if (deployPanelOpen) {
        const delta = e.deltaY < 0 ? 1 : -1;
        setDeployTroops((prev) =>
          Math.min(troopsToDeploy, Math.max(1, prev + delta)),
        );
        return;
      }
      if (fortifyPanelOpen) {
        const delta = e.deltaY < 0 ? 1 : -1;
        setFortifyTroops((prev) =>
          Math.min(fortifyMaxTroops, Math.max(1, prev + delta)),
        );
        return;
      }
      if (attackPanelOpen && attackShowPendingConquest) {
        const delta = e.deltaY < 0 ? 1 : -1;
        setAttackMoveTroops((prev) =>
          Math.min(
            attackMoveMaxTroops,
            Math.max(attackMoveMinTroops, prev + delta),
          ),
        );
        return;
      }
      if (attackPanelOpen && !attackShowPendingConquest && !attackDiceOnly) {
        cycleAttackOption(e.deltaY < 0 ? -1 : 1);
        return;
      }
      if (attackPanelOpen) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const canvasW = canvas.clientWidth;
      const canvasH = canvas.clientHeight;
      const { w: imgW, h: imgH } = imgDims;
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      setTransform((prev) => {
        const oldScaleX = (canvasW / imgW) * prev.zoom;
        const oldScaleY = (canvasH / imgH) * prev.zoom;
        const worldX = (pos.x - prev.offsetX) / oldScaleX;
        const worldY = (pos.y - prev.offsetY) / oldScaleY;
        const newZoom = clamp(prev.zoom * factor, MIN_ZOOM, MAX_ZOOM);
        const newScaleX = (canvasW / imgW) * newZoom;
        const newScaleY = (canvasH / imgH) * newZoom;
        const { x, y } = clampOffset(
          canvasW,
          canvasH,
          newScaleX,
          newScaleY,
          imgW,
          imgH,
          pos.x - worldX * newScaleX,
          pos.y - worldY * newScaleY,
        );
        return { zoom: newZoom, offsetX: x, offsetY: y };
      });
    }
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [
    deployPanelOpen,
    troopsToDeploy,
    imgDims,
    fortifyPanelOpen,
    fortifyMaxTroops,
    attackPanelOpen,
    attackShowPendingConquest,
    attackDiceOnly,
    cycleAttackOption,
    attackMoveMinTroops,
    attackMoveMaxTroops,
  ]);

  function nodeState(
    id: number,
  ): 'normal' | 'selectable' | 'hovered' | 'selected' {
    if (turnPhase === 'fortify') {
      if (id === fortifyStartTerritoryId || id === fortifyEndTerritoryId)
        return 'selected';
      if (id === hoveredId) return 'hovered';
      if (fortifyStartTerritoryId === null && fortifyStartCandidates.has(id))
        return 'selectable';
      if (
        fortifyStartTerritoryId !== null &&
        fortifyEndTerritoryId === null &&
        fortifyEndCandidates.has(id)
      )
        return 'selectable';
      return 'normal';
    }
    if (turnPhase === 'attack') {
      if (id === attackStartTerritoryId || id === attackEndTerritoryId)
        return 'selected';
      if (id === hoveredId) return 'hovered';
      if (
        attackStartTerritoryId !== null &&
        attackEndTerritoryId === null &&
        attackEndCandidates.has(id)
      )
        return 'selectable';
      return 'normal';
    }
    if (id === selectedTerritoryId) return 'selected';
    if (id === hoveredId) return 'hovered';
    if (turnPhase !== 'deploy' && selectedTerritoryId !== null) {
      const selected = territories.find((t) => t.id === selectedTerritoryId);
      if (selected?.neighbors.includes(id)) return 'selectable';
    }
    return 'normal';
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#212529';
    ctx.fillRect(0, 0, size.w, size.h);

    const { zoom } = transform;
    const { imgW, imgH, scaleX, scaleY } = getScales(size.w, size.h, zoom);
    const { x: offsetX, y: offsetY } = getClampedOffset(
      size.w,
      size.h,
      zoom,
      transform.offsetX,
      transform.offsetY,
    );

    if (imageRef.current) {
      ctx.drawImage(
        imageRef.current,
        offsetX,
        offsetY,
        imgW * scaleX,
        imgH * scaleY,
      );
    }

    const toScreen = (p: Point): Point => ({
      x: p.x * scaleX + offsetX,
      y: p.y * scaleY + offsetY,
    });

    drawAnimations(ctx, toScreen, VERTEX_RADIUS * zoom);

    if (fortifyPath.length > 1) {
      const territoryById = new Map(territories.map((t) => [t.id, t]));
      const worldPath = fortifyPath
        .map((id) => territoryById.get(id))
        .filter((t): t is Territory => !!t);
      if (worldPath.length === fortifyPath.length) {
        const segments = buildWrappedPathSegments(
          worldPath,
          toScreen,
          imgW,
          imgH,
        );
        drawFortifyPath(ctx, segments);
      }
    }

    if (attackStartTerritoryId !== null && attackEndTerritoryId !== null) {
      const territoryById = new Map(territories.map((t) => [t.id, t]));
      const start = territoryById.get(attackStartTerritoryId);
      const end = territoryById.get(attackEndTerritoryId);
      if (start && end) {
        const segments = buildWrappedPathSegments(
          [start, end],
          toScreen,
          imgW,
          imgH,
        );
        drawFortifyPath(ctx, segments);
      }
    }

    const colorByPlayerId = new Map(players.map((pl) => [pl.id, pl.color]));

    for (const t of territories) {
      const p = toScreen(t);
      const style = STATE_STYLE[nodeState(t.id)];
      const owner = ownerById.get(t.id);
      const fillColor = owner
        ? playerColor(colorByPlayerId.get(owner.ownerId) ?? 0)
        : continentColor(t.continentId);

      ctx.beginPath();
      ctx.arc(p.x, p.y, VERTEX_RADIUS * zoom, 0, Math.PI * 2);
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = style.width * zoom;
      ctx.stroke();

      if (owner) {
        const troops =
          isMyTurn && attackPendingConquest && t.id === attackEndTerritoryId
            ? attackMoveTroops
            : isMyTurn &&
                attackPendingConquest &&
                t.id === attackStartTerritoryId
              ? owner.troops - attackMoveTroops
              : !isMyTurn &&
                  attackPendingConquest &&
                  t.id === attackEndTerritoryId
                ? (attackConquestMinTroops ?? owner.troops)
                : (frozenTroopsRef.current.get(t.id) ?? owner.troops);
        ctx.fillStyle = contrastTextColor(fillColor);
        ctx.font = `bold ${VERTEX_RADIUS * zoom}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        const text = String(troops);
        const metrics = ctx.measureText(text);
        const baselineY =
          p.y +
          (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) /
            2;
        ctx.fillText(text, p.x, baselineY);
      }
    }
  });

  function getPos(e: { clientX: number; clientY: number }): Point {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function hitVertex(pos: Point): Territory | null {
    const canvas = canvasRef.current!;
    const { scaleX, scaleY } = getScales(
      canvas.clientWidth,
      canvas.clientHeight,
      transform.zoom,
    );
    const { x: offsetX, y: offsetY } = getClampedOffset(
      canvas.clientWidth,
      canvas.clientHeight,
      transform.zoom,
      transform.offsetX,
      transform.offsetY,
    );
    for (let i = territories.length - 1; i >= 0; i--) {
      const t = territories[i];
      const d = Math.hypot(
        pos.x - (t.x * scaleX + offsetX),
        pos.y - (t.y * scaleY + offsetY),
      );
      if (d <= VERTEX_RADIUS * transform.zoom + HIT_TOLERANCE) return t;
    }
    return null;
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    const pos = getPos(e);
    const canvas = canvasRef.current!;
    const { x, y } = getClampedOffset(
      canvas.clientWidth,
      canvas.clientHeight,
      transform.zoom,
      transform.offsetX,
      transform.offsetY,
    );
    dragRef.current = { startPos: pos, startTransform: { x, y }, moved: false };
  }

  function handleMouseMove(e: React.MouseEvent) {
    const drag = dragRef.current;
    const pos = getPos(e);
    if (!drag) {
      const vertex = hitVertex(pos);
      setHoveredId(vertex && isInteractable(vertex) ? vertex.id : null);
      return;
    }
    const dx = pos.x - drag.startPos.x;
    const dy = pos.y - drag.startPos.y;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD) drag.moved = true;
    if (drag.moved) {
      const canvas = canvasRef.current!;
      const { imgW, imgH, scaleX, scaleY } = getScales(
        canvas.clientWidth,
        canvas.clientHeight,
        transform.zoom,
      );
      const { x, y } = clampOffset(
        canvas.clientWidth,
        canvas.clientHeight,
        scaleX,
        scaleY,
        imgW,
        imgH,
        drag.startTransform.x + dx,
        drag.startTransform.y + dy,
      );
      setTransform((t) => ({ ...t, offsetX: x, offsetY: y }));
      setHoveredId(null);
    }
  }

  function handleMouseUp(e: React.MouseEvent) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.moved || !isMyTurn) return;
    const pos = getPos(e);
    const vertex = hitVertex(pos);

    if (turnPhase === 'fortify') {
      if (fortifyEndTerritoryId !== null) {
        cancelFortify();
        return;
      }
      if (!vertex || !isInteractable(vertex)) {
        if (fortifyStartTerritoryId !== null) cancelFortify();
        return;
      }
      if (fortifyStartTerritoryId === null) {
        selectFortifyStart(vertex.id);
      } else {
        selectFortifyEnd(vertex.id);
      }
      return;
    }

    if (turnPhase === 'attack') {
      if (attackPendingConquest) return;
      if (attackEndTerritoryId !== null) {
        cancelAttack();
        return;
      }
      if (!vertex || !isInteractable(vertex)) {
        if (attackStartTerritoryId !== null) {
          cancelAttack();
        } else if (attackDiceRoll !== null) {
          setAttackDiceRoll(null);
        }
        return;
      }
      if (attackStartTerritoryId === null) {
        selectAttackStart(vertex.id);
      } else {
        selectAttackEnd(vertex.id);
      }
      return;
    }

    if (!vertex || !isInteractable(vertex)) {
      if (selectedTerritoryId !== null) selectTerritory(null);
      return;
    }
    const newSelectedId = selectedTerritoryId === vertex.id ? null : vertex.id;
    if (newSelectedId !== null && turnPhase === 'deploy') setToasts([]);
    selectTerritory(newSelectedId);
  }

  function handleMouseLeave() {
    dragRef.current = null;
    setHoveredId(null);
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    if (!isMyTurn) return;
    if (turnPhase === 'fortify') {
      if (fortifyStartTerritoryId !== null) cancelFortify();
      return;
    }
    if (turnPhase === 'attack') {
      if (attackPendingConquest) return;
      if (attackStartTerritoryId !== null) {
        cancelAttack();
      } else if (attackDiceRoll !== null) {
        setAttackDiceRoll(null);
      }
      return;
    }
    if (selectedTerritoryId !== null) selectTerritory(null);
  }

  const zoomedRadius = VERTEX_RADIUS * transform.zoom;

  const selectedTerritory =
    selectedTerritoryId !== null
      ? territories.find((t) => t.id === selectedTerritoryId)
      : undefined;
  const selectedScreenPos = selectedTerritory
    ? getTerritoryScreenPos(selectedTerritory)
    : null;
  const deployPanelStyle: React.CSSProperties | undefined = selectedScreenPos
    ? {
        position: 'absolute',
        ...getAnchoredPanelPosition(
          selectedScreenPos,
          zoomedRadius,
          TROOP_PANEL_WIDTH,
          TROOP_PANEL_HEIGHT,
          size.w,
          size.h,
          TROOP_PANEL_GAP,
          SCREEN_EDGE_MARGIN,
          TURN_PANEL_RESERVED_HEIGHT,
        ),
      }
    : undefined;

  const fortifyEndTerritory =
    fortifyEndTerritoryId !== null
      ? territories.find((t) => t.id === fortifyEndTerritoryId)
      : undefined;
  const fortifyScreenPos = fortifyEndTerritory
    ? getTerritoryScreenPos(fortifyEndTerritory)
    : null;
  const fortifyPanelStyle: React.CSSProperties | undefined = fortifyScreenPos
    ? {
        position: 'absolute',
        ...getAnchoredPanelPosition(
          fortifyScreenPos,
          zoomedRadius,
          TROOP_PANEL_WIDTH,
          TROOP_PANEL_HEIGHT,
          size.w,
          size.h,
          TROOP_PANEL_GAP,
          SCREEN_EDGE_MARGIN,
          TURN_PANEL_RESERVED_HEIGHT,
        ),
      }
    : undefined;

  const attackAnchorTerritoryId =
    attackEndTerritoryId ?? attackDiceRoll?.territoryId ?? null;
  const attackEndTerritory =
    attackAnchorTerritoryId !== null
      ? territories.find((t) => t.id === attackAnchorTerritoryId)
      : undefined;
  const attackScreenPos = attackEndTerritory
    ? getTerritoryScreenPos(attackEndTerritory)
    : null;
  const attackPanelStyle: React.CSSProperties | undefined = attackScreenPos
    ? {
        position: 'absolute',
        ...getAnchoredPanelPosition(
          attackScreenPos,
          zoomedRadius,
          ATTACK_PANEL_WIDTH,
          ATTACK_PANEL_HEIGHT,
          size.w,
          size.h,
          TROOP_PANEL_GAP,
          SCREEN_EDGE_MARGIN,
          TURN_PANEL_RESERVED_HEIGHT,
        ),
      }
    : undefined;

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

  return (
    <div className="position-relative">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
        style={{
          display: 'block',
          width: size.w,
          height: size.h,
          cursor: hoveredId !== null ? 'pointer' : 'default',
        }}
      />
      <PlayersPanel
        players={players}
        spectators={spectators}
        isTeamDeathmatch={isTeamDeathmatch}
        selfId={selfId}
        turnPlayerId={currentTurnPlayer?.id ?? null}
        collapsed={panelCollapsed}
        setCollapsed={setPanelCollapsed}
        navigate={navigate}
      />
      {currentTurnPlayer && (
        <>
          <TurnProgressBar
            turnStartedAt={turnStartedAt}
            turnDuration={turnDuration}
            color={playerColor(currentTurnPlayer.color)}
          />
          <TurnPanel
            turnPhase={turnPhase}
            currentPlayerName={currentTurnPlayer.name}
            color={playerColor(currentTurnPlayer.color)}
            isMyTurn={isMyTurn}
            troopsToDeploy={troopsToDeploy}
            setGame={setGame}
          />
          {deployPanelOpen && deployPanelStyle && (
            <TroopPanel
              label="Deploy troops:"
              buttonLabel="Deploy"
              troops={deployTroops}
              maxTroops={troopsToDeploy}
              inputRef={deployInputRef}
              onChange={setDeployTroops}
              onConfirm={submitDeploy}
              style={deployPanelStyle}
            />
          )}
          {fortifyPanelOpen && fortifyPanelStyle && (
            <TroopPanel
              label="Move troops:"
              buttonLabel="Fortify"
              troops={fortifyTroops}
              maxTroops={fortifyMaxTroops}
              inputRef={fortifyInputRef}
              onChange={setFortifyTroops}
              onConfirm={submitFortify}
              style={fortifyPanelStyle}
            />
          )}
          {attackPanelOpen && attackPanelStyle && (
            <AttackPanel
              blitzWinProbabilities={attackDisplay.blitzWinProbabilities}
              maxBlitzTroops={attackDisplay.maxBlitzTroops}
              selectedType={attackDisplay.selectedType}
              regularTroops={attackDisplay.regularTroops}
              blitzTroops={attackDisplay.blitzTroops}
              blitzInputRef={blitzInputRef}
              diceRoll={attackDiceRoll}
              onSelectRegular={(troops) => {
                setAttackDiceRoll(null);
                setAttackSelectedType('regular');
                setAttackRegularTroops(troops);
              }}
              onSelectBlitz={() => {
                setAttackDiceRoll(null);
                setAttackSelectedType('blitz');
              }}
              onBlitzTroopsChange={(troops) => {
                setAttackDiceRoll(null);
                setAttackBlitzTroops(troops);
              }}
              onBlitzTroopsWheel={(delta) => {
                setAttackDiceRoll(null);
                setAttackSelectedType('blitz');
                setAttackBlitzTroops((prev) =>
                  Math.min(maxBlitzTroops, Math.max(1, prev + delta)),
                );
              }}
              onConfirm={submitAttack}
              revealing={attackRevealing}
              diceOnly={attackDiceOnly}
              pendingConquest={attackShowPendingConquest}
              moveTroops={attackMoveTroops}
              moveMinTroops={attackMoveMinTroops}
              moveMaxTroops={attackMoveMaxTroops}
              moveInputRef={attackMoveInputRef}
              onMoveTroopsChange={setAttackMoveTroops}
              onConfirmMove={submitAttackMove}
              style={attackPanelStyle}
            />
          )}
        </>
      )}
      <ToastContainer
        position="top-center"
        className="position-fixed p-3"
        style={{ zIndex: 3 }}
      >
        {toasts.map((t) => (
          <Toast
            key={t.id}
            onClose={() =>
              setToasts((prev) => prev.filter((x) => x.id !== t.id))
            }
            autohide
            delay={5000}
          >
            <Toast.Body>{t.message}</Toast.Body>
          </Toast>
        ))}
      </ToastContainer>
    </div>
  );
}

export default GameMap;
