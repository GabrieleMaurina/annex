import type { Dispatch, SetStateAction } from 'react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Badge, Button, Toast, ToastContainer } from 'react-bootstrap';
import { useWhiteIcon } from '../common/icon';
import { PANEL_BG_CLASS } from '../common/panelStyle';
import Tip from '../common/Tip';
import { contrastTextColor, playerColor } from '../lib/palette';
import { socket } from '../lib/socket';
import { playSound } from '../lib/sounds';
import type {
  Ack,
  Card,
  CardSymbol,
  EmojiAttackTarget,
  EmojiSentPayload,
  EmojiValue,
  Fortification,
  GameMode,
  GameState,
  Mission,
  ReplayAnimation,
  TurnDuration,
  TurnPhase,
} from '../lib/types';
import {
  areAnimationsDisabled,
  CARD_SET_FLASH_DURATION,
  DICE_ROLL_STEP_DURATION,
  DICE_ROLL_STEPS,
  drawAnimations,
  drawFortifyPath,
  getAnimationDuration,
  hasActiveAnimations,
  onAnimationsToggle,
  pruneAnimations,
  setContinuousAnimation,
  startAnimation,
} from './animations';
import { getAttackEndCandidates, getAttackStartCandidates } from './attack';
import AttackPanel, { type AttackType, type DiceRoll } from './AttackPanel';
import {
  comboKey,
  diffNewCards,
  enumerateCombos,
  type EvaluatedCombo,
} from './cards';
import CardsPanel, { CardFace } from './CardsPanel';
import {
  ATTACK_EMOJI,
  EMOJI_LABELS,
  EMOJI_PANEL_EDGE_OFFSET,
  EMOJI_POP_DURATION,
  EMOJI_TERRITORY_SIDE_GAP,
  emojiFlightDurations,
  EMOJIS,
  type EmojiPop,
} from './emoji';
import {
  getFortifyEndCandidates,
  getFortifyPath,
  getFortifyStartCandidates,
} from './fortify';
import LogsPanel from './LogsPanel';
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
import { useReplay } from './replay';
import ReplayPanel from './ReplayPanel';
import TroopPanel from './TroopPanel';
import TurnPanel from './TurnPanel';
import TurnProgressBar from './TurnProgressBar';
import type { LogEntry } from './useGameLogs';

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
  gameMode: GameMode;
  isTeamDeathmatch: boolean;
  isCapitals: boolean;
  mission: Mission | null;
  selfId: number | null;
  turnNumber: number;
  turnPlayerIndex: number;
  turnPhase: TurnPhase;
  turnDuration: TurnDuration;
  fortification: Fortification;
  troopsToDeploy: number;
  turnStartedAt: number;
  paused: boolean;
  hostId: number;
  onTogglePause: () => void;
  selectedTerritoryId: number | null;
  fortifyStartTerritoryId: number | null;
  fortifyEndTerritoryId: number | null;
  attackStartTerritoryId: number | null;
  attackEndTerritoryId: number | null;
  attackConquestMinTroops: number | null;
  nextSetBaseValues: GameState['nextSetBaseValues'];
  upcomingSetValues: GameState['upcomingSetValues'];
  gameEnded: boolean;
  showReplay: boolean;
  logs: LogEntry[];
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

