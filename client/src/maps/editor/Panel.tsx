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
import { useUiHidden } from '../../common/menus/shortcuts/uiHidden';
import PanelHeader from '../../common/PanelHeader';
import Tip from '../../common/tooltips/Tip';
import TipSpan from '../../common/tooltips/TipSpan';
import { contrastTextColor } from '../../lib/palette';
import { titleCase } from '../../lobby/settings/gameSettings';
import { PANEL_BG_CLASS, PANEL_CLASS } from '../../ui/containers/panelStyle';
import NumberOdometer from '../../ui/forms/NumberOdometer';
import EditorActions from './actions/EditorActions';
import UndoRedo from './actions/UndoRedo';
import { useSmoothEdges } from './canvas/smoothEdges';
import {
  NO_CONTINENT,
  type EditorTerritory as Territory,
} from './model/editorTypes';
import type { PaintTool } from './paint/paintTools';
import { PALETTE_GROUPS } from './paint/paintTools';
import { SHAPE_KINDS, shapeSides, type ShapeKind } from './paint/shapes';
import { continentColor } from './palette';
import GraphTools from './panel/GraphTools';
import NumberCell from './panel/NumberCell';
import PanelSection from './panel/PanelSection';
import ShapeIcon from './panel/ShapeIcon';
import TerritorySizeRange from './panel/TerritorySizeRange';
import ToolGroup, { type ToolOption } from './panel/ToolGroup';
import type { TileOptions } from './tiles/useTiles';

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
  setContinentNames: Dispatch<SetStateAction<string[]>>;
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
  shapeKind: ShapeKind;
  setShapeKind: (kind: ShapeKind) => void;
  tileOptions: TileOptions;
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
  onContinentClick: (id: number) => void;
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
    <Tip text={`Draw with ${value}`}>
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
    </Tip>
  );
}

const LINE_TOOLS: ToolOption[] = [
  { key: 'line', label: 'Straight', icon: '/icons/line.svg' },
  { key: 'curve', label: 'Curved', icon: '/icons/curve.svg' },
];

const SELECT_TOOLS: ToolOption[] = [
  { key: 'select', label: 'Marquee', icon: '/icons/select.svg' },
  { key: 'lasso', label: 'Lasso', icon: '/icons/lasso.svg' },
];

