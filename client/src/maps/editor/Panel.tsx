import { duplicatePlaceNames } from 'engine';
import type { CSSProperties, Dispatch, SetStateAction } from 'react';
import { useRef, useState } from 'react';
import {
  Alert,
  Button,
  ButtonGroup,
  Dropdown,
  Form,
  Table,
} from 'react-bootstrap';
import { flushSync } from 'react-dom';
import { useDismissOnOutsideClick } from '../../common/dismiss/useDismissOnOutsideClick';
import WhiteIcon from '../../common/icons/WhiteIcon';
import { useNumberInput } from '../../common/inputs/useNumberInput';
import PanelHeader from '../../common/PanelHeader';
import { PANEL_BG_CLASS, PANEL_CLASS } from '../../common/panelStyle';
import { contrastTextColor } from '../../lib/palette';
import { titleCase } from '../../lobby/settings/gameSettings';
import { useSmoothEdges } from './canvas/smoothEdges';
import {
  allPlaceNames,
  NO_CONTINENT,
  type EditorTerritory as Territory,
} from './model/editorTypes';
import type { PaintTool } from './paint/paintTools';
import { PALETTE_GROUPS } from './paint/paintTools';
import { SHAPE_KINDS, shapeSides, type ShapeKind } from './paint/shapes';
import { continentColor } from './palette';
import NumberCell from './panel/NumberCell';
import PlaceNameInput from './panel/PlaceNameInput';
import ShapeIcon from './panel/ShapeIcon';
import TerritorySizeRange from './panel/TerritorySizeRange';
import TimedLinksTable from './panel/TimedLinksTable';

const MIN_CONTINENTS = 0;
const MAX_CONTINENTS = 20;
const MIN_BONUS = 2;
const MAX_BONUS = 15;
const MIN_BRUSH = 1;
const MAX_BRUSH = 100;
const MAX_BORDER_COLORS = 8;
const BORDER_PICKER_START = '#808080';

interface Props {
  collapsed: boolean;
  setCollapsed: Dispatch<SetStateAction<boolean>>;
  territories: Territory[];
  setTerritories: Dispatch<SetStateAction<Territory[]>>;
  continentCount: number;
  setContinentCount: Dispatch<SetStateAction<number>>;
  bonuses: number[];
  setBonuses: Dispatch<SetStateAction<number[]>>;
  continentNames: string[];
  setContinentNames: Dispatch<SetStateAction<string[]>>;
  selectedTerritoryId: number | null;
  mapName: string;
  setMapName: (value: string) => void;
  mapSizeText: string;
  nameError: string;
  mode: 'graph' | 'paint';
  exclusive: boolean;
  onModeClick: (mode: 'graph' | 'paint') => void;
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
  shapeKind: ShapeKind | null;
  setShapeKind: (kind: ShapeKind) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onImportImage: () => void;
  onImportLibrary: () => void;
  onGenerate: () => void;
  onWorldMap: () => void;
  onNew: () => void;
  onSave: () => void;
  onLeave: () => void;
  saving: boolean;
  dirty: boolean;
  mapEmpty: boolean;
  error: string;
  showClickable: boolean;
  setShowClickable: (value: boolean) => void;
  clickableStatus: string;
  onFindTerritories: () => void;
  onLinkTerritories: () => void;
  onDrawTerritories: () => void;
  onFillTerritories: () => void;
  cellScale: number;
  setCellScale: (value: number) => void;
  borderPreview: boolean;
  setBorderPreview: (value: boolean) => void;
  borderColors: string[];
  setBorderColors: (value: string[]) => void;
  timedMode: boolean;
  setTimedMode: (value: boolean) => void;
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

const TOOLS: { key: PaintTool; label: string; icon?: string }[] = [
  { key: 'pencil', label: 'Pencil', icon: '/icons/pencil.svg' },
  { key: 'line', label: 'Line', icon: '/icons/line.svg' },
  { key: 'curve', label: 'Curve', icon: '/icons/curve.svg' },
  { key: 'shape', label: 'Shape' },
  { key: 'fill', label: 'Fill', icon: '/icons/fill.svg' },
  { key: 'sampler', label: 'Sampler', icon: '/icons/sample.svg' },
  { key: 'eraser', label: 'Eraser', icon: '/icons/erase.svg' },
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
    continentNames,
    setContinentNames,
    selectedTerritoryId,
    mapName,
    setMapName,
    mapSizeText,
    nameError,
    mode,
    exclusive,
    onModeClick,
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
    shapeKind,
    setShapeKind,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    onImportImage,
    onImportLibrary,
    onGenerate,
    onWorldMap,
    onNew,
    onSave,
    onLeave,
    saving,
    dirty,
    mapEmpty,
    error,
    showClickable,
    setShowClickable,
    clickableStatus,
    onFindTerritories,
    onLinkTerritories,
    onDrawTerritories,
    onFillTerritories,
    cellScale,
    setCellScale,
    borderPreview,
    setBorderPreview,
    borderColors,
    setBorderColors,
    timedMode,
    setTimedMode,
  } = props;

