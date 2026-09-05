import { BUILTIN_MAP_NAMES } from 'engine';
import { Form } from 'react-bootstrap';
import { Field } from '../common/filterControls';
import SearchMultiSelect, {
  type SearchSelectItem,
} from '../common/SearchMultiSelect';
import { connector } from '../connector';
import type { MapSize, WaterLevel } from '../lib/types';
import {
  GAME_SETTING_SECTIONS,
  GAME_SETTINGS,
  GENERATED_MAP_VALUE,
} from './gameSettings';

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

const MAP_GENERATION_WATERS: { value: WaterLevel; label: string }[] = [
  { value: 'land', label: 'Land' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'ocean', label: 'Ocean' },
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
  water,
  onMapName,
  onSize,
  onWater,
}: {
  mapName: string;
  size: string;
  water: string;
  onMapName: (v: string) => void;
  onSize: (v: string) => void;
  onWater: (v: string) => void;
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
              onWater('');
            }
          }}
        >
          <option value="">Any</option>
          <option value={GENERATED_MAP_VALUE}>Generated</option>
          {BUILTIN_MAP_NAMES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
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
          <Field label="Generated map water">
            <Form.Select
              size="sm"
              className="w-auto"
              value={water}
              onChange={(e) => onWater(e.target.value)}
            >
              <option value="">Any</option>
              {MAP_GENERATION_WATERS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
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
