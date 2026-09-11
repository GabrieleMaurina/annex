import type { CSSProperties, Dispatch, SetStateAction } from 'react';
import { useRef, useState } from 'react';
import { Alert, Button, ButtonGroup, Form, Table } from 'react-bootstrap';
import { useDragNumber } from '../../common/useDragNumber';
import type { MapTerritory as Territory } from '../../lib/types';
import type { PaintTool } from './paint/paintTools';
import { PALETTE_GROUPS } from './paint/paintTools';
import { continentColor } from './palette';

const MIN_CONTINENTS = 1;
const MAX_CONTINENTS = 20;
const MIN_BONUS = 2;
const MAX_BONUS = 15;
const MIN_BRUSH = 1;
const MAX_BRUSH = 100;

interface Props {
  collapsed: boolean;
  setCollapsed: Dispatch<SetStateAction<boolean>>;
  territories: Territory[];
  setTerritories: Dispatch<SetStateAction<Territory[]>>;
  continentCount: number;
  setContinentCount: Dispatch<SetStateAction<number>>;
  bonuses: number[];
  setBonuses: Dispatch<SetStateAction<number[]>>;
  mapName: string;
  setMapName: (value: string) => void;
  mapSizeText: string;
  nameError: string;
  mode: 'graph' | 'paint';
  setMode: (mode: 'graph' | 'paint') => void;
  tool: PaintTool | null;
  setTool: (tool: PaintTool | null) => void;
  color: string;
  setColor: (color: string) => void;
  customColors: string[];
  addCustomColor: (hex: string) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
  dotted: boolean;
  setDotted: (value: boolean) => void;
  filled: boolean;
  setFilled: (value: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onImportImage: () => void;
  onImportLibrary: () => void;
  onGenerate: () => void;
  onNew: () => void;
  onSave: () => void;
  onLeave: () => void;
  saving: boolean;
  dirty: boolean;
  mapEmpty: boolean;
  error: string;
}

function BonusInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const dragNumber = useDragNumber({
    value,
    min: MIN_BONUS,
    max: MAX_BONUS,
    onChange,
  });
  return (
    <Form.Control
      type="number"
      size="sm"
      className="text-center"
      min={MIN_BONUS}
      max={MAX_BONUS}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      {...dragNumber}
      style={dragNumber.style}
    />
  );
}

function clampBrush(raw: string, current: number): number {
  if (raw.trim() === '') return current;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return current;
  return Math.min(MAX_BRUSH, Math.max(MIN_BRUSH, n));
}

function ColorSwatch({
  value,
  active,
  onClick,
}: {
  value: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded p-0"
      style={{
        width: 24,
        height: 24,
        backgroundColor: value,
        borderWidth: 3,
        borderStyle: 'solid',
        borderColor: active ? 'var(--bs-primary)' : 'var(--bs-border-color)',
      }}
    />
  );
}

const TOOLS: { key: PaintTool; label: string }[] = [
  { key: 'pencil', label: 'Pencil' },
  { key: 'line', label: 'Line' },
  { key: 'curve', label: 'Curve' },
  { key: 'rect', label: 'Square' },
  { key: 'ellipse', label: 'Circle' },
  { key: 'fill', label: 'Fill' },
  { key: 'sampler', label: 'Sampler' },
  { key: 'eraser', label: 'Eraser' },
];