  const brushNumberInput = useNumberInput({
    value: brushSize,
    min: MIN_BRUSH,
    max: MAX_BRUSH,
    onChange: setBrushSize,
  });

  const [customPicker, setCustomPicker] = useState(
    customColors[customColors.length - 1] ?? '#000000',
  );
  const pickerFocusValue = useRef(customPicker);
  const [borderPick, setBorderPick] = useState<string | null>(null);
  const borderPickerRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [smoothEdges, setSmoothEdges] = useSmoothEdges();

  useDismissOnOutsideClick(!collapsed, panelRef, () => setCollapsed(true));

  const undoRedo = (
    <div className="d-flex gap-2 mb-2">
      <Button
        size="sm"
        variant="secondary"
        className="flex-grow-1"
        disabled={!canUndo}
        onClick={onUndo}
      >
        Undo
      </Button>
      <Button
        size="sm"
        variant="secondary"
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
    setContinentNames((prev) => [...prev, '']);
    setContinentCount((c) => c + 1);
  }

  function deleteContinent(index: number) {
    if (continentCount <= MIN_CONTINENTS) return;
    const target =
      continentCount === 1 ? NO_CONTINENT : index > 0 ? index - 1 : index + 1;
    setTerritories((prev) =>
      prev.map((t) => {
        if (t.isSea) return t;
        const continentId = t.continentId === index ? target : t.continentId;
        return continentId > index
          ? { ...t, continentId: continentId - 1 }
          : { ...t, continentId };
      }),
    );
    setBonuses((prev) => prev.filter((_, i) => i !== index));
    setContinentNames((prev) => prev.filter((_, i) => i !== index));
    setContinentCount((c) => c - 1);
  }

  function updateBonus(index: number, value: number) {
    setBonuses((prev) => prev.map((b, i) => (i === index ? value : b)));
  }

  function updateContinentName(index: number, value: string) {
    setContinentNames((prev) => prev.map((n, i) => (i === index ? value : n)));
  }

  function updateTerritoryName(id: number, value: string) {
    setTerritories((prev) =>
      prev.map((t) => (t.id === id ? { ...t, name: value } : t)),
    );
  }

  const selectedTerritory = territories.find(
    (t) => t.id === selectedTerritoryId,
  );
  const duplicateNames = duplicatePlaceNames(
    allPlaceNames(territories, continentNames),
  );
  const isDuplicate = (name: string) =>
    duplicateNames.has(name.trim().toLowerCase());

  if (collapsed) {
    return (
      <Button
        variant="secondary"
        size="sm"
        className="position-absolute top-0 end-0 m-3 d-flex align-items-center justify-content-center"
        style={{ width: 28, height: 28, padding: 0 }}
        onClick={() => setCollapsed(false)}
      >
        <WhiteIcon path="/icons/menu.svg" alt="Menu" />
      </Button>
    );
  }

