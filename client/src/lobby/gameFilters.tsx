import {
  aspectLabel,
  MAP_ASPECT_VALUES,
  TILE_SHAPE_VALUES,
  tileShapeLabel,
} from 'engine';
import { Button } from 'react-bootstrap';
import WhiteIcon from '../common/icons/WhiteIcon';
import { Field } from '../common/inputs/filterControls';
import SearchMultiSelect, {
  type SearchSelectItem,
} from '../common/inputs/SearchMultiSelect';
import Tip from '../common/tooltips/Tip';
import { connector } from '../connector';
import type { Fill, GenerationType, MapSize } from '../lib/types';
import { SECTION_CLASS } from '../ui/containers/panelStyle';
import Selector from '../ui/forms/Selector';
import {
  DEFAULT_GAME_SETTINGS,
  GAME_SETTING_SECTIONS,
  GAME_SETTINGS,
  GENERATED_MAP_VALUE,
  type GameSettingDef,
} from './settings/gameSettings';
import SettingOdometer from './settings/SettingOdometer';
import {
  DIRECTIONAL_CONNECTIONS_HELP,
  MAP_GEN_HELP,
  MAP_HELP,
  MOUNTAINS_HELP,
  RIVERS_HELP,
  SEAS_HELP,
  SWITCHES_HELP,
  TIMED_CONNECTIONS_HELP,
  UNLOCKABLE_HELP,
} from './settings/settingsHelp';

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
  aspect,
  seas,
  timed,
  directional,
  switched,
  unlockable,
  mountains,
  rivers,
  onMapName,
  onSize,
  onType,
  onFill,
  onTile,
  onAspect,
  onSeas,
  onTimed,
  onDirectional,
  onSwitched,
  onUnlockable,
  onMountains,
  onRivers,
}: {
  mapName: string;
  size: string;
  type: string;
  fill: string;
  tile: string;
  aspect: string;
  seas: string;
  timed: string;
  directional: string;
  switched: string;
  unlockable: string;
  mountains: string;
  rivers: string;
  onMapName: (v: string) => void;
  onSize: (v: string) => void;
  onType: (v: string) => void;
  onFill: (v: string) => void;
  onTile: (v: string) => void;
  onAspect: (v: string) => void;
  onSeas: (v: string) => void;
  onTimed: (v: string) => void;
  onDirectional: (v: string) => void;
  onSwitched: (v: string) => void;
  onUnlockable: (v: string) => void;
  onMountains: (v: string) => void;
  onRivers: (v: string) => void;
}) {
  return (
    <>
      <Field label="Map" help={MAP_HELP}>
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
              onAspect('');
              onSeas('');
              onTimed('');
              onDirectional('');
              onSwitched('');
              onUnlockable('');
              onMountains('');
              onRivers('');
            }
          }}
        >
          <option value="">Any</option>
          <option value={GENERATED_MAP_VALUE}>Generated</option>
          <option value="library">Library</option>
          <option value="earth">Earth</option>
        </Selector>
      </Field>
      {mapName === GENERATED_MAP_VALUE && (
        <>
          <Field label="Generated map size" help={MAP_GEN_HELP}>
            <Selector size="sm" value={size} onChange={onSize}>
              <option value="">Any</option>
              {MAP_GENERATION_SIZES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Selector>
          </Field>
          <Field label="Generated map type" help={MAP_GEN_HELP}>
            <Selector
              size="sm"
              value={type}
              onChange={(value) => {
                onType(value);
                if (value !== 'tile') onTile('');
                if (value && value !== 'terrain') {
                  onMountains('');
                  onRivers('');
                }
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
            <Field label="Generated map tile" help={MAP_GEN_HELP}>
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
          <Field label="Generated map fill" help={MAP_GEN_HELP}>
            <Selector size="sm" value={fill} onChange={onFill}>
              <option value="">Any</option>
              {MAP_GENERATION_FILLS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Selector>
          </Field>
          <Field label="Generated map shape" help={MAP_GEN_HELP}>
            <Selector size="sm" value={aspect} onChange={onAspect}>
              <option value="">Any</option>
              {MAP_ASPECT_VALUES.map((value) => (
                <option key={value} value={value}>
                  {aspectLabel(value)}
                </option>
              ))}
            </Selector>
          </Field>
          <Field label="Generated map seas" help={SEAS_HELP}>
            <Selector size="sm" value={seas} onChange={onSeas}>
              <option value="">Any</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Selector>
          </Field>
          <Field
            label="Generated map timed links"
            help={TIMED_CONNECTIONS_HELP}
          >
            <Selector size="sm" value={timed} onChange={onTimed}>
              <option value="">Any</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Selector>
          </Field>
          <Field
            label="Generated map directional links"
            help={DIRECTIONAL_CONNECTIONS_HELP}
          >
            <Selector size="sm" value={directional} onChange={onDirectional}>
              <option value="">Any</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Selector>
          </Field>
          <Field label="Generated map switches" help={SWITCHES_HELP}>
            <Selector size="sm" value={switched} onChange={onSwitched}>
              <option value="">Any</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Selector>
          </Field>
          <Field label="Generated map unlockable" help={UNLOCKABLE_HELP}>
            <Selector size="sm" value={unlockable} onChange={onUnlockable}>
              <option value="">Any</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Selector>
          </Field>
          {(type === '' || type === 'terrain') && (
            <>
              <Field label="Generated map mountains" help={MOUNTAINS_HELP}>
                <Selector size="sm" value={mountains} onChange={onMountains}>
                  <option value="">Any</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </Selector>
              </Field>
              <Field label="Generated map rivers" help={RIVERS_HELP}>
                <Selector size="sm" value={rivers} onChange={onRivers}>
                  <option value="">Any</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </Selector>
              </Field>
            </>
          )}
        </>
      )}
    </>
  );
}

function RangeSettingFilter({
  def,
  range,
  value,
  onChange,
}: {
  def: GameSettingDef;
  range: { min: number; max: number };
  value: string;
  onChange: (key: string, value: string) => void;
}) {
  const fallback = Number(
    DEFAULT_GAME_SETTINGS[def.key as keyof typeof DEFAULT_GAME_SETTINGS],
  );
  return (
    <div className="d-flex align-items-center gap-2">
      <SettingOdometer
        className={value === '' ? 'opacity-50' : undefined}
        value={value === '' ? fallback : Number(value)}
        min={range.min}
        max={range.max}
        onChange={(next) => onChange(def.key, String(next))}
      />
      {value === '' ? (
        <span className="small text-muted">Any</span>
      ) : (
        <Tip text="Clear this filter">
          <Button
            className="d-flex align-items-center justify-content-center"
            size="sm"
            variant="secondary"
            aria-label="Clear this filter"
            onClick={() => onChange(def.key, '')}
          >
            <WhiteIcon path="/icons/close.svg" size={12} />
          </Button>
        </Tip>
      )}
    </div>
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
                <Field key={def.key} label={def.label} help={def.help}>
                  {def.range && def.options.length === 0 ? (
                    <RangeSettingFilter
                      def={def}
                      range={def.range}
                      value={settings[def.key] ?? ''}
                      onChange={onChange}
                    />
                  ) : (
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
                  )}
                </Field>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