function Panel(props: Props) {
  const {
    collapsed,
    setCollapsed,
    territories,
    setTerritories,
    continentCount,
    setContinentCount,
    bonuses,
    setBonuses,
    mapName,
    setMapName,
    mapSizeText,
    nameError,
    mode,
    setMode,
    tool,
    setTool,
    color,
    setColor,
    customColors,
    addCustomColor,
    brushSize,
    setBrushSize,
    dotted,
    setDotted,
    filled,
    setFilled,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    onImportImage,
    onImportLibrary,
    onGenerate,
    onNew,
    onSave,
    onLeave,
    saving,
    dirty,
    mapEmpty,
    error,
  } = props;

  const brushDrag = useDragNumber({
    value: brushSize,
    min: MIN_BRUSH,
    max: MAX_BRUSH,
    onChange: setBrushSize,
  });

  const [customPicker, setCustomPicker] = useState(
    customColors[customColors.length - 1] ?? '#000000',
  );
  const pickerFocusValue = useRef(customPicker);

  const undoRedo = (
    <div className="d-flex gap-1 mb-2">
      <Button
        size="sm"
        variant="outline-secondary"
        className="flex-grow-1"
        disabled={!canUndo}
        onClick={onUndo}
      >
        Undo
      </Button>
      <Button
        size="sm"
        variant="outline-secondary"
        className="flex-grow-1"
        disabled={!canRedo}
        onClick={onRedo}
      >
        Redo
      </Button>
    </div>
  );

  function addContinent() {
    if (continentCount >= MAX_CONTINENTS) return;
    setBonuses((prev) => [...prev, 2]);
    setContinentCount((c) => c + 1);
  }

  function deleteContinent(index: number) {
    if (continentCount <= MIN_CONTINENTS) return;
    const target = index > 0 ? index - 1 : index + 1;
    setTerritories((prev) =>
      prev.map((t) => {
        const continentId = t.continentId === index ? target : t.continentId;
        return continentId > index
          ? { ...t, continentId: continentId - 1 }
          : { ...t, continentId };
      }),
    );
    setBonuses((prev) => prev.filter((_, i) => i !== index));
    setContinentCount((c) => c - 1);
  }

  function updateBonus(index: number, value: number) {
    if (Number.isNaN(value)) return;
    const clamped = Math.max(MIN_BONUS, Math.min(MAX_BONUS, Math.round(value)));
    setBonuses((prev) => prev.map((b, i) => (i === index ? clamped : b)));
  }

  if (collapsed) {
    return (
      <Button
        variant="secondary"
        size="sm"
        className="position-absolute top-0 end-0 m-2"
        onClick={() => setCollapsed(false)}
      >
        ☰
      </Button>
    );
  }

  return (
    <div
      className="position-absolute top-0 end-0 bg-body bg-opacity-75 border rounded p-3 m-2 d-flex flex-column"
      style={{
        width: 'min(300px, calc(100vw - 1rem))',
        maxHeight: 'calc(100dvh - 1rem)',
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => setCollapsed(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setCollapsed(true);
        }}
        className="fw-bold text-center mb-2"
        style={{ cursor: 'pointer' }}
      >
        Map editor
      </div>

      <div className="d-flex gap-2 mb-2">
        <Button variant="secondary" size="sm" className="w-100" onClick={onNew}>
          New
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="w-100"
          onClick={onGenerate}
        >
          Generate
        </Button>
      </div>
      <div className="d-flex gap-2 mb-2">
        <Button
          variant="secondary"
          size="sm"
          className="w-100"
          onClick={onImportImage}
        >
          Import image
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="w-100"
          onClick={onImportLibrary}
        >
          Import map
        </Button>
      </div>
      <div className="d-flex gap-2 mb-2">
        <Button
          variant="secondary"
          size="sm"
          className="w-100"
          onClick={onSave}
          disabled={saving || !dirty || mapEmpty || !!nameError}
        >
          {saving
            ? 'Saving…'
            : !dirty && !mapEmpty && !nameError
              ? 'Saved'
              : 'Save'}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="w-100"
          onClick={onLeave}
        >
          Leave
        </Button>
      </div>

      <Form.Group className="mb-2">
        <div className="d-flex justify-content-between align-items-baseline mb-1">
          <Form.Label className="fw-bold mb-0">Map name</Form.Label>
          <span className="small text-muted">{mapSizeText}</span>
        </div>
        <Form.Control
          size="sm"
          type="text"
          maxLength={40}
          value={mapName}
          isInvalid={!!nameError}
          onChange={(e) => setMapName(e.target.value)}
          placeholder="Enter map name"
        />
        {nameError && <div className="text-danger small mt-1">{nameError}</div>}
      </Form.Group>

      {undoRedo}

      <ButtonGroup size="sm" className="w-100 mb-2">
        <Button
          variant={mode === 'graph' ? 'primary' : 'outline-primary'}
          onClick={() => setMode('graph')}
        >
          Graph
        </Button>
        <Button
          variant={mode === 'paint' ? 'primary' : 'outline-primary'}
          onClick={() => setMode('paint')}
        >
          Draw
        </Button>
      </ButtonGroup>

      {error && (
        <Alert variant="danger" className="py-1 px-2 small mb-2">
          {error}
        </Alert>
      )}

      <div
        className="flex-grow-1 overflow-y-auto overflow-x-hidden no-scrollbar"
        style={{ minHeight: 0 }}
      >
        {mode === 'paint' ? (
          <>
            <div className="d-flex flex-wrap gap-1 mb-1">
              {TOOLS.map((t) => (
                <Button
                  key={t.key}
                  size="sm"
                  variant={tool === t.key ? 'primary' : 'outline-secondary'}
                  onClick={() => setTool(tool === t.key ? null : t.key)}
                >
                  {t.label}
                </Button>
              ))}
            </div>
            <div className="d-flex gap-3 mb-2">
              <Form.Check
                type="switch"
                id="paint-dotted"
                label="Dotted"
                checked={dotted}
                onChange={(e) => setDotted(e.target.checked)}
              />
              <Form.Check
                type="switch"
                id="paint-filled"
                label="Filled"
                checked={filled}
                onChange={(e) => setFilled(e.target.checked)}
              />
            </div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <Form.Label className="small mb-0">Size</Form.Label>
              <Form.Control
                type="number"
                size="sm"
                className="text-center"
                min={MIN_BRUSH}
                max={MAX_BRUSH}
                value={brushSize}
                onChange={(e) =>
                  setBrushSize(clampBrush(e.target.value, brushSize))
                }
                {...brushDrag}
                style={{ ...brushDrag.style, width: 64 }}
              />
              <span className="small text-muted">px</span>
            </div>
            <style>{`
              .annex-brush-range::-webkit-slider-runnable-track {
                background: linear-gradient(
                  to right,
                  #0d6efd var(--annex-brush-progress),
                  var(--bs-secondary-bg) var(--annex-brush-progress)
                );
              }
              .annex-brush-range::-moz-range-track {
                background: var(--bs-secondary-bg);
              }
              .annex-brush-range::-moz-range-progress {
                height: 0.5rem;
                background: #0d6efd;
                border-radius: 1rem;
              }
            `}</style>
            <Form.Range
              className="annex-brush-range mb-2 px-1"
              min={MIN_BRUSH}
              max={MAX_BRUSH}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              style={
                {
                  '--annex-brush-progress': `${
                    ((brushSize - MIN_BRUSH) / (MAX_BRUSH - MIN_BRUSH)) * 100
                  }%`,
                } as CSSProperties
              }
            />
            {PALETTE_GROUPS.map((group) => (
              <div key={group.label} className="mb-1">
                <div className="small text-muted">{group.label}</div>
                <div className="d-flex flex-wrap gap-1">
                  {group.colors.map((s) => (
                    <ColorSwatch
                      key={group.label + s}
                      value={s}
                      active={color.toLowerCase() === s.toLowerCase()}
                      onClick={() => setColor(s)}
                    />
                  ))}
                </div>
              </div>
            ))}
            {customColors.length > 0 && (
              <div className="mb-1">
                <div className="small text-muted">Custom</div>
                <div className="d-flex flex-wrap gap-1">
                  {customColors.map((c) => (
                    <ColorSwatch
                      key={c}
                      value={c}
                      active={color.toLowerCase() === c.toLowerCase()}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </div>
            )}
            <div className="d-flex align-items-center gap-2 mt-1 mb-2">
              <span className="small text-muted">Pick</span>
              <Form.Control
                type="color"
                size="sm"
                value={customPicker}
                onFocus={() => {
                  pickerFocusValue.current = customPicker;
                }}
                onChange={(e) => {
                  setCustomPicker(e.target.value);
                  setColor(e.target.value);
                }}
                onBlur={() => {
                  if (customPicker !== pickerFocusValue.current)
                    addCustomColor(customPicker);
                }}
                style={{ width: 40, height: 24, padding: 2 }}
              />
            </div>
          </>
        ) : (
          <>
            <div className="mb-2 fw-bold">
              Total territories: {territories.length}
            </div>
            <Table size="sm" borderless className="mb-2 text-center">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Size</th>
                  <th>Bonus</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: continentCount }, (_, i) => (
                  <tr
                    key={i}
                    style={
                      { '--bs-table-bg': continentColor(i) } as CSSProperties
                    }
                  >
                    <td>{i + 1}</td>
                    <td>
                      {territories.filter((t) => t.continentId === i).length}
                    </td>
                    <td>
                      <BonusInput
                        value={bonuses[i] ?? 2}
                        onChange={(value) => updateBonus(i, value)}
                      />
                    </td>
                    <td>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => deleteContinent(i)}
                        disabled={continentCount <= MIN_CONTINENTS}
                      >
                        ✕
                      </Button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={4}>
                    <Button
                      variant="success"
                      size="sm"
                      onClick={addContinent}
                      disabled={continentCount >= MAX_CONTINENTS}
                    >
                      +
                    </Button>
                  </td>
                </tr>
              </tbody>
            </Table>
          </>
        )}
      </div>
    </div>
  );
}

export default Panel;
