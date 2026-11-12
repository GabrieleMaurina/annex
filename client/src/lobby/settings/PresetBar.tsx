import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Button, ButtonGroup, Dropdown, Form } from 'react-bootstrap';
import Help from '../../common/tooltips/Help';
import Tip from '../../common/tooltips/Tip';
import { playSound } from '../../lib/sounds';
import { SECTION_CLASS } from '../../ui/containers/panelStyle';
import { GAP, useDrag } from '../../ui/dnd/dragDrop';
import DragGhost from '../../ui/dnd/DragGhost';
import {
  exportPreset,
  loadPresets,
  MAX_PRESET_NAME_LENGTH,
  readPresetFile,
  savePresets,
  type Preset,
  type Presets,
} from './presets';
import { PRESETS_HELP } from './settingsHelp';

const MENU_POPPER = { strategy: 'fixed' as const };
const SHRINK_STYLE = { minWidth: 0 };
const EMPTY_ACTIONS = [
  ['save', 'Save current settings'],
  ['import', 'Import'],
];
const PRESET_ACTIONS = [
  ['save', 'Overwrite with current settings'],
  ['rename', 'Rename'],
  ['export', 'Export'],
  ['import', 'Import'],
  ['delete', 'Delete'],
];

interface Props {
  currentPreset: (name: string) => Preset;
  applyPreset: (preset: Preset) => void;
  onError: (error: string) => void;
  onFilledChange: (filled: boolean) => void;
}