function drawConvexOffsetPath(
  ctx: CanvasRenderingContext2D,
  hull: Point[],
  pad: number,
) {
  const n = hull.length;
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
const TOP_BUTTON_GAP = 16;
const DEFAULT_CARDS_BUTTONS_TOP = 63;
const PLACEMENT_PHASE_DURATION = 10;
const CAPITAL_PHASE_DURATION = 60;

const UNCLAIMED_TERRITORY_COLOR = '#6c757d';

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
  gameMode,
  isTeamDeathmatch,
  isCapitals,
  mission,
  selfId,
  turnNumber,
  turnPlayerIndex,
  turnPhase,
  turnDuration,
  fortification,
  troopsToDeploy,
  turnStartedAt,
  paused,
  hostId,
  onTogglePause,
  selectedTerritoryId,
  fortifyStartTerritoryId,
  fortifyEndTerritoryId,
  attackStartTerritoryId,
  attackEndTerritoryId,
  attackConquestMinTroops,
  nextSetBaseValues,
  upcomingSetValues,
  gameEnded,
  showReplay,
  logs,
  setGame,
  setChatOpen,
  navigate,
}: Props) {
  const whiteCardsIcon = useWhiteIcon('/icons/cards.svg');
  const whiteBonusIcon = useWhiteIcon('/icons/bonus.svg');
  const whiteLogsIcon = useWhiteIcon('/icons/logs.svg');
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
  const [cardSetFlash, setCardSetFlash] = useState<{
    id: number;
    cards: Card[];
  } | null>(null);
  const cardSetFlashIdRef = useRef(0);
  const [emojiPickerFor, setEmojiPickerFor] = useState<number | null>(null);
  const [pendingAttackEmoji, setPendingAttackEmoji] = useState<{
    targetPlayerId: number;
  } | null>(null);
  const [emojiPops, setEmojiPops] = useState<EmojiPop[]>([]);
  const emojiPopIdRef = useRef(0);
  const [emojiFlights, setEmojiFlights] = useState<
    {
      id: number;
      emoji: EmojiValue;
      from: Point;
      to: Point;
      totalDuration: number;
      travelPercent: number;
    }[]
  >([]);
  const emojiFlightIdRef = useRef(0);
  const emojiTimersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  const [selectedComboKey, setSelectedComboKey] = useState<string | null>(null);
  const [openPanel, setOpenPanel] = useState<
    'cards' | 'bonuses' | 'logs' | null
  >(null);
  const cardsOpen = openPanel === 'cards';
  const bonusesOpen = openPanel === 'bonuses';
  const logsOpen = openPanel === 'logs';
  const [cardsButtonsTop, setCardsButtonsTop] = useState(
    DEFAULT_CARDS_BUTTONS_TOP,
  );
  const cardsPanelRef = useRef<HTMLDivElement>(null);
  const cardsButtonRef = useRef<HTMLButtonElement>(null);
  const bonusesButtonRef = useRef<HTMLButtonElement>(null);
  const logsButtonRef = useRef<HTMLButtonElement>(null);
  const logsPanelRef = useRef<HTMLDivElement>(null);
  const buttonColumnRef = useRef<HTMLDivElement>(null);
  const [logsPanelTop, setLogsPanelTop] = useState(DEFAULT_CARDS_BUTTONS_TOP);
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
  const [capitalModeAnnounced, setCapitalModeAnnounced] = useState(false);
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
  const playersRef = useRef<GameState['players']>([]);
  const selfIdRef = useRef<number | null>(null);
  const getTerritoryScreenPosRef = useRef<(t: Territory) => Point>(() => ({
    x: 0,
    y: 0,
  }));
  const zoomRef = useRef(1);
  const rowRefs = useRef(new Map<number, HTMLTableRowElement>());
  const emojiPickerRef = useRef<HTMLDivElement>(null);
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
    return onAnimationsToggle(() => {
      if (!areAnimationsDisabled()) startAnimationLoop();
    });
  }, []);

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

  const colorForPlayer = useCallback((playerId: number | undefined): string => {
    if (playerId === undefined) return '#ffffff';
    const colorIndex = colorByPlayerIdRef.current.get(playerId);
    return colorIndex !== undefined ? playerColor(colorIndex) : '#ffffff';
  }, []);

  const animateDeploy = useCallback(
    (
      {
        territoryId,
        troops,
        playerId,
      }: {
        territoryId: number;
        troops: number;
        playerId?: number;
      },
      arrowPath?: { x: number; y: number }[],
    ) => {
      if (areAnimationsDisabled()) return;
      const territory = territoriesRef.current.find(
        (t) => t.id === territoryId,
      );
      const ownerId =
        playerId ?? ownerByIdRef.current.get(territoryId)?.ownerId;
      if (territory)
        startAnimation(
          'deploy',
          territory.x,
          territory.y,
          `+${troops}`,
          colorForPlayer(ownerId),
          arrowPath,
        );
      const currentTroops = ownerByIdRef.current.get(territoryId)?.troops;
      if (currentTroops !== undefined) {
        frozenTroopsRef.current.set(territoryId, currentTroops);
        setTimeout(() => {
          frozenTroopsRef.current.delete(territoryId);
        }, getAnimationDuration('deploy'));
      }
    },
    [colorForPlayer],
  );

  const explode = useCallback(
    (
      territoryId: number,
      losses: number,
      playerId: number,
      arrowPath?: { x: number; y: number }[],
    ) => {
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
        arrowPath,
      );
      const currentTroops = ownerByIdRef.current.get(territoryId)?.troops;
      if (currentTroops === undefined) return;
      frozenTroopsRef.current.set(territoryId, currentTroops);
      setTimeout(() => {
        frozenTroopsRef.current.delete(territoryId);
      }, getAnimationDuration('explosion'));
    },
    [colorForPlayer],
  );

  const territoryPoints = useCallback(
    (territoryIds: number[]): { x: number; y: number }[] =>
      territoryIds
        .map((id) => territoriesRef.current.find((t) => t.id === id))
        .filter((t): t is Territory => !!t)
        .map((t) => ({ x: t.x, y: t.y })),
    [],
  );

  const playFrameAnimation = useCallback(
    (animation: ReplayAnimation, partOfConquestPair: boolean) => {
      if (animation.type === 'deploy') {
        playSound('deploy');
        animateDeploy({
          territoryId: animation.territoryId,
          troops: animation.troops,
          playerId: animation.playerId,
        });
      } else if (animation.type === 'fortify') {
        playSound('fortify');
        let arrowPath: { x: number; y: number }[] | undefined;
        if (!partOfConquestPair) {
          const pathIds = getFortifyPath(
            territoriesRef.current,
            ownerByIdRef.current,
            animation.playerId,
            animation.fromTerritoryId,
            animation.toTerritoryId,
            fortification,
          );
          arrowPath = territoryPoints(
            pathIds.length > 1
              ? pathIds
              : [animation.fromTerritoryId, animation.toTerritoryId],
          );
        }
        animateDeploy(
          {
            territoryId: animation.toTerritoryId,
            troops: animation.troops,
            playerId: animation.playerId,
          },
          arrowPath,
        );
      } else {
        playSound('explode');
        const arrowPath = partOfConquestPair
          ? undefined
          : territoryPoints([
              animation.attackingTerritoryId,
              animation.defendingTerritoryId,
            ]);
        if (animation.defenceLosses > 0) {
          explode(
            animation.defendingTerritoryId,
            animation.defenceLosses,
            animation.defenderId,
            arrowPath,
          );
          if (animation.attackLosses > 0)
            explode(
              animation.attackingTerritoryId,
              animation.attackLosses,
              animation.attackerId,
            );
        } else if (animation.attackLosses > 0) {
          explode(
            animation.attackingTerritoryId,
            animation.attackLosses,
            animation.attackerId,
            arrowPath,
          );
        }
      }
      startAnimationLoop();
    },
    [animateDeploy, explode, territoryPoints, fortification],
  );

  const {
    index: replayIndex,
    totalFrames: replayTotalFrames,
    playing: replayPlaying,
    speed: replaySpeed,
    territories: replayTerritories,
    turnNumber: replayTurnNumber,
    turnPlayerId: replayTurnPlayerId,
    conquestArrow: replayConquestArrow,
    stepForward: replayStepForward,
    stepBackward: replayStepBackward,
    jumpToStart: replayJumpToStart,
    jumpToEnd: replayJumpToEnd,
    seek: replaySeek,
    togglePlay: replayTogglePlay,
    cycleSpeed: replayCycleSpeed,
  } = useReplay(showReplay, playFrameAnimation);

  const currentTurnPlayer = players[turnPlayerIndex];
  const isMyTurn = currentTurnPlayer?.id === selfId;
  const isCapitalById = new Map(ownership.map((o) => [o.id, o.isCapital]));
  const displayedOwnership = replayTerritories
    ? replayTerritories.map((t) => ({
        ...t,
        isCapital: isCapitalById.get(t.id) ?? false,
      }))
    : ownership;
  const ownerById = new Map(displayedOwnership.map((o) => [o.id, o]));
  const replayPlayer = players.find((p) => p.id === replayTurnPlayerId);
  const replayPlayerColor = replayPlayer
    ? playerColor(replayPlayer.color)
    : '#ffffff';
  const ownedTerritoryIds = new Set(
    ownership.filter((o) => o.ownerId === selfId).map((o) => o.id),
  );
  const cardByTerritoryId =
    gameEnded && !cardsOpen
      ? new Map<number, Card>()
      : new Map(
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
    (combo: EvaluatedCombo) => {
      const cards = combo.cards.map((c) => c.territoryId);
      socket.emit('game:playCardSet', { cards }, (res: Ack) => {
        if (!res.ok) return;
        setGame(res.game);
        setSelectedComboKey(null);
        setHand((prev) => {
          const next = [...prev];
          for (const card of combo.cards) {
            const index = next.indexOf(card);
            if (index !== -1) next.splice(index, 1);
          }
          return next;
        });
        if (hand.length - combo.cards.length < 5) setOpenPanel(null);
      });
    },
    [setGame, hand],
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
    playersRef.current = players;
    selfIdRef.current = selfId;
    getTerritoryScreenPosRef.current = getTerritoryScreenPos;
    zoomRef.current = transform.zoom;
  });

  const selectTerritory = useCallback(
    (territoryId: number | null) => {
      socket.emit('game:selectTerritory', { territoryId }, (res: Ack) => {
        if (res.ok) setGame(res.game);
      });
    },
    [setGame],
  );

  const selectCapital = useCallback(
    (territoryId: number) => {
      socket.emit('game:selectCapital', { territoryId }, (res: Ack) => {
        if (res.ok) setGame(res.game);
      });
    },
    [setGame],
  );

  const claimTerritory = useCallback(
    (territoryId: number) => {
      socket.emit('game:claimTerritory', { territoryId }, (res: Ack) => {
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

  const territoryClaimCandidates =
    turnPhase === 'territory' && isMyTurn
      ? new Set(
          territories.filter((t) => !ownerById.has(t.id)).map((t) => t.id),
        )
      : new Set<number>();
  const fortifyStartCandidates =
    turnPhase === 'fortify' && isMyTurn
      ? getFortifyStartCandidates(territories, ownerById, selfId, fortification)
      : new Set<number>();
  const fortifyEndCandidates =
    turnPhase === 'fortify' && isMyTurn && fortifyStartTerritoryId !== null
      ? getFortifyEndCandidates(
          territories,
          ownerById,
          selfId,
          fortifyStartTerritoryId,
          fortification,
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
          fortification,
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
    if (!isMyTurn || paused) return;
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
        message: `${currentTurnPlayer.name} received ${troopsToDeploy} troops at the start of their turn`,
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

  if (isCapitals && !capitalModeAnnounced && turnNumber >= 2) {
    setCapitalModeAnnounced(true);
    setToasts((prev) => [
      ...prev,
      { id: Date.now(), message: 'Capitals mode activated' },
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

  useEffect(() => {
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
  }, [animateDeploy]);

  useEffect(() => {
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
  }, [explode]);

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
    const arrowActive = replayConquestArrow !== null;
    setContinuousAnimation(arrowActive);
    if (arrowActive) startAnimationLoop();
    return () => setContinuousAnimation(false);
  }, [replayConquestArrow]);

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
    function onTerritoryClaimed(payload: {
      territoryId: number;
      playerId: number;
    }) {
      playSound('select');
      playSound('deploy');
      animateDeploy({
        territoryId: payload.territoryId,
        troops: 1,
        playerId: payload.playerId,
      });
      startAnimationLoop();
    }
    socket.on('game:territoryClaimed', onTerritoryClaimed);
    return () => {
      socket.off('game:territoryClaimed', onTerritoryClaimed);
    };
  }, [animateDeploy]);

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
    function onCardSetPlayed(payload: {
      playerId: number;
      troops: number;
      cards: Card[];
    }) {
      const id = ++cardSetFlashIdRef.current;
      setCardSetFlash({ id, cards: payload.cards });
      setTimeout(() => {
        setCardSetFlash((prev) => (prev?.id === id ? null : prev));
      }, CARD_SET_FLASH_DURATION);

      if (payload.playerId !== selfId) {
        const name =
          playersRef.current.find((p) => p.id === payload.playerId)?.name ??
          'A player';
        setToasts((prev) => [
          ...prev,
          {
            id: Date.now(),
            message: `${name} received ${payload.troops} troops from a set`,
          },
        ]);
      }
    }
    socket.on('game:cardSetPlayed', onCardSetPlayed);
    return () => {
      socket.off('game:cardSetPlayed', onCardSetPlayed);
    };
  }, [selfId]);

  useEffect(() => {
    const emojiTimers = emojiTimersRef.current;
    function onEmojiSent(payload: EmojiSentPayload) {
      playSound('emoji');
      const id = ++emojiPopIdRef.current;
      const rowPlayerId =
        payload.senderId === selfIdRef.current
          ? payload.targetPlayerId
          : payload.senderId;
      let attackText: string | undefined;
      let attackColor: string | undefined;

      const attackTarget = payload.attackTarget;
      if (attackTarget?.type === 'player') {
        const target = playersRef.current.find(
          (p) => p.id === attackTarget.playerId,
        );
        attackText = target?.name ?? '?';
        attackColor = target ? playerColor(target.color) : undefined;
      } else if (attackTarget?.type === 'territory') {
        const territoryId = attackTarget.territoryId;
        attackText = `#${territoryId + 1}`;
        const ownerId = ownerByIdRef.current.get(territoryId)?.ownerId;
        const owner = playersRef.current.find((p) => p.id === ownerId);
        attackColor = owner ? playerColor(owner.color) : undefined;

        const territory = territoriesRef.current.find(
          (t) => t.id === territoryId,
        );
        const canvasRect = canvasRef.current?.getBoundingClientRect();
        const rowRect = rowRefs.current
          .get(rowPlayerId)
          ?.getBoundingClientRect();
        if (territory && canvasRect && rowRect) {
          const local = getTerritoryScreenPosRef.current(territory);
          const sideOffset =
            VERTEX_RADIUS * zoomRef.current + EMOJI_TERRITORY_SIDE_GAP;
          const to = {
            x: canvasRect.left + local.x + sideOffset,
            y: canvasRect.top + local.y,
          };
          const from = { x: rowRect.left, y: rowRect.top + rowRect.height / 2 };
          const flightId = ++emojiFlightIdRef.current;
          const distance = Math.hypot(to.x - from.x, to.y - from.y);
          const { totalDuration, travelPercent } =
            emojiFlightDurations(distance);
          setEmojiFlights((prev) => [
            ...prev,
            {
              id: flightId,
              emoji: payload.emoji,
              from,
              to,
              totalDuration,
              travelPercent,
            },
          ]);
          const flightTimer = setTimeout(() => {
            emojiTimers.delete(flightTimer);
            setEmojiFlights((prev) => prev.filter((f) => f.id !== flightId));
          }, totalDuration);
          emojiTimers.add(flightTimer);
        }
      }

      setEmojiPops((prev) => [
        ...prev.filter((p) => p.rowPlayerId !== rowPlayerId),
        {
          id,
          rowPlayerId,
          emoji: payload.emoji,
          attackText,
          attackColor,
        },
      ]);
      const popTimer = setTimeout(() => {
        emojiTimers.delete(popTimer);
        setEmojiPops((prev) => prev.filter((p) => p.id !== id));
      }, EMOJI_POP_DURATION);
      emojiTimers.add(popTimer);
    }
    socket.on('game:emojiSent', onEmojiSent);
    return () => {
      socket.off('game:emojiSent', onEmojiSent);
      emojiTimers.forEach(clearTimeout);
      emojiTimers.clear();
    };
  }, []);

  function sendEmoji(
    targetPlayerId: number,
    emoji: EmojiValue,
    attackTarget?: EmojiAttackTarget,
  ) {
    socket.emit('game:sendEmoji', { targetPlayerId, emoji, attackTarget });
  }

  function handlePlayerRowClick(playerId: number) {
    if (pendingAttackEmoji) {
      sendEmoji(pendingAttackEmoji.targetPlayerId, ATTACK_EMOJI, {
        type: 'player',
        playerId,
      });
      setPendingAttackEmoji(null);
      return;
    }
    if (playerId === selfId) return;
    setEmojiPickerFor((prev) => (prev === playerId ? null : playerId));
  }

  function handleEmojiPick(targetPlayerId: number, emoji: EmojiValue) {
    setEmojiPickerFor(null);
    if (emoji === ATTACK_EMOJI) {
      setPendingAttackEmoji({ targetPlayerId });
      return;
    }
    sendEmoji(targetPlayerId, emoji);
  }

  useEffect(() => {
    if (emojiPickerFor === null) return;
    function handleOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (emojiPickerRef.current?.contains(target)) return;
      for (const row of rowRefs.current.values()) {
        if (row.contains(target)) return;
      }
      setEmojiPickerFor(null);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [emojiPickerFor]);

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

  useLayoutEffect(() => {
    if (!logsOpen) return;
    const container = buttonColumnRef.current;
    if (!container) return;
    function measure() {
      if (logsPanelRef.current)
        setLogsPanelTop(logsPanelRef.current.getBoundingClientRect().top);
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [logsOpen]);

  useEffect(() => {
    if (openPanel === null) return;
    function handleOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (cardsButtonRef.current?.contains(target)) return;
      if (bonusesButtonRef.current?.contains(target)) return;
      if (logsButtonRef.current?.contains(target)) return;
      if (cardsPanelRef.current?.contains(target)) return;
      if (logsPanelRef.current?.contains(target)) return;
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
    (turnPhase === 'deploy' || turnPhase === 'troop') &&
    isMyTurn &&
    !paused &&
    selectedTerritoryId !== null;
  const fortifyPanelOpen =
    turnPhase === 'fortify' &&
    isMyTurn &&
    !paused &&
    fortifyEndTerritoryId !== null;
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

  const submitDeploy = useCallback(() => {
    if (selectedTerritoryId === null) return;
    const event = turnPhase === 'troop' ? 'game:placeTroop' : 'game:deploy';
    socket.emit(
      event,
      { territoryId: selectedTerritoryId, troops: deployTroops },
      (res: Ack) => {
        if (!res.ok) return;
        setGame(res.game);
        frozenTroopsRef.current.delete(selectedTerritoryId);
      },
    );
  }, [selectedTerritoryId, deployTroops, setGame, turnPhase]);

  function isInteractable(t: Territory): boolean {
    if (pendingAttackEmoji) return !gameEnded;
    if (gameEnded || !isMyTurn || paused) return false;
    if (turnPhase === 'territory') return territoryClaimCandidates.has(t.id);
    if (turnPhase === 'capital') return ownerById.get(t.id)?.ownerId === selfId;
    if (turnPhase === 'deploy' || turnPhase === 'troop')
      return troopsToDeploy > 0 && ownerById.get(t.id)?.ownerId === selfId;
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
        if (pendingAttackEmoji) {
          setPendingAttackEmoji(null);
          return;
        }
        if (emojiPickerFor !== null) {
          setEmojiPickerFor(null);
          return;
        }
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
      const isConfirmKey = e.key === 'Enter' || e.key === ' ';
      if (
        isConfirmKey &&
        cardsOpen &&
        isMyTurn &&
        turnPhase === 'deploy' &&
        selectedCombo
      ) {
        if (!isTypingTarget(e.target)) {
          e.preventDefault();
          playCardSet(selectedCombo);
          return;
        }
      }
      if (isConfirmKey && deployPanelOpen) {
        if (!isTypingTarget(e.target) || e.target === deployInputRef.current) {
          e.preventDefault();
          submitDeploy();
          return;
        }
      }
      if (isConfirmKey && fortifyPanelOpen) {
        if (!isTypingTarget(e.target) || e.target === fortifyInputRef.current) {
          e.preventDefault();
          submitFortify();
          return;
        }
      }
      if (isConfirmKey && attackPanelOpen && attackShowPendingConquest) {
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
        isConfirmKey &&
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
    pendingAttackEmoji,
    emojiPickerFor,
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
    cardsOpen,
    selectedCombo,
    playCardSet,
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
    if (turnPhase === 'territory') {
      if (id === hoveredId) return 'hovered';
      return territoryClaimCandidates.has(id) ? 'selectable' : 'normal';
    }
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
    if (
      turnPhase !== 'deploy' &&
      turnPhase !== 'troop' &&
      selectedTerritoryId !== null
    ) {
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

    if (replayConquestArrow) {
      const territoryById = new Map(territories.map((t) => [t.id, t]));
      const start = territoryById.get(replayConquestArrow.fromTerritoryId);
      const end = territoryById.get(replayConquestArrow.toTerritoryId);
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
        : UNCLAIMED_TERRITORY_COLOR;

      ctx.beginPath();
      if (owner?.isCapital) {
        const half = VERTEX_RADIUS * zoom;
        ctx.rect(p.x - half, p.y - half, half * 2, half * 2);
      } else {
        ctx.arc(p.x, p.y, VERTEX_RADIUS * zoom, 0, Math.PI * 2);
      }
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
          if (owner?.isCapital) {
            const half = (VERTEX_RADIUS + 6) * zoom;
            ctx.rect(p.x - half, p.y - half, half * 2, half * 2);
          } else {
            ctx.arc(p.x, p.y, (VERTEX_RADIUS + 6) * zoom, 0, Math.PI * 2);
          }
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

      if (bonusesOpen) {
        const idText = `#${t.id + 1}`;
        ctx.font = `bold ${11 * zoom}px sans-serif`;
        const padX = 4 * zoom;
        const boxW = ctx.measureText(idText).width + padX * 2;
        const boxH = 15 * zoom;
        const boxX = p.x - boxW / 2;
        const boxY = p.y + VERTEX_RADIUS * zoom + 4 * zoom;

        ctx.fillStyle = 'rgba(20, 20, 20, 0.85)';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1 * zoom;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 4 * zoom);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(idText, p.x, boxY + boxH / 2 + 1 * zoom);
      }
    }

    if (continentGroups) {
      for (const [continentId, group] of continentGroups) {
        const screenPoints = group.map((t) => toScreen(t));
        const cx =
          screenPoints.reduce((s, p) => s + p.x, 0) / screenPoints.length;
        const cy =
          screenPoints.reduce((s, p) => s + p.y, 0) / screenPoints.length;
        const text = `#${continentId + 1}:+${bonuses[continentId] ?? 0}`;

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
    if (!drag || drag.moved) return;
    const pos = getPos(e);
    const vertex = hitVertex(pos);

    if (pendingAttackEmoji) {
      if (!gameEnded && vertex)
        sendEmoji(pendingAttackEmoji.targetPlayerId, ATTACK_EMOJI, {
          type: 'territory',
          territoryId: vertex.id,
        });
      setPendingAttackEmoji(null);
      return;
    }

    if (gameEnded || !isMyTurn || paused) return;

    if (turnPhase === 'territory') {
      if (vertex && isInteractable(vertex)) claimTerritory(vertex.id);
      return;
    }

    if (turnPhase === 'capital') {
      if (vertex && isInteractable(vertex)) selectCapital(vertex.id);
      return;
    }

    if (turnPhase === 'fortify') {
      if (fortifyEndTerritoryId !== null) {
        if (
          vertex &&
          (vertex.id === fortifyStartTerritoryId ||
            vertex.id === fortifyEndTerritoryId)
        ) {
          submitFortify();
        } else {
          cancelFortify();
        }
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
      if (attackPendingConquest) {
        if (vertex && vertex.id === attackEndTerritoryId) submitAttackMove();
        return;
      }
      if (attackEndTerritoryId !== null) {
        if (
          !attackRevealing &&
          vertex &&
          (vertex.id === attackStartTerritoryId ||
            vertex.id === attackEndTerritoryId)
        ) {
          submitAttack();
        } else {
          cancelAttack();
        }
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
    if (selectedTerritoryId === vertex.id) {
      submitDeploy();
      return;
    }
    if (turnPhase === 'deploy') setToasts([]);
    selectTerritory(vertex.id);
  }

  function handleMouseLeave() {
    dragRef.current = null;
    setHoveredId(null);
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    if (pendingAttackEmoji) {
      setPendingAttackEmoji(null);
      return;
    }
    if (gameEnded || !isMyTurn || paused) return;
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
          cursor: pendingAttackEmoji
            ? 'crosshair'
            : hoveredId !== null
              ? 'pointer'
              : 'default',
        }}
      />
      <div
        className="position-absolute start-0 ms-3 d-flex flex-column align-items-start gap-2"
        style={{ zIndex: 2, top: cardsButtonsTop }}
      >
        <div
          ref={buttonColumnRef}
          className="d-flex flex-column align-items-start gap-3"
        >
          <Tip text="Bonuses">
            <Button
              ref={bonusesButtonRef}
              variant="secondary"
              size="sm"
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
          </Tip>
          {cardsOpen ? (
            <div ref={cardsPanelRef}>
              <CardsPanel
                hand={hand}
                ownedTerritoryIds={ownedTerritoryIds}
                upcomingSetValues={upcomingSetValues}
                combos={combos}
                selectedCombo={selectedCombo}
                onSelectCombo={(combo) => setSelectedComboKey(comboKey(combo))}
                canPlay={isMyTurn && turnPhase === 'deploy'}
                onPlaySet={playCardSet}
                onClose={() => setOpenPanel(null)}
              />
            </div>
          ) : (
            <Tip text="Cards">
              <Button
                ref={cardsButtonRef}
                variant="secondary"
                size="sm"
                className="position-relative"
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
                {!gameEnded && hand.length > 0 && (
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
            </Tip>
          )}
          {logsOpen ? (
            <div ref={logsPanelRef}>
              <LogsPanel
                logs={logs}
                top={logsPanelTop}
                onClose={() => setOpenPanel(null)}
              />
            </div>
          ) : (
            <Tip text="Logs">
              <Button
                ref={logsButtonRef}
                variant="secondary"
                size="sm"
                onClick={() => setOpenPanel('logs')}
              >
                <img
                  src={whiteLogsIcon ?? '/icons/logs.svg'}
                  width={16}
                  height={16}
                  alt="Logs"
                />
              </Button>
            </Tip>
          )}
        </div>
        {!gameEnded && awardedCards.length > 0 && (
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
      </div>
      <PlayersPanel
        players={players}
        spectators={spectators}
        gameMode={gameMode}
        isTeamDeathmatch={isTeamDeathmatch}
        isCapitals={isCapitals}
        mission={mission}
        selfId={selfId}
        turnNumber={turnNumber}
        turnPhase={turnPhase}
        turnPlayerId={currentTurnPlayer?.id ?? null}
        hostId={hostId}
        paused={paused}
        onTogglePause={onTogglePause}
        gameEnded={gameEnded}
        collapsed={panelCollapsed}
        setCollapsed={setPanelCollapsed}
        navigate={navigate}
        rowRefs={rowRefs}
        onRowClick={handlePlayerRowClick}
        emojiTargeting={pendingAttackEmoji !== null}
        emojiPops={emojiPops}
      />
      {emojiPickerFor !== null &&
        (() => {
          const rect = rowRefs.current
            .get(emojiPickerFor)
            ?.getBoundingClientRect();
          if (!rect) return null;
          return (
            <div
              ref={emojiPickerRef}
              className={`position-fixed ${PANEL_BG_CLASS} border rounded-start d-flex align-items-center`}
              style={{
                top: rect.top + rect.height / 2,
                right: size.w - rect.left + EMOJI_PANEL_EDGE_OFFSET,
                width: 'fit-content',
                padding: 0,
                transform: 'translateY(-50%)',
                zIndex: 3,
              }}
            >
              <style>{`
                .annex-emoji-btn:hover {
                  background-color: rgba(127, 127, 127, 0.35) !important;
                  border-radius: 4px;
                }
              `}</style>
              {EMOJIS.map((emoji) => (
                <Tip key={emoji} text={EMOJI_LABELS[emoji]} placement="bottom">
                  <button
                    type="button"
                    className="annex-emoji-btn border-0 bg-transparent d-inline-flex align-items-center justify-content-center lh-1"
                    style={{
                      fontSize: 24,
                      padding: '3px 4px 5px 4px',
                    }}
                    onClick={() => handleEmojiPick(emojiPickerFor, emoji)}
                  >
                    {emoji}
                  </button>
                </Tip>
              ))}
            </div>
          );
        })()}
      {emojiPops.map((pop) => {
        const rect = rowRefs.current
          .get(pop.rowPlayerId)
          ?.getBoundingClientRect();
        if (!rect) return null;
        return (
          <div
            key={pop.id}
            className="position-fixed"
            style={{
              top: rect.top + rect.height / 2,
              right: size.w - rect.left + EMOJI_PANEL_EDGE_OFFSET,
              width: 'fit-content',
              zIndex: 3,
              pointerEvents: 'none',
              overflow: 'hidden',
              transform: 'translateY(-50%)',
            }}
          >
            <style>{`
              @keyframes annexEmojiPop {
                0% { transform: translateX(100%); opacity: 0; }
                20% { transform: translateX(0); opacity: 1; }
                80% { transform: translateX(0); opacity: 1; }
                100% { transform: translateX(0); opacity: 0; }
              }
            `}</style>
            <div
              className={`${PANEL_BG_CLASS} border rounded-start d-flex align-items-center gap-1`}
              style={{
                padding: 0,
                animation: `annexEmojiPop ${EMOJI_POP_DURATION}ms ease-out forwards`,
              }}
            >
              <Tip text={EMOJI_LABELS[pop.emoji]} placement="bottom">
                <span
                  className="d-inline-flex align-items-center justify-content-center lh-1"
                  style={{
                    fontSize: 24,
                    padding: '3px 4px 5px 4px',
                    pointerEvents: 'auto',
                  }}
                >
                  {pop.emoji}
                </span>
              </Tip>
              {pop.attackText && (
                <strong
                  className="text-truncate"
                  style={{ color: pop.attackColor, fontSize: 14 }}
                >
                  {pop.attackText}
                </strong>
              )}
            </div>
          </div>
        );
      })}
      {emojiFlights.map((flight) => (
        <div
          key={flight.id}
          className="position-fixed"
          style={
            {
              left: flight.from.x,
              top: flight.from.y,
              fontSize: 28,
              zIndex: 3,
              pointerEvents: 'none',
              transform: 'translate(-50%, -50%)',
              animation: `annexEmojiFlight-${flight.id} ${flight.totalDuration}ms linear forwards`,
              '--annex-emoji-dx': `${flight.to.x - flight.from.x}px`,
              '--annex-emoji-dy': `${flight.to.y - flight.from.y}px`,
            } as React.CSSProperties
          }
        >
          <style>{`
            @keyframes annexEmojiFlight-${flight.id} {
              0% { transform: translate(-50%, -50%); opacity: 1; }
              ${flight.travelPercent}% { transform: translate(calc(-50% + var(--annex-emoji-dx)), calc(-50% + var(--annex-emoji-dy))); opacity: 1; }
              95% { transform: translate(calc(-50% + var(--annex-emoji-dx)), calc(-50% + var(--annex-emoji-dy))); opacity: 1; }
              100% { transform: translate(calc(-50% + var(--annex-emoji-dx)), calc(-50% + var(--annex-emoji-dy))); opacity: 0; }
            }
          `}</style>
          {flight.emoji}
        </div>
      ))}
      {showReplay && replayTerritories && (
        <ReplayPanel
          index={replayIndex}
          totalFrames={replayTotalFrames}
          playing={replayPlaying}
          speed={replaySpeed}
          turnNumber={(replayTurnNumber ?? 0) + 1}
          color={replayPlayerColor}
          onTogglePlay={replayTogglePlay}
          onStepBack={replayStepBackward}
          onStepForward={replayStepForward}
          onJumpStart={replayJumpToStart}
          onJumpEnd={replayJumpToEnd}
          onSeek={replaySeek}
          onCycleSpeed={replayCycleSpeed}
        />
      )}
      {currentTurnPlayer && (
        <>
          {!gameEnded && (
            <>
              <TurnProgressBar
                turnStartedAt={turnStartedAt}
                turnDuration={
                  turnPhase === 'territory' || turnPhase === 'troop'
                    ? PLACEMENT_PHASE_DURATION
                    : turnPhase === 'capital'
                      ? CAPITAL_PHASE_DURATION
                      : turnDuration
                }
                color={playerColor(currentTurnPlayer.color)}
                paused={paused}
              />
              <TurnPanel
                turnPhase={turnPhase}
                currentPlayerName={currentTurnPlayer.name}
                color={playerColor(currentTurnPlayer.color)}
                isMyTurn={isMyTurn}
                troopsToDeploy={troopsToDeploy}
                troopsRemaining={currentTurnPlayer.troopsRemaining}
                canLeaveDeploy={troopsToDeploy <= 0 && !mustPlaySet}
                paused={paused}
                setGame={setGame}
              />
            </>
          )}
          {deployPanelOpen && deployPanelStyle && (
            <TroopPanel
              label={turnPhase === 'troop' ? 'Place troops:' : 'Deploy troops:'}
              buttonLabel={turnPhase === 'troop' ? 'Place' : 'Deploy'}
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
        <Toast
          show={paused && !gameEnded}
          className="mx-auto"
          style={{ width: 'fit-content', maxWidth: 'none' }}
        >
          <Toast.Body className="text-nowrap fw-bold">Game Paused</Toast.Body>
        </Toast>
        {toasts.map((t) => (
          <Toast
            key={t.id}
            onClose={() =>
              setToasts((prev) => prev.filter((x) => x.id !== t.id))
            }
            autohide
            delay={5000}
            className="mx-auto"
            style={{ width: 'fit-content', maxWidth: 'none' }}
          >
            <Toast.Body className="text-nowrap">{t.message}</Toast.Body>
          </Toast>
        ))}
      </ToastContainer>
      {!gameEnded && cardSetFlash && (
        <div
          key={cardSetFlash.id}
          className="position-fixed top-50 start-50 d-flex gap-3 bg-body bg-opacity-75 border rounded p-3"
          style={{
            zIndex: 4,
            pointerEvents: 'none',
            animation: `annexCardSetFlash ${CARD_SET_FLASH_DURATION / 1000}s ease-out forwards`,
          }}
        >
          <style>{`
            @keyframes annexCardSetFlash {
              0% { transform: translate(-50%, -50%) scale(0.4); opacity: 0; }
              15% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
              25% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
              85% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
              100% { transform: translate(-50%, -50%) scale(0.92); opacity: 0; }
            }
          `}</style>
          {cardSetFlash.cards.map((card, i) => (
            <CardFace key={i} card={card} size={90} />
          ))}
        </div>
      )}
    </div>
  );
}

export default GameMap;