const TOOLS: {
  key: PaintTool;
  label: string;
  tip: string;
  icon?: string;
  group?: ToolOption[];
}[] = [
  {
    key: 'pencil',
    label: 'Pencil',
    tip: 'Draw freehand',
    icon: '/icons/pencil.svg',
  },
  {
    key: 'line',
    label: 'Line',
    tip: 'Draw straight or curved lines (arrow to switch)',
    group: LINE_TOOLS,
  },
  {
    key: 'shape',
    label: 'Shape',
    tip: 'Draw the chosen shape (arrow to change)',
  },
  {
    key: 'fill',
    label: 'Fill',
    tip: 'Fill a closed area with the color',
    icon: '/icons/fill.svg',
  },
  {
    key: 'sampler',
    label: 'Sampler',
    tip: 'Pick a color from the map',
    icon: '/icons/sample.svg',
  },
  {
    key: 'eraser',
    label: 'Eraser',
    tip: 'Paint white to erase',
    icon: '/icons/erase.svg',
  },
  {
    key: 'select',
    label: 'Select',
    tip: 'Select an area to move or copy (arrow to switch)',
    group: SELECT_TOOLS,
  },
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
    setContinentNames,
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
    tileOptions,
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
    onContinentClick,
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
  const hiddenClass = useUiHidden() ? ' invisible' : '';
  const [colorsOpen, setColorsOpen] = useState(false);
  const [continentsOpen, setContinentsOpen] = useState(false);

  useDismissOnOutsideClick(!collapsed, panelRef, () => setCollapsed(true));

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

  if (collapsed) {
    return (
      <Tip text="Show the map editor tools" placement="left">
        <Button
          variant="secondary"
          size="sm"
          className={`position-absolute top-0 end-0 m-3 d-flex align-items-center justify-content-center${hiddenClass}`}
          style={{ width: 28, height: 28, padding: 0 }}
          onClick={() => setCollapsed(false)}
        >
          <WhiteIcon path="/icons/menu.svg" alt="Menu" />
        </Button>
      </Tip>
    );
  }

  return (
    <div
      ref={panelRef}
      className={`position-absolute top-0 end-0 ${PANEL_BG_CLASS} ${PANEL_CLASS} m-3 d-flex flex-column overflow-y-auto overflow-x-hidden no-scrollbar${hiddenClass}`}
      style={{
        width: 'min(300px, calc(100vw - 2rem))',
        maxHeight: 'calc(100dvh - 2rem)',
      }}
    >
      <PanelHeader title="Map editor" onClose={() => setCollapsed(true)} />

      <EditorActions
        onNew={onNew}
        onGenerate={onGenerate}
        onWorldMap={onWorldMap}
        onImportImage={onImportImage}
        onImportLibrary={onImportLibrary}
        onSave={onSave}
        onLeave={onLeave}
        saving={saving}
        dirty={dirty}
        mapEmpty={mapEmpty}
        nameError={nameError}
      />

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

      <UndoRedo
        onUndo={onUndo}
        onRedo={onRedo}
        canUndo={canUndo}
        canRedo={canRedo}
      />

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
            <TipSpan key={c} text="Remove border color">
              <Button
                size="sm"
                variant="secondary"
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
            </TipSpan>
          ))}
          {borderPick === null ? (
            <TipSpan text="Add a border color">
              <Button
                size="sm"
                variant="secondary"
                className="py-0 d-flex align-items-center gap-1"
                disabled={borderColors.length >= MAX_BORDER_COLORS}
                onClick={() => {
                  flushSync(() => setBorderPick(BORDER_PICKER_START));
                  borderPickerRef.current?.showPicker();
                }}
              >
                <WhiteIcon path="/icons/plus.svg" size={12} />
                Add
              </Button>
            </TipSpan>
          ) : (
            <>
              <Form.Control
                ref={borderPickerRef}
                type="color"
                size="sm"
                value={borderPick}
                onChange={(e) => setBorderPick(e.target.value.toLowerCase())}
              />
              <TipSpan text="Add this border color">
                <Button
                  size="sm"
                  variant="success"
                  className="py-0 d-flex align-items-center justify-content-center"
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
              </TipSpan>
              <Tip text="Cancel">
                <Button
                  size="sm"
                  variant="danger"
                  className="py-0 d-flex align-items-center justify-content-center"
                  onClick={() => setBorderPick(null)}
                >
                  <WhiteIcon path="/icons/close.svg" size={12} />
                </Button>
              </Tip>
            </>
          )}
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
      <TerritorySizeRange value={cellScale} onChange={setCellScale} />
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

      <ButtonGroup size="sm" className="w-100 mb-2">
        <Tip text="Edit territories and links">
          <Button
            variant={
              mode === 'graph'
                ? exclusive
                  ? 'success'
                  : 'primary'
                : 'secondary'
            }
            className="d-flex align-items-center justify-content-center gap-1"
            onClick={() => onModeClick('graph')}
          >
            <WhiteIcon path="/icons/territory.svg" />
            Graph
          </Button>
        </Tip>
        <Tip text="Paint the map image">
          <Button
            variant={
              mode === 'paint'
                ? exclusive
                  ? 'success'
                  : 'primary'
                : 'secondary'
            }
            className="d-flex align-items-center justify-content-center gap-1"
            onClick={() => onModeClick('paint')}
          >
            <WhiteIcon path="/icons/pencil.svg" />
            Draw
          </Button>
        </Tip>
      </ButtonGroup>

      {mode === 'graph' ? (
        <div className="d-flex gap-2 mb-2">
          <Tip text="Add a territory in every closed area that has none (in the picked continent, or as sea with the sea brush)">
            <Button
              size="sm"
              variant="secondary"
              className="w-100 d-flex align-items-center justify-content-center gap-1"
              onClick={onFindTerritories}
            >
              <WhiteIcon path="/icons/binoculars.svg" />
              Find territories
            </Button>
          </Tip>
          <Tip text="Link territories whose areas touch">
            <Button
              size="sm"
              variant="secondary"
              className="w-100 d-flex align-items-center justify-content-center gap-1"
              onClick={onLinkTerritories}
            >
              <WhiteIcon path="/icons/link.svg" />
              Link territories
            </Button>
          </Tip>
        </div>
      ) : (
        <div className="d-flex gap-2 mb-2">
          <Tip text="Paint borders between territories on the map">
            <Button
              size="sm"
              variant="secondary"
              className="w-100 d-flex align-items-center justify-content-center gap-1"
              onClick={onDrawTerritories}
            >
              <WhiteIcon path="/icons/line.svg" />
              Draw territories
            </Button>
          </Tip>
          <Tip text="Color every territory area: land in earth tones, seas in the sea color">
            <Button
              size="sm"
              variant="secondary"
              className="w-100 d-flex align-items-center justify-content-center gap-1"
              onClick={onFillTerritories}
            >
              <WhiteIcon path="/icons/fill.svg" />
              Fill territories
            </Button>
          </Tip>
        </div>
      )}
      <div>
        {mode === 'paint' ? (
          <>
            <div className="row row-cols-2 g-1 mb-1">
              {TOOLS.map((t) => (
                <div key={t.key} className="col">
                  {t.key === 'shape' ? (
                    <Dropdown
                      as={ButtonGroup}
                      className="w-100"
                      onSelect={(key) => {
                        if (!key) return;
                        setShapeKind(key as ShapeKind);
                        setTool('shape');
                      }}
                    >
                      <Tip text={t.tip}>
                        <Button
                          size="sm"
                          variant={tool === 'shape' ? 'primary' : 'secondary'}
                          className="d-flex flex-grow-1 align-items-center justify-content-center gap-1"
                          onClick={() =>
                            setTool(tool === 'shape' ? null : 'shape')
                          }
                        >
                          <ShapeIcon kind={shapeKind} />
                          {titleCase(shapeKind)}
                        </Button>
                      </Tip>
                      <Tip text="Choose shape">
                        <Dropdown.Toggle
                          size="sm"
                          variant={tool === 'shape' ? 'primary' : 'secondary'}
                          split
                        >
                          <span className="visually-hidden">Choose shape</span>
                        </Dropdown.Toggle>
                      </Tip>
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
                  ) : t.group ? (
                    <ToolGroup
                      label={t.label}
                      tooltip={t.tip}
                      options={t.group}
                      tool={tool}
                      setTool={setTool}
                    />
                  ) : (
                    <Tip text={t.tip}>
                      <Button
                        size="sm"
                        variant={tool === t.key ? 'primary' : 'secondary'}
                        onClick={() => setTool(tool === t.key ? null : t.key)}
                        className="d-flex w-100 align-items-center justify-content-center gap-1"
                      >
                        {t.icon && <WhiteIcon path={t.icon} />}
                        {t.label}
                      </Button>
                    </Tip>
                  )}
                </div>
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
              <NumberOdometer
                min={MIN_BRUSH}
                max={MAX_BRUSH}
                value={brushSize}
                onChange={(e) =>
                  setBrushSize(clampBrush(e.target.value, brushSize))
                }
                {...brushNumberInput}
                style={{ minWidth: 64 }}
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
            <PanelSection
              title="Colors"
              summary={
                <span
                  className="d-inline-block rounded border"
                  style={{ width: 16, height: 16, backgroundColor: color }}
                />
              }
              open={colorsOpen}
              setOpen={setColorsOpen}
            >
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
            </PanelSection>
          </>
        ) : (
          <>
            <GraphTools
              tool={tool}
              setTool={setTool}
              tileOptions={tileOptions}
            />
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
                  <td>
                    {territories.filter((t) => !t.isSea && !t.switch).length}
                  </td>
                  <td>{territories.filter((t) => t.isSea).length}</td>
                  <td>{continentCount}</td>
                </tr>
              </tbody>
            </Table>
            <PanelSection
              title={`Continents (${continentCount})`}
              open={continentsOpen}
              setOpen={setContinentsOpen}
            >
              <Table
                size="sm"
                borderless
                className="mb-2 text-center align-middle"
              >
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
                        {
                          '--bs-table-bg': continentColor(i),
                          '--bs-table-color': contrastTextColor(
                            continentColor(i),
                          ),
                        } as CSSProperties
                      }
                    >
                      <td role="button" onClick={() => onContinentClick(i)}>
                        {i + 1}
                      </td>
                      <td role="button" onClick={() => onContinentClick(i)}>
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
                        <TipSpan text="Delete continent">
                          <Button
                            className="d-flex align-items-center justify-content-center"
                            variant="danger"
                            size="sm"
                            onClick={() => deleteContinent(i)}
                            disabled={continentCount <= MIN_CONTINENTS}
                          >
                            <WhiteIcon path="/icons/close.svg" size={12} />
                          </Button>
                        </TipSpan>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={4}>
                      <TipSpan text="Add continent">
                        <Button
                          className="d-flex align-items-center justify-content-center"
                          variant="success"
                          size="sm"
                          onClick={addContinent}
                          disabled={continentCount >= MAX_CONTINENTS}
                        >
                          <WhiteIcon path="/icons/plus.svg" size={14} />
                        </Button>
                      </TipSpan>
                    </td>
                  </tr>
                </tbody>
              </Table>
            </PanelSection>
          </>
        )}
      </div>
    </div>
  );
}

export default Panel;