  return (
    <div
      ref={panelRef}
      className={`position-absolute top-0 end-0 ${PANEL_BG_CLASS} ${PANEL_CLASS} m-3 d-flex flex-column overflow-y-auto overflow-x-hidden no-scrollbar`}
      style={{
        width: 'min(300px, calc(100vw - 2rem))',
        maxHeight: 'calc(100dvh - 2rem)',
      }}
    >
      <PanelHeader title="Map editor" onClose={() => setCollapsed(true)} />

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
        <Button
          variant="secondary"
          size="sm"
          className="w-100"
          onClick={onWorldMap}
        >
          Earth
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

      <div className="d-flex justify-content-between align-items-center mb-2">
        <Form.Check
          type="switch"
          id="editor-clickable"
          label="Clickable areas"
          checked={showClickable}
          onChange={(e) => setShowClickable(e.target.checked)}
        />
        <span className="small text-muted">{clickableStatus}</span>
      </div>
      {showClickable && (
        <div className="d-flex flex-wrap align-items-center gap-1 mb-2">
          <span className="small me-1">Borders</span>
          {borderColors.map((c) => (
            <Button
              key={c}
              size="sm"
              variant="outline-secondary"
              className="d-flex align-items-center gap-1 py-0 px-1"
              disabled={borderColors.length === 1}
              onClick={() =>
                setBorderColors(borderColors.filter((b) => b !== c))
              }
            >
              <span
                className="d-inline-block rounded border"
                style={{ width: 14, height: 14, backgroundColor: c }}
              />
              <WhiteIcon path="/icons/close.svg" size={10} />
            </Button>
          ))}
          {borderPick === null ? (
            <Button
              size="sm"
              variant="outline-secondary"
              className="py-0"
              disabled={borderColors.length >= MAX_BORDER_COLORS}
              onClick={() => {
                flushSync(() => setBorderPick(BORDER_PICKER_START));
                borderPickerRef.current?.showPicker();
              }}
            >
              Add
            </Button>
          ) : (
            <>
              <Form.Control
                ref={borderPickerRef}
                type="color"
                size="sm"
                value={borderPick}
                onChange={(e) => setBorderPick(e.target.value.toLowerCase())}
              />
              <Button
                size="sm"
                variant="success"
                className="py-0"
                disabled={
                  borderColors.length >= MAX_BORDER_COLORS ||
                  borderColors.includes(borderPick)
                }
                onClick={() => {
                  setBorderColors([...borderColors, borderPick]);
                  setBorderPick(null);
                }}
              >
                <WhiteIcon path="/icons/check.svg" size={12} />
              </Button>
              <Button
                size="sm"
                variant="danger"
                className="py-0"
                onClick={() => setBorderPick(null)}
              >
                <WhiteIcon path="/icons/close.svg" size={12} />
              </Button>
            </>
          )}
        </div>
      )}

      <ButtonGroup size="sm" className="w-100 mb-2">
        <Button
          variant={
            mode === 'graph'
              ? exclusive
                ? 'success'
                : 'primary'
              : 'outline-primary'
          }
          onClick={() => onModeClick('graph')}
        >
          Graph
        </Button>
        <Button
          variant={
            mode === 'paint'
              ? exclusive
                ? 'success'
                : 'primary'
              : 'outline-primary'
          }
          onClick={() => onModeClick('paint')}
        >
          Draw
        </Button>
      </ButtonGroup>

      {mode === 'graph' ? (
        <div className="d-flex gap-2 mb-2">
          <Button
            size="sm"
            variant="secondary"
            className="w-100"
            onClick={onFindTerritories}
          >
            Find territories
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="w-100"
            onClick={onLinkTerritories}
          >
            Link territories
          </Button>
        </div>
      ) : (
        <div className="d-flex gap-2 mb-2">
          <Button
            size="sm"
            variant="secondary"
            className="w-100"
            onClick={onDrawTerritories}
          >
            Draw territories
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="w-100"
            onClick={onFillTerritories}
          >
            Fill territories
          </Button>
        </div>
      )}
      <Form.Check
        type="switch"
        id="editor-border-preview"
        label="Preview borders"
        className="mb-2"
        checked={borderPreview}
        onChange={(e) => setBorderPreview(e.target.checked)}
      />
      {(borderPreview || mode === 'paint') && (
        <TerritorySizeRange value={cellScale} onChange={setCellScale} />
      )}
      <Form.Check
        type="switch"
        id="editor-smooth-edges"
        label="Preview smoothing"
        className="mb-2"
        checked={smoothEdges}
        onChange={(e) => setSmoothEdges(e.target.checked)}
      />

      {error && (
        <Alert variant="danger" className="py-1 px-2 small mb-2">
          {error}
        </Alert>
      )}

      <div>
        {mode === 'paint' ? (
          <>
            <div className="d-flex flex-wrap gap-1 mb-1">
              {TOOLS.map((t) =>
                t.key === 'shape' ? (
                  <Dropdown
                    key={t.key}
                    as={ButtonGroup}
                    onSelect={(key) => {
                      if (!key) return;
                      setShapeKind(key as ShapeKind);
                      setTool('shape');
                    }}
                  >
                    {shapeKind && (
                      <Button
                        size="sm"
                        variant={
                          tool === 'shape' ? 'primary' : 'outline-secondary'
                        }
                        className="d-flex align-items-center gap-1"
                        onClick={() =>
                          setTool(tool === 'shape' ? null : 'shape')
                        }
                      >
                        <ShapeIcon kind={shapeKind} />
                        {titleCase(shapeKind)}
                      </Button>
                    )}
                    <Dropdown.Toggle
                      size="sm"
                      variant={
                        tool === 'shape' ? 'primary' : 'outline-secondary'
                      }
                      split={!!shapeKind}
                    >
                      {shapeKind ? (
                        <span className="visually-hidden">Choose shape</span>
                      ) : (
                        t.label
                      )}
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                      {SHAPE_KINDS.map((k) => (
                        <Dropdown.Item
                          key={k}
                          as="button"
                          eventKey={k}
                          active={tool === 'shape' && shapeKind === k}
                          className="d-flex align-items-center gap-2"
                        >
                          <ShapeIcon kind={k} />
                          <span className="flex-grow-1">{titleCase(k)}</span>
                          <span className="small opacity-75">
                            {shapeSides(k)}
                          </span>
                        </Dropdown.Item>
                      ))}
                    </Dropdown.Menu>
                  </Dropdown>
                ) : (
                  <Button
                    key={t.key}
                    size="sm"
                    variant={tool === t.key ? 'primary' : 'outline-secondary'}
                    onClick={() => setTool(tool === t.key ? null : t.key)}
                    className="d-flex align-items-center gap-1"
                  >
                    {t.icon && <WhiteIcon path={t.icon} />}
                    {t.label}
                  </Button>
                ),
              )}
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
                {...brushNumberInput}
                style={{ ...brushNumberInput.style, width: 64 }}
              />
              <span className="small text-muted">px</span>
            </div>
            <style>{`
              .annex-brush-range::-webkit-slider-runnable-track {
                background: linear-gradient(
                  to right,
                  var(--bs-primary) var(--annex-brush-progress),
                  var(--bs-secondary-bg) var(--annex-brush-progress)
                );
              }
              .annex-brush-range::-moz-range-track {
                background: var(--bs-secondary-bg);
              }
              .annex-brush-range::-moz-range-progress {
                height: 0.5rem;
                background: var(--bs-primary);
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
            {selectedTerritory && (
              <Form.Group className="mb-2">
                <Form.Label className="small mb-1">
                  {selectedTerritory.isSea ? 'Sea' : 'Territory'} #
                  {selectedTerritory.id + 1} name
                </Form.Label>
                <PlaceNameInput
                  value={selectedTerritory.name}
                  placeholder={`#${selectedTerritory.id + 1}`}
                  duplicate={isDuplicate(selectedTerritory.name)}
                  onChange={(value) =>
                    updateTerritoryName(selectedTerritory.id, value)
                  }
                />
              </Form.Group>
            )}
            <Table size="sm" borderless className="mb-2 text-center">
              <thead>
                <tr>
                  <th>Territories</th>
                  <th>Seas</th>
                  <th>Continents</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{territories.filter((t) => !t.isSea).length}</td>
                  <td>{territories.filter((t) => t.isSea).length}</td>
                  <td>{continentCount}</td>
                </tr>
              </tbody>
            </Table>
            <Table
              size="sm"
              borderless
              className="mb-2 text-center align-middle"
            >
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
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
                      {
                        '--bs-table-bg': continentColor(i),
                        '--bs-table-color': contrastTextColor(
                          continentColor(i),
                        ),
                      } as CSSProperties
                    }
                  >
                    <td>{i + 1}</td>
                    <td>
                      <PlaceNameInput
                        value={continentNames[i]}
                        placeholder={`#${i + 1}`}
                        duplicate={isDuplicate(continentNames[i])}
                        onChange={(value) => updateContinentName(i, value)}
                      />
                    </td>
                    <td>
                      {
                        territories.filter(
                          (t) => !t.isSea && t.continentId === i,
                        ).length
                      }
                    </td>
                    <td>
                      <NumberCell
                        value={bonuses[i] ?? 2}
                        min={MIN_BONUS}
                        max={MAX_BONUS}
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
                        <WhiteIcon path="/icons/close.svg" size={12} />
                      </Button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={5}>
                    <Button
                      variant="success"
                      size="sm"
                      onClick={addContinent}
                      disabled={continentCount >= MAX_CONTINENTS}
                    >
                      <WhiteIcon path="/icons/plus.svg" size={14} />
                    </Button>
                  </td>
                </tr>
              </tbody>
            </Table>
            <TimedLinksTable
              territories={territories}
              setTerritories={setTerritories}
              timedMode={timedMode}
              setTimedMode={setTimedMode}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default Panel;