function PresetBar({
  currentPreset,
  applyPreset,
  onError,
  onFilledChange,
}: Props) {
  const [presets, setPresets] = useState<Presets | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const { drag, start, register } = useDrag<number>();
  const importIndex = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const saveVersion = useRef(0);

  function show(next: Presets) {
    setPresets(next);
    onFilledChange(next.some(Boolean));
  }

  useEffect(() => {
    loadPresets()
      .then((res) => {
        if (!res.ok) return onError(res.error);
        setPresets(res.presets);
        onFilledChange(res.presets.some(Boolean));
      })
      .catch(() => onError('server error'));
  }, [onError, onFilledChange]);

  if (!presets) return null;
  const slots = presets;

  function save(next: Presets) {
    const version = ++saveVersion.current;
    savePresets(next)
      .then((res) => {
        if (version !== saveVersion.current) return;
        if (res.ok) show(res.presets);
        else onError(res.error);
      })
      .catch(() => onError('server error'));
  }

  function commit(next: Presets) {
    show(next);
    save(next);
  }

  function replace(index: number, preset: Preset | null) {
    commit(slots.map((one, i) => (i === index ? preset : one)));
  }

  function saveCurrent(index: number) {
    const existing = slots[index];
    replace(index, currentPreset(existing?.name ?? `Preset ${index + 1}`));
    if (!existing) setEditing(index);
  }

  function rename(index: number, name: string) {
    setEditing(null);
    const preset = slots[index];
    const trimmed = name.trim();
    if (preset && trimmed && trimmed !== preset.name)
      replace(index, { ...preset, name: trimmed });
  }

  function move(from: number, to: number) {
    if (from === to) return;
    const next = slots.filter((_, i) => i !== from);
    next.splice(to, 0, slots[from]);
    commit(next);
  }

  function startImport(index: number) {
    importIndex.current = index;
    fileInput.current?.click();
  }

  function importFile(file: File) {
    readPresetFile(file)
      .then((preset) =>
        save(slots.map((one, i) => (i === importIndex.current ? preset : one))),
      )
      .catch(() => onError('invalid preset file'));
  }

  function runAction(action: string, index: number) {
    const preset = slots[index];
    if (action === 'save') saveCurrent(index);
    if (action === 'rename') setEditing(index);
    if (action === 'export' && preset) exportPreset(preset);
    if (action === 'import') startImport(index);
    if (action === 'delete') replace(index, null);
  }

  const dragged = drag?.item ?? null;
  const hover = drag?.hover ?? null;
  const previewing = dragged !== null && hover !== null;
  const views = slots
    .map((_, index) => index)
    .filter((index) => !previewing || index !== dragged);
  const gapAt = previewing ? (hover.index ?? views.length) : null;
  const cells = views.map((index, viewIndex) => ({ index, viewIndex }));
  const entries =
    gapAt === null
      ? cells
      : [...cells.slice(0, gapAt), GAP, ...cells.slice(gapAt)];

  return (
    <div className={`${SECTION_CLASS} p-2 mt-2`}>
      <div className="fw-bold text-muted small mb-2">
        <Help tip={PRESETS_HELP}>Presets</Help>
      </div>
      <div className="row row-cols-1 row-cols-sm-3 row-cols-lg-5 g-3">
        {entries.map((entry) => {
          if (entry === GAP)
            return (
              <div key="gap" className="col" style={SHRINK_STYLE}>
                <div
                  ref={register('gap')}
                  data-drop-zone="preset"
                  data-drop-index={gapAt ?? undefined}
                  data-drop-exact="true"
                  className="rounded"
                  style={{
                    height: 31,
                    border: '2px dashed var(--bs-primary)',
                  }}
                />
              </div>
            );
          const { index, viewIndex } = entry;
          const preset = slots[index];
          return (
            <div key={index} className="col" style={SHRINK_STYLE}>
              <div
                ref={register(`slot-${index}`)}
                data-drop-zone="preset"
                data-drop-index={viewIndex}
                className="rounded"
                style={{ opacity: dragged === index && !previewing ? 0.35 : 1 }}
                onPointerDown={(e) => {
                  if (
                    preset &&
                    editing !== index &&
                    !(e.target as Element).closest(
                      '.dropdown-toggle, .dropdown-menu',
                    )
                  )
                    start(e, index, (hit) => {
                      if (hit?.index !== undefined) move(index, hit.index);
                    });
                }}
              >
                {editing === index ? (
                  <Form.Control
                    size="sm"
                    autoFocus
                    maxLength={MAX_PRESET_NAME_LENGTH}
                    defaultValue={preset?.name ?? ''}
                    onFocus={(e) => e.currentTarget.select()}
                    onBlur={(e) => rename(index, e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== 'Escape') return;
                      playSound('click');
                      if (e.key === 'Escape')
                        e.currentTarget.value = preset?.name ?? '';
                      e.currentTarget.blur();
                    }}
                  />
                ) : (
                  <Dropdown
                    as={ButtonGroup}
                    size="sm"
                    className="w-100"
                    onSelect={(key) => key && runAction(key, index)}
                  >
                    <Tip
                      text={
                        preset
                          ? 'Apply this preset. Drag it onto another slot to move it.'
                          : 'Save the current settings in this slot.'
                      }
                    >
                      <Button
                        variant={preset ? 'primary' : 'secondary'}
                        className="text-truncate flex-grow-1"
                        style={SHRINK_STYLE}
                        onClick={() =>
                          preset ? applyPreset(preset) : saveCurrent(index)
                        }
                      >
                        {preset ? preset.name : `${index + 1}. Empty`}
                      </Button>
                    </Tip>
                    <Dropdown.Toggle
                      split
                      className="flex-grow-0"
                      variant={preset ? 'primary' : 'secondary'}
                    />
                    <Dropdown.Menu
                      className="selector-menu"
                      popperConfig={MENU_POPPER}
                    >
                      {(preset ? PRESET_ACTIONS : EMPTY_ACTIONS).map(
                        ([action, label], row) => (
                          <Dropdown.Item
                            key={action}
                            as="button"
                            eventKey={action}
                            className="selector-option text-nowrap"
                            style={{ '--selector-row': row } as CSSProperties}
                          >
                            {label}
                          </Dropdown.Item>
                        ),
                      )}
                    </Dropdown.Menu>
                  </Dropdown>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <DragGhost
        drag={drag}
        render={(index) => (
          <div className="btn btn-primary btn-sm">{slots[index]?.name}</div>
        )}
      />
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="d-none"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) importFile(file);
        }}
      />
    </div>
  );
}

export default PresetBar;
