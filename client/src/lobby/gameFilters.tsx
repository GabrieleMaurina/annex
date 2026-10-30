import { TILE_SHAPE_VALUES, tileShapeLabel } from 'engine';
import { Field } from '../common/inputs/filterControls';
import SearchMultiSelect, {
  type SearchSelectItem,
} from '../common/inputs/SearchMultiSelect';
import { connector } from '../connector';
import type { Fill, GenerationType, MapSize } from '../lib/types';
import { SECTION_CLASS } from '../ui/containers/panelStyle';
import Selector from '../ui/forms/Selector';
import {
  GAME_SETTING_SECTIONS,
  GAME_SETTINGS,
  GENERATED_MAP_VALUE,
} from './settings/gameSettings';

const MAX_SELECTED_PLAYERS = 10;

function searchPlayers(
  query: string,
  cb: (items: SearchSelectItem[]) => void,
): void {
  connector.searchPlayers(query, (results) =>
    cb(results.map((r) => ({ id: r.id, label: r.username }))),
  );
}

const MAP_GENERATION_SIZES: { value: MapSize; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
  { value: 'xlarge', label: 'Extra Large' },
];

const MAP_GENERATION_TYPES: { value: GenerationType; label: string }[] = [
  { value: 'terrain', label: 'Terrain' },
  { value: 'dungeon', label: 'Dungeon' },
  { value: 'temple', label: 'Temple' },
  { value: 'tile', label: 'Tile' },
];

const MAP_GENERATION_FILLS: { value: Fill; label: string }[] = [
  { value: 'full', label: 'Full' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'sparse', label: 'Sparse' },
];

export function PlayerFilter({
  selected,
  onChange,
}: {
  selected: SearchSelectItem[];
  onChange: (selected: SearchSelectItem[]) => void;
}) {
  return (
    <div className="col-12 col-sm-6 col-md-4 col-xl-3">
      <SearchMultiSelect
        label="Players"
        placeholder="Name"
        maxLength={10}
        maxSelected={MAX_SELECTED_PLAYERS}
        search={searchPlayers}
        selected={selected}
        onChange={onChange}
      />
    </div>
  );
}

export function MapFilterFields({
  mapName,
  size,
  type,
  fill,
  tile,
  seas,
  timed,
  unlockable,
  onMapName,
  onSize,
  onType,
  onFill,
  onTile,
  onSeas,
  onTimed,
  onUnlockable,
}: {
  mapName: string;
  size: string;
  type: string;
  fill: string;
  tile: string;
  seas: string;
  timed: string;
  unlockable: string;
  onMapName: (v: string) => void;
  onSize: (v: string) => void;
  onType: (v: string) => void;
  onFill: (v: string) => void;
  onTile: (v: string) => void;
  onSeas: (v: string) => void;
  onTimed: (v: string) => void;
  onUnlockable: (v: string) => void;
}) {
  return (
    <>
      <Field label="Map">
        <Selector
          size="sm"
          value={mapName}
          onChange={(value) => {
            onMapName(value);
            if (value !== GENERATED_MAP_VALUE) {
              onSize('');
              onType('');
              onFill('');
              onTile('');
              onSeas('');
              onTimed('');
              onUnlockable('');
            }
          }}
        >
          <option value="">Any</option>
          <option value={GENERATED_MAP_VALUE}>Generated</option>
        </Selector>
      </Field>
      {mapName === GENERATED_MAP_VALUE && (
        <>
          <Field label="Generated map size">
            <Selector size="sm" value={size} onChange={onSize}>
              <option value="">Any</option>
              {MAP_GENERATION_SIZES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Selector>
          </Field>
          <Field label="Generated map type">
            <Selector
              size="sm"
              value={type}
              onChange={(value) => {
                onType(value);
                if (value !== 'tile') onTile('');
              }}
            >
              <option value="">Any</option>
              {MAP_GENERATION_TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Selector>
          </Field>
          {type === 'tile' && (
            <Field label="Generated map tile">
              <Selector size="sm" value={tile} onChange={onTile}>
                <option value="">Any</option>
                {TILE_SHAPE_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {tileShapeLabel(value)}
                  </option>
                ))}
              </Selector>
            </Field>
          )}
          <Field label="Generated map fill">
            <Selector size="sm" value={fill} onChange={onFill}>
              <option value="">Any</option>
              {MAP_GENERATION_FILLS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Selector>
          </Field>
          <Field label="Generated map seas">
            <Selector size="sm" value={seas} onChange={onSeas}>
              <option value="">Any</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Selector>
          </Field>
          <Field label="Generated map timed connections">
            <Selector size="sm" value={timed} onChange={onTimed}>
              <option value="">Any</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Selector>
          </Field>
          <Field label="Generated map unlockable">
            <Selector size="sm" value={unlockable} onChange={onUnlockable}>
              <option value="">Any</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Selector>
          </Field>
        </>
      )}
    </>
  );
}

export function SettingFilterSections({
  settings,
  onChange,
}: {
  settings: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <>
      {GAME_SETTING_SECTIONS.map((section) => {
        const defs = GAME_SETTINGS.filter((s) => s.section === section);
        if (defs.length === 0) return null;
        return (
          <div key={section} className={`${SECTION_CLASS} p-2 mb-2`}>
            <div className="fw-bold text-muted small mb-2">{section}</div>
            <div className="row g-3">
              {defs.map((def) => (
                <Field key={def.key} label={def.label}>
                  <Selector
                    size="sm"
                    value={settings[def.key] ?? ''}
                    onChange={(value) => onChange(def.key, value)}
                  >
                    <option value="">Any</option>
                    {def.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Selector>
                </Field>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
