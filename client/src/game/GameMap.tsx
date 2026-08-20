import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button, Toast, ToastContainer } from 'react-bootstrap';
import { useWhiteIcon } from '../common/icon';
import { continentColor, contrastTextColor, playerColor } from '../lib/palette';
import { socket } from '../lib/socket';
import { playSound } from '../lib/sounds';
import type {
  Ack,
  Card,
  CardSymbol,
  GameState,
  TurnDuration,
  TurnPhase,
} from '../lib/types';
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
import { comboKey, diffNewCards, enumerateCombos } from './cards';
import CardsPanel, { CardFace } from './CardsPanel';
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
  convexHull,
  getAnchoredPanelPosition,
} from './mapMath';
import PlayersPanel from './PlayersPanel';
import TroopPanel from './TroopPanel';
import TurnPanel from './TurnPanel';
import TurnProgressBar from './TurnProgressBar';

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
  nextSetBaseValues: GameState['nextSetBaseValues'];
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

function normalizeAngle(angle: number): number {
  const twoPi = Math.PI * 2;
  return ((angle % twoPi) + twoPi) % twoPi;
}

// Traces the true offset outline of a convex polygon (its Minkowski sum with
// a disc of radius `pad`): each edge pushed outward along its own normal by
// exactly `pad`, with the gaps between edges filled by an arc of radius
// `pad` centered on the original vertex. Unlike padding each vertex outward
// from the polygon's centroid, this keeps every point on the line exactly
// `pad` away from the nearest original vertex/edge — so corners always sit
// the same distance from the territory that produced them, however
// irregular the hull's shape.
function drawConvexOffsetPath(
  ctx: CanvasRenderingContext2D,
  hull: Point[],
  pad: number,
) {
  const n = hull.length;
  // Outward normal per edge, found by flipping the perpendicular if it
  // points toward the centroid — convex, so the true outward normal always
  // points away from it, regardless of the hull's winding order.
  const centroid = {
    x: hull.reduce((s, p) => s + p.x, 0) / n,
    y: hull.reduce((s, p) => s + p.y, 0) / n,
  };
  const offsetEdges = hull.map((a, i) => {
    const b = hull[(i + 1) % n];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len = Math.hypot(ex, ey) || 1;
    let nx = -ey / len;
    let ny = ex / len;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if ((mid.x - centroid.x) * nx + (mid.y - centroid.y) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    return {
      a: { x: a.x + nx * pad, y: a.y + ny * pad },
      b: { x: b.x + nx * pad, y: b.y + ny * pad },
    };
  });

  // Whether arcs should sweep clockwise or counter-clockwise is constant
  // for every vertex of a convex polygon — derive it once, from the first
  // corner, by picking whichever direction is the short way round.
  const arcAngles = (i: number) => {
    const vertex = hull[i];
    const from = offsetEdges[(i - 1 + n) % n].b;
    const to = offsetEdges[i].a;
    return {
      start: Math.atan2(from.y - vertex.y, from.x - vertex.x),
      end: Math.atan2(to.y - vertex.y, to.x - vertex.x),
    };
  };
  const firstAngles = arcAngles(0);
  const anticlockwise =
    normalizeAngle(firstAngles.end - firstAngles.start) > Math.PI;

  ctx.moveTo(offsetEdges[n - 1].b.x, offsetEdges[n - 1].b.y);
  for (let i = 0; i < n; i++) {
    const { start, end } = arcAngles(i);
    ctx.arc(hull[i].x, hull[i].y, pad, start, end, anticlockwise);
    ctx.lineTo(offsetEdges[i].b.x, offsetEdges[i].b.y);
  }
  ctx.closePath();
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
// Gap below the settings button (measured at runtime, see below) that the
// Cards/Bonuses buttons are offset by — matches the gap between Cards and
// Bonuses themselves, so all three read as evenly spaced regardless of the
// settings button's actual rendered height.
const TOP_BUTTON_GAP = 16;
const DEFAULT_CARDS_BUTTONS_TOP = 63;

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
  nextSetBaseValues,
  setGame,
  setChatOpen,
  navigate,
}: Props) {
  const whiteCardsIcon = useWhiteIcon('/icons/cards.svg');
  const whiteBonusIcon = useWhiteIcon('/icons/bonus.svg');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<DragState>(null);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [bonuses, setBonuses] = useState<number[]>([]);
  const [hand, setHand] = useState<Card[]>([]);
  const handRef = useRef<Card[]>([]);
  const [awardedCards, setAwardedCards] = useState<
    { id: number; card: Card }[]
  >([]);
  const awardIdRef = useRef(0);
  const [selectedComboKey, setSelectedComboKey] = useState<string | null>(null);
  const [openPanel, setOpenPanel] = useState<'cards' | 'bonuses' | null>(null);
  const cardsOpen = openPanel === 'cards';
  const bonusesOpen = openPanel === 'bonuses';
  const [cardsButtonsTop, setCardsButtonsTop] = useState(
    DEFAULT_CARDS_BUTTONS_TOP,
  );
  const cardsPanelRef = useRef<HTMLDivElement>(null);
  const cardsButtonRef = useRef<HTMLButtonElement>(null);
  const bonusesButtonRef = useRef<HTMLButtonElement>(null);
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
  const autoAdvanceKeyRef = useRef<string | null>(null);
  const cardImagesRef = useRef<Record<CardSymbol, HTMLImageElement>>({
    soldier: new Image(),
    humvee: new Image(),
    tank: new Image(),
  });

  useEffect(() => {
    for (const symbol of ['soldier', 'humvee', 'tank'] as const) {
      cardImagesRef.current[symbol].src = `/images/${symbol}.svg`;
    }
  }, []);

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
    loadGameMap(mapName).then(({ territories, bonuses, imageSrc }) => {
      setTerritories(territories);
      setBonuses(bonuses);
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
  const ownedTerritoryIds = new Set(
    ownership.filter((o) => o.ownerId === selfId).map((o) => o.id),
  );
  const cardByTerritoryId = new Map(
    hand
      .filter((c) => c.territoryId !== null)
      .map((c) => [c.territoryId as number, c]),
  );
  const combos = enumerateCombos(hand, nextSetBaseValues, ownedTerritoryIds);
  const selectedCombo =
    combos.find((c) => comboKey(c) === selectedComboKey) ?? combos[0];
  const hasSetToPlay = combos.length > 0;
  const mustPlaySet = hand.length >= 5;

  const playCardSet = useCallback(
    (selection: (number | null)[]) => {
      socket.emit('game:playCardSet', { cards: selection }, (res: Ack) => {
        if (res.ok) setGame(res.game);
      });
    },
    [setGame],
  );
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
      if (!res.ok) return;
      setGame(res.game);
      if (fortifyStartTerritoryId !== null)
        frozenTroopsRef.current.delete(fortifyStartTerritoryId);
      if (fortifyEndTerritoryId !== null)
        frozenTroopsRef.current.delete(fortifyEndTerritoryId);
    });
  }, [fortifyTroops, fortifyStartTerritoryId, fortifyEndTerritoryId, setGame]);

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
      const hasDiceRoll =
        res.attackerDice.length > 0 && attackEndTerritoryId !== null;
      setGame(
        hasDiceRoll && res.game.state === 'ended'
          ? { ...res.game, state: 'playing' }
          : res.game,
      );
      if (attackStartTerritoryId !== null)
        frozenTroopsRef.current.delete(attackStartTerritoryId);
      if (attackEndTerritoryId !== null)
        frozenTroopsRef.current.delete(attackEndTerritoryId);

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

  // Mirrors the server's own auto-skip: if the current player can't attack
  // (or, in fortify, can't fortify) at all, move on without waiting for
  // them to notice and click "Next Phase" — independent of the server
  // having already done the same, in case it hasn't (yet).
  useEffect(() => {
    if (!isMyTurn) return;
    const noAttackPossible =
      turnPhase === 'attack' &&
      !attackPendingConquest &&
      attackStartCandidates.size === 0;
    const noFortifyPossible =
      turnPhase === 'fortify' && fortifyStartCandidates.size === 0;
    if (!noAttackPossible && !noFortifyPossible) return;

    const key = `${turnNumber}-${turnPlayerIndex}-${turnPhase}`;
    if (autoAdvanceKeyRef.current === key) return;
    autoAdvanceKeyRef.current = key;

    socket.emit('game:nextPhase', (res: Ack) => {
      if (res.ok) setGame(res.game);
    });
  });

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
      ...(isMyTurn && hasSetToPlay
        ? [
            {
              id: Date.now() + 1,
              message: 'You have a card set available to play!',
            },
          ]
        : []),
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
    function animateDeploy({
      territoryId,
      troops,
    }: {
      territoryId: number;
      troops: number;
    }) {
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
    }
    function playTroopChangeEffect(
      sound: string,
      payload: { territoryId: number; troops: number },
    ) {
      playSound(sound);
      animateDeploy(payload);
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
    // The server force-completing an unattended deploy phase (troops
    // dropped randomly, then any 5+-card hand auto-played) can touch many
    // territories at once — one sound for the whole batch, one animation
    // per territory, rather than replaying the sound for each.
    function onDeployedMany(payload: {
      deposits: { territoryId: number; troops: number }[];
    }) {
      playSound('deploy');
      for (const deposit of payload.deposits) animateDeploy(deposit);
      startAnimationLoop();
    }
    socket.on('game:deployed', onDeployed);
    socket.on('game:fortified', onFortified);
    socket.on('game:attackMoved', onAttackMoved);
    socket.on('game:deployedMany', onDeployedMany);
    return () => {
      socket.off('game:deployed', onDeployed);
      socket.off('game:fortified', onFortified);
      socket.off('game:attackMoved', onAttackMoved);
      socket.off('game:deployedMany', onDeployedMany);
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

  useEffect(() => {
    let receivedFirstHand = false;
    function onCards(payload: { cards: Card[] }) {
      if (receivedFirstHand) {
        const added = diffNewCards(handRef.current, payload.cards);
        for (const card of added) {
          const id = ++awardIdRef.current;
          setAwardedCards((prev) => [...prev, { id, card }]);
          setTimeout(() => {
            setAwardedCards((prev) => prev.filter((a) => a.id !== id));
          }, 4000);
        }
      }
      receivedFirstHand = true;
      handRef.current = payload.cards;
      setHand(payload.cards);
    }
    socket.on('game:cards', onCards);
    return () => {
      socket.off('game:cards', onCards);
    };
  }, []);

  useEffect(() => {
    const settingsEl = document.getElementById('settings-toggle');
    if (!settingsEl) return;
    function measure() {
      setCardsButtonsTop(
        settingsEl!.getBoundingClientRect().bottom + TOP_BUTTON_GAP,
      );
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(settingsEl);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (openPanel === null) return;
    function handleOutside(e: MouseEvent) {
      const target = e.target as Node;
      // Either toggle button manages openPanel itself via its own onClick —
      // never fight it here, or clicking one to switch panels would get
      // undone by this handler closing the panel it just opened.
      if (cardsButtonRef.current?.contains(target)) return;
      if (bonusesButtonRef.current?.contains(target)) return;
      if (cardsPanelRef.current?.contains(target)) return;
      setOpenPanel(null);
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('contextmenu', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('contextmenu', handleOutside);
    };
  }, [openPanel]);

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
        if (!res.ok) return;
        setGame(res.game);
        frozenTroopsRef.current.delete(selectedTerritoryId);
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
        if (openPanel !== null) {
          setOpenPanel(null);
          return;
        }
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
    openPanel,
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

    const continentGroups = bonusesOpen
      ? (() => {
          const groups = new Map<number, Territory[]>();
          for (const t of territories) {
            const list = groups.get(t.continentId);
            if (list) list.push(t);
            else groups.set(t.continentId, [t]);
          }
          return groups;
        })()
      : null;

    if (continentGroups) {
      const hullPad = (VERTEX_RADIUS + 30) * zoom;
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 2.5 * zoom;
      ctx.lineJoin = 'round';
      ctx.setLineDash([6 * zoom, 5 * zoom]);
      for (const group of continentGroups.values()) {
        const screenPoints = group.map((t) => toScreen(t));
        if (screenPoints.length === 1) {
          ctx.beginPath();
          ctx.arc(
            screenPoints[0].x,
            screenPoints[0].y,
            hullPad,
            0,
            Math.PI * 2,
          );
          ctx.stroke();
          continue;
        }
        if (screenPoints.length === 2) {
          ctx.beginPath();
          ctx.lineCap = 'round';
          ctx.lineWidth = hullPad * 2;
          ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
          ctx.lineTo(screenPoints[1].x, screenPoints[1].y);
          ctx.stroke();
          ctx.lineWidth = 2.5 * zoom;
          ctx.lineCap = 'butt';
          continue;
        }
        const hull = convexHull(screenPoints);
        ctx.beginPath();
        drawConvexOffsetPath(ctx, hull, hullPad);
        ctx.stroke();
      }
      ctx.restore();
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

      const territoryCard = cardByTerritoryId.get(t.id);
      if (territoryCard) {
        const cardOwned = ownedTerritoryIds.has(t.id);

        const inSelectedCombo =
          cardsOpen &&
          (selectedCombo?.cards.some((c) => c.territoryId === t.id) ?? false);
        if (inSelectedCombo) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, (VERTEX_RADIUS + 6) * zoom, 0, Math.PI * 2);
          ctx.strokeStyle = '#0d6efd'; // Bootstrap's primary button blue
          ctx.lineWidth = 3 * zoom;
          ctx.stroke();
        }

        if (territoryCard.symbol && territoryCard.territoryId !== null) {
          const img = cardImagesRef.current[territoryCard.symbol];
          if (img.complete && img.naturalWidth > 0) {
            const iconSize = 16 * zoom;
            const textHeight = 11 * zoom;
            const badgePad = 4 * zoom;
            const badgeGap = 1 * zoom;
            const badgeW = iconSize + badgePad * 2;
            const badgeH = iconSize + badgeGap + textHeight + badgePad * 2;
            const dist = (VERTEX_RADIUS + 6) * zoom + badgeH / 2 + 4;
            const cx = p.x + dist * Math.SQRT1_2;
            const cy = p.y - dist * Math.SQRT1_2;

            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1 * zoom;
            ctx.beginPath();
            ctx.roundRect(
              cx - badgeW / 2,
              cy - badgeH / 2,
              badgeW,
              badgeH,
              4 * zoom,
            );
            ctx.fill();
            ctx.stroke();
            ctx.drawImage(
              img,
              cx - iconSize / 2,
              cy - badgeH / 2 + badgePad,
              iconSize,
              iconSize,
            );

            ctx.fillStyle = '#000000';
            ctx.font = `bold ${textHeight}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(
              `#${territoryCard.territoryId + 1}`,
              cx,
              cy + badgeH / 2 - badgePad * 0.6,
            );

            if (cardOwned) {
              const pillText = '+2';
              ctx.font = `bold ${10 * zoom}px sans-serif`;
              const pillWidth = ctx.measureText(pillText).width + 6 * zoom;
              const pillHeight = 12 * zoom;
              const pillX = cx + badgeW / 2;
              const pillY = cy - badgeH / 2;
              ctx.fillStyle = '#2ecc71';
              ctx.beginPath();
              ctx.roundRect(
                pillX - pillWidth / 2,
                pillY - pillHeight / 2,
                pillWidth,
                pillHeight,
                pillHeight / 2,
              );
              ctx.fill();
              ctx.fillStyle = '#ffffff';
              ctx.fillText(pillText, pillX, pillY + 3.5 * zoom);
            }
          }
        }
      }

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
                : deployPanelOpen && t.id === selectedTerritoryId
                  ? owner.troops + deployTroops
                  : fortifyPanelOpen && t.id === fortifyEndTerritoryId
                    ? owner.troops + fortifyTroops
                    : fortifyPanelOpen && t.id === fortifyStartTerritoryId
                      ? owner.troops - fortifyTroops
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

    if (continentGroups) {
      for (const [continentId, group] of continentGroups) {
        const screenPoints = group.map((t) => toScreen(t));
        const cx =
          screenPoints.reduce((s, p) => s + p.x, 0) / screenPoints.length;
        const cy =
          screenPoints.reduce((s, p) => s + p.y, 0) / screenPoints.length;
        const text = `+${bonuses[continentId] ?? 0}`;

        ctx.font = `bold ${34 * zoom}px sans-serif`;
        const metrics = ctx.measureText(text);
        const paddingX = 10 * zoom;
        const boxW = metrics.width + paddingX * 2;
        const boxH = 42 * zoom;
        const boxX = cx - boxW / 2;
        const boxY = cy - boxH / 2;

        ctx.fillStyle = 'rgba(20, 20, 20, 0.85)';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5 * zoom;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 10 * zoom);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, cx, cy + 1 * zoom);
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
      <div
        className="position-absolute start-0 ms-3 d-flex flex-column align-items-start gap-2"
        style={{ zIndex: 2, top: cardsButtonsTop }}
      >
        <div className="d-flex flex-column align-items-start gap-3">
          <Button
            ref={bonusesButtonRef}
            variant="secondary"
            size="sm"
            title="Bonuses"
            onClick={() =>
              setOpenPanel((p) => (p === 'bonuses' ? null : 'bonuses'))
            }
          >
            <img
              src={whiteBonusIcon ?? '/icons/bonus.svg'}
              width={16}
              height={16}
              alt="Continent Bonuses"
            />
          </Button>
          {!cardsOpen && (
            <Button
              ref={cardsButtonRef}
              variant="secondary"
              size="sm"
              className="position-relative"
              title="Cards"
              onClick={() => {
                setOpenPanel('cards');
                setAwardedCards([]);
              }}
            >
              <img
                src={whiteCardsIcon ?? '/icons/cards.svg'}
                width={16}
                height={16}
                alt="Cards"
              />
              {hand.length > 0 && (
                <Badge
                  bg={hasSetToPlay ? 'danger' : 'secondary'}
                  pill
                  className="position-absolute top-0 start-100 translate-middle"
                  style={{ fontSize: 10 }}
                >
                  {hand.length}
                  {hasSetToPlay && '!'}
                </Badge>
              )}
            </Button>
          )}
        </div>
        {awardedCards.length > 0 && (
          <div className="d-flex flex-column gap-2">
            {awardedCards.map(({ id, card }) => (
              <div
                key={id}
                className="bg-body bg-opacity-75 border rounded p-2 d-flex align-items-center gap-2"
              >
                <CardFace card={card} size={36} />
                <span className="small">New card!</span>
              </div>
            ))}
          </div>
        )}
        {cardsOpen && (
          <div ref={cardsPanelRef}>
            <CardsPanel
              hand={hand}
              ownedTerritoryIds={ownedTerritoryIds}
              combos={combos}
              selectedCombo={selectedCombo}
              onSelectCombo={(combo) => setSelectedComboKey(comboKey(combo))}
              canPlay={isMyTurn && turnPhase === 'deploy'}
              onPlaySet={playCardSet}
            />
          </div>
        )}
      </div>
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
            canLeaveDeploy={troopsToDeploy <= 0 && !mustPlaySet}
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
