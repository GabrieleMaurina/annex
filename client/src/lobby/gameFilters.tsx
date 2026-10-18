import { TILE_SHAPE_VALUES, tileShapeLabel } from 'engine';
import { Form } from 'react-bootstrap';
import { Field } from '../common/inputs/filterControls';
import SearchMultiSelect, {
  type SearchSelectItem,
} from '../common/inputs/SearchMultiSelect';
import { connector } from '../connector';
import type { Fill, GenerationType, MapSize } from '../lib/types';
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
        inputWidth="10ch"
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
  onMapName,
  onSize,
  onType,
  onFill,
  onTile,
  onSeas,
  onTimed,
}: {
  mapName: string;
  size: string;
  type: string;
  fill: string;
  tile: string;
  seas: string;
  timed: string;
  onMapName: (v: string) => void;
  onSize: (v: string) => void;
  onType: (v: string) => void;
  onFill: (v: string) => void;
  onTile: (v: string) => void;
  onSeas: (v: string) => void;
  onTimed: (v: string) => void;
}) {
  return (
    <>
      <Field label="Map">
        <Form.Select
          size="sm"
          className="w-auto"
          value={mapName}
          onChange={(e) => {
            const value = e.target.value;
            onMapName(value);
            if (value !== GENERATED_MAP_VALUE) {
              onSize('');
              onType('');
              onFill('');
              onTile('');
              onSeas('');
              onTimed('');
            }
          }}
        >
          <option value="">Any</option>
          <option value={GENERATED_MAP_VALUE}>Generated</option>
        </Form.Select>
      </Field>
      {mapName === GENERATED_MAP_VALUE && (
        <>
          <Field label="Generated map size">
            <Form.Select
              size="sm"
              className="w-auto"
              value={size}
              onChange={(e) => onSize(e.target.value)}
            >
              <option value="">Any</option>
              {MAP_GENERATION_SIZES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Form.Select>
          </Field>
          <Field label="Generated map type">
            <Form.Select
              size="sm"
              className="w-auto"
              value={type}
              onChange={(e) => {
                onType(e.target.value);
                if (e.target.value !== 'tile') onTile('');
              }}
            >
              <option value="">Any</option>
              {MAP_GENERATION_TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Form.Select>
          </Field>
          {type === 'tile' && (
            <Field label="Generated map tile">
              <Form.Select
                size="sm"
                className="w-auto"
                value={tile}
                onChange={(e) => onTile(e.target.value)}
              >
                <option value="">Any</option>
                {TILE_SHAPE_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {tileShapeLabel(value)}
                  </option>
                ))}
              </Form.Select>
            </Field>
          )}
          <Field label="Generated map fill">
            <Form.Select
              size="sm"
              className="w-auto"
              value={fill}
              onChange={(e) => onFill(e.target.value)}
            >
              <option value="">Any</option>
              {MAP_GENERATION_FILLS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Form.Select>
          </Field>
          <Field label="Generated map seas">
            <Form.Select
              size="sm"
              className="w-auto"
              value={seas}
              onChange={(e) => onSeas(e.target.value)}
            >
              <option value="">Any</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Form.Select>
          </Field>
          <Field label="Generated map timed connections">
            <Form.Select
              size="sm"
              className="w-auto"
              value={timed}
              onChange={(e) => onTimed(e.target.value)}
            >
              <option value="">Any</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Form.Select>
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
          <div key={section} className="border rounded p-2 mb-2">
            <div className="fw-bold text-muted small mb-2">{section}</div>
            <div className="row g-3">
              {defs.map((def) => (
                <Field key={def.key} label={def.label}>
                  <Form.Select
                    size="sm"
                    className="w-auto"
                    value={settings[def.key] ?? ''}
                    onChange={(e) => onChange(def.key, e.target.value)}
                  >
                    <option value="">Any</option>
                    {def.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Form.Select>
                </Field>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
