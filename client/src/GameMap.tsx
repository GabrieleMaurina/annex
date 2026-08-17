import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Toast, ToastContainer } from 'react-bootstrap';
import {
  areAnimationsDisabled,
  drawAnimations,
  getAnimationDuration,
  hasActiveAnimations,
  pruneAnimations,
  startAnimation,
} from './animations';
import DeployPanel from './DeployPanel';
import {
  DEFAULT_IMAGE_HEIGHT,
  DEFAULT_IMAGE_WIDTH,
  loadGameMap,
  type Territory,
} from './mapData';
import {
  clamp,
  clampOffset,
  getClampedOffset as computeClampedOffset,
  getScales as computeScales,
} from './mapMath';
import { continentColor, contrastTextColor, playerColor } from './palette';
import PlayersPanel from './PlayersPanel';
import { socket } from './socket';
import { playSound } from './sounds';
import TurnPanel from './TurnPanel';
import TurnProgressBar from './TurnProgressBar';
import type { Ack, GameState, TurnDuration, TurnPhase } from './types';

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
const DEPLOY_PANEL_GAP = 10;
const DEPLOY_PANEL_HEIGHT = 50;
const DEPLOY_PANEL_WIDTH = 350;
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
  useEffect(() => {
    ownerByIdRef.current = ownerById;
    territoriesRef.current = territories;
  });

  const selectTerritory = useCallback(
    (territoryId: number | null) => {
      socket.emit('game:selectTerritory', { territoryId }, (res: Ack) => {
        if (res.ok) setGame(res.game);
      });
    },
    [setGame],
  );

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

  useEffect(() => {
    function onDeployed({ territoryId }: { territoryId: number }) {
      playSound('deploy');
      if (areAnimationsDisabled()) return;
      const territory = territoriesRef.current.find(
        (t) => t.id === territoryId,
      );
      if (territory) startAnimation('deploy', territory.x, territory.y);
      const troops = ownerByIdRef.current.get(territoryId)?.troops;
      if (troops !== undefined) {
        frozenTroopsRef.current.set(territoryId, troops);
        setTimeout(() => {
          frozenTroopsRef.current.delete(territoryId);
        }, getAnimationDuration('deploy'));
      }
      startAnimationLoop();
    }
    socket.on('game:deployed', onDeployed);
    return () => {
      socket.off('game:deployed', onDeployed);
    };
  }, []);

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
    selectedTerritoryId,
    selectTerritory,
    setChatOpen,
    deployPanelOpen,
    submitDeploy,
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
  }, [deployPanelOpen, troopsToDeploy, imgDims]);

  function nodeState(
    id: number,
  ): 'normal' | 'selectable' | 'hovered' | 'selected' {
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
        const troops = frozenTroopsRef.current.get(t.id) ?? owner.troops;
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
    if (isMyTurn && selectedTerritoryId !== null) selectTerritory(null);
  }

  const selectedTerritory =
    selectedTerritoryId !== null
      ? territories.find((t) => t.id === selectedTerritoryId)
      : undefined;
  const selectedScreenPos = selectedTerritory
    ? getTerritoryScreenPos(selectedTerritory)
    : null;
  const zoomedRadius = VERTEX_RADIUS * transform.zoom;
  let rawLeft = 0;
  let rawTop = 0;
  if (selectedScreenPos) {
    rawLeft = selectedScreenPos.x - DEPLOY_PANEL_WIDTH / 2;
    const fitsBelow =
      selectedScreenPos.y +
        zoomedRadius +
        DEPLOY_PANEL_GAP +
        DEPLOY_PANEL_HEIGHT <=
      size.h - TURN_PANEL_RESERVED_HEIGHT;
    rawTop = fitsBelow
      ? selectedScreenPos.y + zoomedRadius + DEPLOY_PANEL_GAP
      : selectedScreenPos.y -
        zoomedRadius -
        DEPLOY_PANEL_GAP -
        DEPLOY_PANEL_HEIGHT;
  }
  const deployPanelStyle: React.CSSProperties | undefined = selectedScreenPos
    ? {
        position: 'absolute',
        left: Math.max(
          Math.min(rawLeft, size.w - DEPLOY_PANEL_WIDTH - SCREEN_EDGE_MARGIN),
          SCREEN_EDGE_MARGIN,
        ),
        top: Math.min(
          Math.max(rawTop, SCREEN_EDGE_MARGIN),
          size.h - TURN_PANEL_RESERVED_HEIGHT - DEPLOY_PANEL_HEIGHT,
        ),
      }
    : undefined;

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
            <DeployPanel
              troops={deployTroops}
              maxTroops={troopsToDeploy}
              color={playerColor(currentTurnPlayer.color)}
              inputRef={deployInputRef}
              onChange={setDeployTroops}
              onDeploy={submitDeploy}
              style={deployPanelStyle}
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
