import { MAP_SIZE_VALUES, mapImageSize, mapSizeLabel } from 'engine';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Form, Modal } from 'react-bootstrap';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { formatError } from '../common/formatError';
import { connector } from '../connector';
import type {
  Account,
  GenerateMapInput,
  MapSize,
  MapTerritory as Territory,
} from '../lib/types';
import {
  createBlankImage,
  createDefaultImage,
  DEFAULT_IMAGE_HEIGHT,
  DEFAULT_IMAGE_WIDTH,
  isBlankImage,
} from './editor/defaultImage';
import type { GeneratedEditorMap, GenerateInput } from './editor/generateMap';
import GenerateMapModal from './editor/GenerateMapModal';
import { isConnected } from './editor/graph';
import MapCanvas, { type MapCanvasHandle } from './editor/MapCanvas';
import PaintLayer, {
  type PaintLayerHandle,
  type Shape,
  type Viewport,
} from './editor/paint/PaintLayer';
import {
  drawShape,
  paintContext,
  PALETTE_GROUPS,
  type PaintTool,
} from './editor/paint/paintTools';
import Panel from './editor/Panel';
import { sortMapData } from './editor/sortMap';
import MapBrowser from './MapBrowser';

const MIN_CONTINENT_SIZE = 2;
const MAX_CONTINENT_SIZE = 40;
const HISTORY_LIMIT = 30;
const GRAPH_COMMIT_DELAY = 250;
const DEFAULT_MAP_NAME = 'Map';
const CUSTOM_COLORS_LIMIT = 30;
const MAX_IMAGE_BYTES = 6_000_000;

interface HistoryEntry {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  shape: Shape | null;
  territories: Territory[];
  bonuses: number[];
  continentCount: number;
  graphKey: string;
}

function graphKeyOf(
  territories: Territory[],
  bonuses: number[],
  continentCount: number,
): string {
  return JSON.stringify([territories, bonuses, continentCount]);
}

function isDefaultName(name: string): boolean {
  return !name.trim() || name.trim() === DEFAULT_MAP_NAME;
}

function mapSizeText(width: number, height: number): string {
  const match = MAP_SIZE_VALUES.find((s) => {
    const m = mapImageSize(s);
    return m.width === width && m.height === height;
  });
  return match ? mapSizeLabel(match) : 'Custom';
}

function blankSurface(width: number, height: number): ImageData {
  const s = new ImageData(Math.max(1, width), Math.max(1, height));
  s.data.fill(255);
  return s;
}

function blitSurface(surface: ImageData, canvas: HTMLCanvasElement): void {
  canvas.width = surface.width;
  canvas.height = surface.height;
  paintContext(canvas)?.putImageData(surface, 0, 0);
}

function surfaceToDataUrl(surface: ImageData): string {
  const c = document.createElement('canvas');
  c.width = surface.width;
  c.height = surface.height;
  c.getContext('2d')?.putImageData(surface, 0, 0);
  return c.toDataURL('image/png');
}

function decodeToSurface(img: HTMLImageElement): ImageData {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return blankSurface(img.naturalWidth, img.naturalHeight);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function invalidContinentSizes(
  territories: Territory[],
  continentCount: number,
): boolean {
  const size = new Map<number, number>();
  for (const t of territories)
    size.set(t.continentId, (size.get(t.continentId) ?? 0) + 1);
  for (let i = 0; i < continentCount; i++) {
    const n = size.get(i) ?? 0;
    if (n < MIN_CONTINENT_SIZE || n > MAX_CONTINENT_SIZE) return true;
  }
  return false;
}

function MapEditor({ account }: { account: Account }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();

  const [territories, setTerritories] = useState<Territory[]>([]);
  const [continentCount, setContinentCount] = useState(1);
  const [bonuses, setBonuses] = useState<number[]>([2]);
  const [imageSrc, setImageSrc] = useState<string>(
    () =>
      (location.state as { blank?: string } | null)?.blank ??
      createDefaultImage(),
  );
  const [mapName, setMapName] = useState(DEFAULT_MAP_NAME);
  const [generation, setGeneration] = useState<GenerateMapInput | null>(null);
  const [currentContinentId, setCurrentContinentId] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  const [mode, setMode] = useState<'graph' | 'paint'>('graph');
  const [tool, setTool] = useState<PaintTool | null>(null);
  const [color, setColor] = useState('#000000');
  const [customColors, setCustomColors] = useState<string[]>([]);
  const addCustomColor = useCallback((hex: string) => {
    setCustomColors((prev) => {
      if (prev.some((c) => c.toLowerCase() === hex.toLowerCase())) return prev;
      return [...prev, hex].slice(-CUSTOM_COLORS_LIMIT);
    });
  }, []);
  const [brushSize, setBrushSize] = useState(10);
  const [dotted, setDotted] = useState(false);
  const [filled, setFilled] = useState(false);
  const [paintVersion, setPaintVersion] = useState(0);
  const [paintEpoch, setPaintEpoch] = useState(0);
  const [paintSurface, setPaintSurface] = useState(() =>
    blankSurface(DEFAULT_IMAGE_WIDTH, DEFAULT_IMAGE_HEIGHT),
  );

  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [newSize, setNewSize] = useState<MapSize>('medium');
  const [dirty, setDirty] = useState(false);
  const pendingDirtyRef = useRef(false);
  const [takenNames, setTakenNames] = useState<string[]>([]);
  const [savedName, setSavedName] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!id);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const pastRef = useRef<HistoryEntry[]>([]);
  const futureRef = useRef<HistoryEntry[]>([]);
  const committedRef = useRef<HistoryEntry | null>(null);
  const paintRevRef = useRef(0);
  const committedPaintRef = useRef(0);
  const applyingRef = useRef(false);

  const [paintCanvas] = useState(() => {
    const canvas = document.createElement('canvas');
    blitSurface(
      blankSurface(DEFAULT_IMAGE_WIDTH, DEFAULT_IMAGE_HEIGHT),
      canvas,
    );
    return canvas;
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const paintLayerRef = useRef<PaintLayerHandle>(null);
  const mapCanvasRef = useRef<MapCanvasHandle>(null);
  const viewportRef = useRef<Viewport>({
    offsetX: 0,
    offsetY: 0,
    scaleX: 1,
    scaleY: 1,
  });

  const paintRafRef = useRef(0);
  const bumpPaint = useCallback(() => {
    if (paintRafRef.current) return;
    paintRafRef.current = requestAnimationFrame(() => {
      paintRafRef.current = 0;
      setPaintVersion((v) => v + 1);
    });
  }, []);
  useEffect(
    () => () => {
      if (paintRafRef.current) cancelAnimationFrame(paintRafRef.current);
    },
    [],
  );
  const bumpEpoch = useCallback(() => setPaintEpoch((e) => e + 1), []);
  const handleViewport = useCallback((v: Viewport) => {
    viewportRef.current = v;
  }, []);
  const handleWheelZoom = useCallback(
    (clientX: number, clientY: number, deltaY: number) =>
      mapCanvasRef.current?.zoomAt(clientX, clientY, deltaY),
    [],
  );
  const handlePickColor = useCallback(
    (hex: string) => {
      setColor(hex);
      const inPalette = PALETTE_GROUPS.some((g) =>
        g.colors.some((c) => c.toLowerCase() === hex.toLowerCase()),
      );
      if (!inPalette) addCustomColor(hex);
    },
    [addCustomColor],
  );

  const effectiveId = id ?? savedId;
  const sizeLabel = mapSizeText(paintSurface.width, paintSurface.height);

  const trimmedName = mapName.trim();
  const nameError =
    trimmedName &&
    trimmedName.toLowerCase() !== (savedName ?? '').toLowerCase() &&
    takenNames.some((n) => n.toLowerCase() === trimmedName.toLowerCase())
      ? 'You already have a map with this name.'
      : '';

  const graphKey = useMemo(
    () => graphKeyOf(territories, bonuses, continentCount),
    [territories, bonuses, continentCount],
  );

  const graphRef = useRef({ territories, bonuses, continentCount, graphKey });
  useEffect(() => {
    graphRef.current = { territories, bonuses, continentCount, graphKey };
  });

  const paintSurfaceRef = useRef(paintSurface);
  useEffect(() => {
    paintSurfaceRef.current = paintSurface;
  });

  const syncHistoryFlags = useCallback(() => {
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  const snapshotEntry = useCallback(
    (paintChanged: boolean): HistoryEntry => {
      const layer = paintLayerRef.current;
      const shape = layer?.serializeShape() ?? null;
      const base = shape ? (layer?.getBasePixels() ?? null) : null;
      const prev = committedRef.current;
      const pixels =
        base ??
        (paintChanged || !prev ? paintSurface.data.slice() : prev.pixels);
      return {
        pixels,
        width: paintSurface.width,
        height: paintSurface.height,
        shape: base ? shape : null,
        ...graphRef.current,
      };
    },
    [paintSurface],
  );

  const commitHistory = useCallback(() => {
    if (applyingRef.current) return;
    const before = committedRef.current;
    const graphDirty = !before || before.graphKey !== graphRef.current.graphKey;
    const paintDirty = paintRevRef.current !== committedPaintRef.current;
    if (!graphDirty && !paintDirty) return;
    committedPaintRef.current = paintRevRef.current;
    const now = snapshotEntry(paintDirty);
    if (before) {
      pastRef.current = [...pastRef.current, before].slice(-HISTORY_LIMIT);
      futureRef.current = [];
      syncHistoryFlags();
    }
    committedRef.current = now;
    setDirty(true);
  }, [snapshotEntry, syncHistoryFlags]);

  const commitPaint = useCallback(() => {
    paintRevRef.current += 1;
    commitHistory();
  }, [commitHistory]);

  useEffect(() => {
    const timer = setTimeout(commitHistory, GRAPH_COMMIT_DELAY);
    return () => clearTimeout(timer);
  }, [graphKey, commitHistory]);

  const [prevMode, setPrevMode] = useState(mode);
  if (mode !== prevMode) {
    setPrevMode(mode);
    if (mode === 'graph' && tool !== null) setTool(null);
  }

  useEffect(() => {
    let stale = false;
    const blank = isBlankImage(imageSrc);
    loadImage(imageSrc)
      .then((img) => {
        if (stale) return;
        const surface = blank
          ? blankSurface(img.naturalWidth, img.naturalHeight)
          : decodeToSurface(img);
        blitSurface(surface, paintCanvas);
        setPaintSurface(surface);
        applyingRef.current = false;
        paintRevRef.current = 0;
        committedPaintRef.current = 0;
        pastRef.current = [];
        futureRef.current = [];
        syncHistoryFlags();
        committedRef.current = {
          pixels: surface.data.slice(),
          width: surface.width,
          height: surface.height,
          shape: null,
          territories,
          bonuses,
          continentCount,
          graphKey: graphKeyOf(territories, bonuses, continentCount),
        };
        setDirty(pendingDirtyRef.current);
        pendingDirtyRef.current = false;
        bumpPaint();
        bumpEpoch();
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSrc, paintCanvas, bumpPaint, bumpEpoch, syncHistoryFlags]);

  useEffect(() => {
    connector.listMyMapNames(setTakenNames);
  }, []);

  useEffect(() => {
    if (!id) return;
    connector.getPlayerMap(id, (map) => {
      setLoading(false);
      if (!map || !map.mine || map.dangerous) {
        navigate('/maps/mine', { replace: true });
        return;
      }
      setTerritories(map.territories);
      setBonuses(map.bonuses.length ? map.bonuses : [2]);
      setContinentCount(Math.max(1, map.bonuses.length));
      setMapName(map.name);
      setSavedName(map.name);
      setGeneration(map.generation ?? null);
      setCurrentContinentId(0);
      setImageSrc(map.image);
    });
  }, [id, navigate]);

  const applyEntry = useCallback(
    (e: HistoryEntry) => {
      applyingRef.current = true;
      setTerritories(e.territories);
      setBonuses(e.bonuses);
      setContinentCount(e.continentCount);
      setCurrentContinentId(0);
      committedRef.current = e;
      committedPaintRef.current = paintRevRef.current;
      graphRef.current = {
        territories: e.territories,
        bonuses: e.bonuses,
        continentCount: e.continentCount,
        graphKey: graphKeyOf(e.territories, e.bonuses, e.continentCount),
      };

      let target = paintSurface;
      if (e.width === paintSurface.width && e.height === paintSurface.height) {
        paintSurface.data.set(e.pixels);
      } else {
        target = new ImageData(e.pixels.slice(), e.width, e.height);
        setPaintSurface(target);
      }

      const layer = paintLayerRef.current;
      if (e.shape && !layer)
        drawShape(
          target,
          e.shape.kind,
          e.shape.color,
          e.shape.x,
          e.shape.y,
          e.shape.w,
          e.shape.h,
          e.shape.size,
          e.shape.filled,
          e.shape.dotted,
        );
      blitSurface(target, paintCanvas);
      if (e.shape && layer) layer.adopt(e.shape);
      bumpPaint();
      applyingRef.current = false;
    },
    [paintSurface, paintCanvas, bumpPaint],
  );

  const undo = useCallback(() => {
    paintLayerRef.current?.flush();
    commitHistory();
    const current = committedRef.current;
    if (pastRef.current.length === 0 || !current) return;
    const target = pastRef.current[pastRef.current.length - 1];
    futureRef.current = [current, ...futureRef.current].slice(0, HISTORY_LIMIT);
    pastRef.current = pastRef.current.slice(0, -1);
    syncHistoryFlags();
    applyEntry(target);
  }, [commitHistory, syncHistoryFlags, applyEntry]);

  const redo = useCallback(() => {
    paintLayerRef.current?.flush();
    commitHistory();
    const current = committedRef.current;
    if (futureRef.current.length === 0 || !current) return;
    const target = futureRef.current[0];
    pastRef.current = [...pastRef.current, current].slice(-HISTORY_LIMIT);
    futureRef.current = futureRef.current.slice(1);
    syncHistoryFlags();
    applyEntry(target);
  }, [commitHistory, syncHistoryFlags, applyEntry]);

  function handleNameChange(value: string) {
    setMapName(value);
    setDirty(true);
  }

  function handleLeave() {
    if (dirty) setLeaveOpen(true);
    else navigate('/maps/mine');
  }

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      pendingDirtyRef.current = true;
      setImageSrc(reader.result as string);
      setGeneration(null);
      if (isDefaultName(mapName)) setMapName(file.name.replace(/\.[^.]+$/, ''));
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    e.preventDefault();
    handleFile(file);
  }

  function doNewMap(size: MapSize) {
    const { width, height } = mapImageSize(size);
    const blank = createBlankImage(width, height);
    setTerritories([]);
    setBonuses([2]);
    setContinentCount(1);
    setCurrentContinentId(0);
    setGeneration(null);
    setMapName(DEFAULT_MAP_NAME);
    setSavedId(null);
    setSavedName(null);
    setError('');
    setDirty(false);
    const surface = blankSurface(width, height);
    blitSurface(surface, paintCanvas);
    setPaintSurface(surface);
    applyingRef.current = false;
    paintRevRef.current = 0;
    committedPaintRef.current = 0;
    pendingDirtyRef.current = false;
    pastRef.current = [];
    futureRef.current = [];
    committedRef.current = {
      pixels: surface.data.slice(),
      width,
      height,
      shape: null,
      territories: [],
      bonuses: [2],
      continentCount: 1,
      graphKey: graphKeyOf([], [2], 1),
    };
    syncHistoryFlags();
    setImageSrc(blank);
    bumpPaint();
    bumpEpoch();
    if (id) navigate('/maps/editor', { state: { blank } });
  }

  function handleGenerated(map: GeneratedEditorMap, input: GenerateInput) {
    pendingDirtyRef.current = true;
    setTerritories(map.territories);
    setBonuses(map.bonuses.length ? map.bonuses : [2]);
    setContinentCount(Math.max(1, map.bonuses.length));
    setCurrentContinentId(0);
    setGeneration(input);
    if (isDefaultName(mapName)) setMapName(map.name);
    setImageSrc(map.imageSrc);
  }

  function pickLibraryMap(mapId: string) {
    connector.getPlayerMap(mapId, (map) => {
      if (!map) {
        setError('That map is no longer available.');
        setLibraryOpen(false);
        return;
      }
      pendingDirtyRef.current = true;
      setTerritories(map.territories);
      setBonuses(map.bonuses.length ? map.bonuses : [2]);
      setContinentCount(Math.max(1, map.bonuses.length));
      setGeneration(map.generation ?? null);
      setMapName(map.name);
      setCurrentContinentId(0);
      setImageSrc(map.image);
      setLibraryOpen(false);
    });
  }

  const handleSave = useCallback(() => {
    setError('');
    const name = mapName.trim();
    if (!name) {
      setError('Enter a map name.');
      return;
    }
    if (nameError) {
      setError(nameError);
      return;
    }
    if (territories.length === 0) {
      setError('Add at least one territory before saving.');
      return;
    }
    if (!isConnected(territories)) {
      setError('All territories must be connected.');
      return;
    }
    if (invalidContinentSizes(territories, continentCount)) {
      setError(
        `Each continent must have ${MIN_CONTINENT_SIZE}-${MAX_CONTINENT_SIZE} territories.`,
      );
      return;
    }
    paintLayerRef.current?.flush();
    const image = surfaceToDataUrl(paintSurface);
    if (image.length * 0.75 > MAX_IMAGE_BYTES) {
      setError('Image too large, max 6 MB.');
      return;
    }
    setSaving(true);
    const sorted = sortMapData(territories, bonuses);
    const body = {
      name,
      territories: sorted.territories,
      bonuses: sorted.bonuses,
      image,
      generation,
    };
    const done = (res: { ok: boolean; error?: string; id?: string }) => {
      setSaving(false);
      if (!res.ok) {
        setError(formatError(res.error ?? 'save failed'));
        return;
      }
      if (res.id) {
        setSavedId(res.id);
        navigate(`/maps/editor/${res.id}`, { replace: true });
      }
      setSavedName(name);
      setDirty(false);
      connector.listMyMapNames(setTakenNames);
    };
    if (effectiveId) connector.updatePlayerMap(effectiveId, body, done);
    else connector.savePlayerMap(body, done);
  }, [
    mapName,
    nameError,
    territories,
    continentCount,
    bonuses,
    generation,
    effectiveId,
    paintSurface,
    navigate,
  ]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && mode === 'paint') {
        if (tool) setTool(null);
        else setCollapsed(true);
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === 's') {
        e.preventDefault();
        handleSave();
      } else if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (key === 'y') {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSave, undo, redo, mode, tool]);

  if (loading) return null;

  return (
    <div
      className="position-fixed top-0 bottom-0 start-0 end-0 overflow-hidden"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) e.preventDefault();
      }}
      onDrop={handleDrop}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="d-none"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) handleFile(file);
        }}
      />

      <MapCanvas
        ref={mapCanvasRef}
        territories={territories}
        setTerritories={setTerritories}
        continentCount={continentCount}
        imageSrc={imageSrc}
        currentContinentId={currentContinentId}
        setCurrentContinentId={setCurrentContinentId}
        setCollapsed={setCollapsed}
        paintCanvas={paintCanvas}
        paintSurfaceRef={paintSurfaceRef}
        paintVersion={paintVersion}
        paintSize={brushSize}
        onPaintChange={bumpPaint}
        onPaintStrokeEnd={commitPaint}
        disabled={mode === 'paint'}
        panOnly={mode === 'paint' && tool === null}
        onViewport={handleViewport}
      />

      {mode === 'paint' && tool !== null && (
        <PaintLayer
          ref={paintLayerRef}
          paintCanvas={paintCanvas}
          surfaceRef={paintSurfaceRef}
          viewportRef={viewportRef}
          tool={tool}
          color={color}
          size={brushSize}
          epoch={paintEpoch}
          dotted={dotted}
          filled={filled}
          onStrokeEnd={commitPaint}
          onChange={bumpPaint}
          onWheelZoom={handleWheelZoom}
          onPickColor={handlePickColor}
        />
      )}

      <div className="position-absolute top-0 end-0" style={{ zIndex: 2 }}>
        <Panel
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          territories={territories}
          setTerritories={setTerritories}
          continentCount={continentCount}
          setContinentCount={setContinentCount}
          bonuses={bonuses}
          setBonuses={setBonuses}
          mapName={mapName}
          setMapName={handleNameChange}
          mapSizeText={sizeLabel}
          nameError={nameError}
          mode={mode}
          setMode={setMode}
          tool={tool}
          setTool={setTool}
          color={color}
          setColor={setColor}
          customColors={customColors}
          addCustomColor={addCustomColor}
          brushSize={brushSize}
          setBrushSize={setBrushSize}
          dotted={dotted}
          setDotted={setDotted}
          filled={filled}
          setFilled={setFilled}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          onImportImage={() => fileRef.current?.click()}
          onImportLibrary={() => setLibraryOpen(true)}
          onGenerate={() => setGenerateOpen(true)}
          onNew={() => setNewOpen(true)}
          onSave={handleSave}
          onLeave={handleLeave}
          saving={saving}
          dirty={dirty}
          mapEmpty={territories.length === 0}
          error={error}
        />
      </div>

      <GenerateMapModal
        show={generateOpen}
        onHide={() => setGenerateOpen(false)}
        onGenerated={handleGenerated}
      />

      <Modal show={newOpen} onHide={() => setNewOpen(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>New map</Modal.Title>
        </Modal.Header>
        <Modal.Body className="d-flex flex-column gap-2">
          {dirty && (
            <Alert variant="warning" className="py-1 px-2 small mb-0">
              You have unsaved changes. Creating a new map will discard them.
            </Alert>
          )}
          <Form.Group className="d-flex align-items-center gap-2">
            <Form.Label className="mb-0" style={{ minWidth: 50 }}>
              Size
            </Form.Label>
            <Form.Select
              value={newSize}
              onChange={(e) => setNewSize(e.target.value as MapSize)}
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="xlarge">Extra Large</option>
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setNewOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setNewOpen(false);
              doNewMap(newSize);
            }}
          >
            Create
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={leaveOpen} onHide={() => setLeaveOpen(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Leave editor</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          You have unsaved changes. Are you sure you want to leave?
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setLeaveOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => navigate('/maps/mine')}>
            Leave
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={libraryOpen} onHide={() => setLibraryOpen(false)} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>Import a map</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <MapBrowser
            account={account}
            mode="pick"
            onRowClick={(row) => pickLibraryMap(row.id)}
          />
        </Modal.Body>
      </Modal>
    </div>
  );
}

export default MapEditor;
