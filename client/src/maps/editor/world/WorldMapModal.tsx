import {
  mapImageSize,
  type MapAspect,
  type MapSize,
  type OsmDetail,
  type OsmGeneratedMap,
} from 'engine';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Form, Modal, ProgressBar } from 'react-bootstrap';
import Help from '../../../common/tooltips/Help';
import {
  EARTH_MOUNTAINS_HELP,
  EARTH_RIVERS_HELP,
  SEAS_HELP,
  TIMED_CONNECTIONS_HELP,
} from '../../../lobby/settings/settingsHelp';
import {
  citiesIn,
  drawnArea,
  labelPoint,
  loadFocusRings,
  loadFrameBounds,
  loadGazetteer,
  loadOutlines,
  nearbyPlaces,
  type GazetteerIndex,
  type GazetteerPlace,
} from './gazetteer';
import { generateWorldMap, type WorldMapJob } from './generateWorldMap';
import SearchBox from './SearchBox';
import {
  availableDetails,
  frameBounds,
  frameCorners,
  frameWidth,
  mercatorY,
  type WorldFrame,
} from './tileCover';
import WorldMap, { type EarthView, type PlaceChoice } from './WorldMap';
import type { WorldFocus, WorldMapProgress } from './worldTypes';

const DETAIL_LABELS: Record<OsmDetail, string> = {
  auto: 'Auto',
  countries: 'Countries',
  states: 'States / regions',
  counties: 'Provinces / counties',
  municipalities: 'Municipalities',
  districts: 'Districts',
  neighbourhoods: 'Neighbourhoods',
  blocks: 'Blocks',
};

const SIZES: [MapSize, string][] = [
  ['small', 'Small'],
  ['medium', 'Medium'],
  ['large', 'Large'],
  ['xlarge', 'Extra Large'],
];

const ASPECTS: [MapAspect, string][] = [
  ['wide', '16:9'],
  ['square', '1:1'],
];

const PLACE_KINDS = ['country', 'state', 'city'];
const METRO_KIND = 'metro';
const DRAWN_KIND = 'area';
const FOCUSABLE_KINDS = [...PLACE_KINDS, METRO_KIND, DRAWN_KIND];
const WIDE_FIT_MIN_RATIO = 4 / 3;
const MIN_PLACE_OVERLAP = 0.5;
const MAX_ZOOM_OUT = 3;
const MAX_BADGE_NAMES = 3;
const EARTH_CIRCUMFERENCE_KM = 40075;
const COUNTRY_VIEW_KM = 1500;
const STATE_VIEW_KM = 150;
const PANEL_WIDTH = 300;
const PANEL_INSET = PANEL_WIDTH + 16;

interface EarthSession {
  size: MapSize;
  aspect: MapAspect;
  detail: OsmDetail;
  seas: boolean;
  timed: boolean;
  mountains: boolean;
  rivers: boolean;
  place: GazetteerPlace | null;
  placeBounds: GazetteerPlace['bounds'] | null;
  extras: GazetteerPlace[];
  collapsed: boolean;
  view: EarthView;
}

const session: EarthSession = {
  size: 'medium',
  aspect: 'wide',
  detail: 'auto',
  seas: false,
  timed: false,
  mountains: false,
  rivers: false,
  place: null,
  placeBounds: null,
  extras: [],
  collapsed: false,
  view: { center: [10, 30], zoom: 1.5, bearing: 0 },
};

const CREDITS =
  'Map data © OpenStreetMap contributors · © OpenMapTiles · OpenFreeMap · Elevation: Mapzen Terrain Tiles (SRTM, GMTED, ETOPO1 and others) · Search data: GeoNames (CC BY 4.0), Natural Earth';

const ERROR_TEXT: Record<string, string> = {
  'no land in the selected area': 'There is no land inside the frame.',
  'the selected area is too small':
    'The framed area is too small for a map. Zoom out a little.',
};

interface Props {
  onHide: () => void;
  onGenerated: (map: OsmGeneratedMap) => void;
}

function frameProblem(frame: WorldFrame | null): string {
  if (!frame) return 'Loading the map…';
  if (frameWidth(frame) > 1) return 'Zoom in to frame part of the world.';
  if (frameCorners(frame).some(([, y]) => y < 0 || y > 1))
    return 'Move the frame away from the poles.';
  return '';
}

function latitudeOf(y: number): number {
  return (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
}

function lonLatBounds(frame: WorldFrame): [number, number, number, number] {
  const box = frameBounds(frame);
  return [
    box.x0 * 360 - 180,
    latitudeOf(box.y1),
    box.x1 * 360 - 180,
    latitudeOf(box.y0),
  ];
}

function frameOverlap(
  [w, s, e, n]: GazetteerPlace['bounds'],
  frame: WorldFrame,
) {
  const box = frameBounds(frame);
  const shift = Math.round((box.x0 + box.x1) / 2 - ((w + e) / 2 + 180) / 360);
  const x0 = (w + 180) / 360 + shift;
  const x1 = (e + 180) / 360 + shift;
  const y0 = mercatorY(n);
  const y1 = mercatorY(s);
  return {
    overlap:
      Math.max(0, Math.min(x1, box.x1) - Math.max(x0, box.x0)) *
      Math.max(0, Math.min(y1, box.y1) - Math.max(y0, box.y0)),
    placeArea: (x1 - x0) * (y1 - y0),
    frameArea: (box.x1 - box.x0) * (box.y1 - box.y0),
    tooSmall: box.x1 - box.x0 > MAX_ZOOM_OUT * (x1 - x0),
  };
}

function placeInFrame(
  bounds: GazetteerPlace['bounds'],
  frame: WorldFrame,
  zoomOutLimit: boolean,
): boolean {
  const { overlap, placeArea, frameArea, tooSmall } = frameOverlap(
    bounds,
    frame,
  );
  return (
    overlap >= MIN_PLACE_OVERLAP * Math.min(placeArea, frameArea) &&
    (!zoomOutLimit || !tooSmall)
  );
}

function mostlyVisible(
  bounds: GazetteerPlace['bounds'],
  frame: WorldFrame,
): boolean {
  const { overlap, placeArea, tooSmall } = frameOverlap(bounds, frame);
  return overlap >= MIN_PLACE_OVERLAP * placeArea && !tooSmall;
}

function bestAspect(
  [w, s, e, n]: GazetteerPlace['bounds'],
  bearing: number,
): MapAspect {
  const width = (e - w) / 360;
  const height = mercatorY(s) - mercatorY(n);
  const quarterTurned = Math.round(bearing / 90) % 2 !== 0;
  const ratio = quarterTurned ? height / width : width / height;
  return ratio >= WIDE_FIT_MIN_RATIO ? 'wide' : 'square';
}

function focusOf(place: GazetteerPlace, rings: number[][]): WorldFocus {
  const [w, s, e, n] = place.bounds;
  return {
    kind: place.kind,
    name: place.name,
    lon: (w + e) / 2,
    lat: (s + n) / 2,
    population: place.kind === 'city' ? place.rank : 0,
    rings,
  };
}

function viewKind([west, south, east, north]: [
  number,
  number,
  number,
  number,
]): string {
  const widthKm =
    ((east - west) / 360) *
    EARTH_CIRCUMFERENCE_KM *
    Math.cos((((south + north) / 2) * Math.PI) / 180);
  if (widthKm >= COUNTRY_VIEW_KM) return 'country';
  if (widthKm >= STATE_VIEW_KM) return 'state';
  return 'city';
}

function focusLabel(names: string[]): string {
  const shown = names.slice(0, MAX_BADGE_NAMES).join(', ');
  return names.length > MAX_BADGE_NAMES
    ? `${shown} +${names.length - MAX_BADGE_NAMES}`
    : shown;
}

function progressText(progress: WorldMapProgress | null): string {
  if (!progress) return 'Starting…';
  if (progress.stage === 'build') return 'Building territories…';
  return `Downloading map data ${progress.done}/${progress.total}`;
}

function WorldMapModal({ onHide, onGenerated }: Props) {
  const [size, setSize] = useState(session.size);
  const [aspect, setAspect] = useState(session.aspect);
  const [detail, setDetail] = useState(session.detail);
  const [seas, setSeas] = useState(session.seas);
  const [timed, setTimed] = useState(session.timed);
  const [mountains, setMountains] = useState(session.mountains);
  const [rivers, setRivers] = useState(session.rivers);
  const [frame, setFrame] = useState<WorldFrame | null>(null);
  const [target, setTarget] = useState<GazetteerPlace | null>(null);
  const [place, setPlace] = useState(session.place);
  const [placeBounds, setPlaceBounds] = useState(session.placeBounds);
  const [extras, setExtras] = useState(session.extras);
  const [outlines, setOutlines] = useState<Record<string, number[][]> | null>(
    null,
  );
  const selecting = useRef<GazetteerPlace | null>(null);
  const [job, setJob] = useState<WorldMapJob | null>(null);
  const [progress, setProgress] = useState<WorldMapProgress | null>(null);
  const [error, setError] = useState('');
  const [mapError, setMapError] = useState('');
  const [collapsed, setCollapsed] = useState(session.collapsed);
  const [locating, setLocating] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [index, setIndex] = useState<GazetteerIndex | null>(null);
  const [searchKey, setSearchKey] = useState(0);

  useEffect(() => {
    Object.assign(session, {
      size,
      aspect,
      detail,
      seas,
      timed,
      mountains,
      rivers,
      place,
      placeBounds,
      extras,
      collapsed,
    });
  });

  useEffect(() => {
    loadOutlines()
      .then(setOutlines)
      .catch(() => setOutlines({}));
  }, []);

  useEffect(() => {
    loadGazetteer()
      .then(setIndex)
      .catch(() => setIndex([]));
  }, []);

  useEffect(() => () => job?.cancel(), [job]);

  const image = mapImageSize(size, aspect);
  const available = frame ? availableDetails(frame, size, aspect) : [];
  const chosenDetail =
    detail === 'auto' || available.includes(detail) ? detail : 'auto';
  const problem = frameProblem(frame);
  const selected = useMemo(
    () => (place ? [place, ...extras] : []),
    [place, extras],
  );
  const focusActive =
    !!place &&
    !!placeBounds &&
    !!frame &&
    (placeInFrame(placeBounds, frame, false) ||
      extras.some((extra) => placeInFrame(extra.bounds, frame, false)));
  const focusPlaces = focusActive
    ? selected.filter((one) => FOCUSABLE_KINDS.includes(one.kind))
    : [];
  const highlights = useMemo(
    () => (focusActive ? selected : []),
    [focusActive, selected],
  );
  const choices = useMemo<PlaceChoice[]>(() => {
    if (job || !index || !outlines || !frame) return [];
    const view = lonLatBounds(frame);
    if (!focusActive) {
      for (const kind of PLACE_KINDS) {
        const whole = nearbyPlaces(index, kind, view, outlines, (one) =>
          mostlyVisible(one.bounds, frame),
        );
        if (whole.length > 0)
          return whole.map((nearby) => ({ ...nearby, added: false }));
      }
      return nearbyPlaces(index, viewKind(view), view, outlines, (one) =>
        placeInFrame(one.bounds, frame, true),
      ).map((nearby) => ({ ...nearby, added: false }));
    }
    if (!place) return [];
    const selectedIds = new Set(selected.map((one) => one.id));
    return [
      ...nearbyPlaces(
        index,
        [...PLACE_KINDS, METRO_KIND].includes(place.kind)
          ? place.kind
          : viewKind(view),
        view,
        outlines,
        (one) => !selectedIds.has(one.id),
      ).map((nearby) => ({ ...nearby, added: false })),
      ...selected.map((one) => ({
        place: one,
        point: labelPoint(one, outlines),
        added: true,
      })),
    ];
  }, [focusActive, job, index, outlines, frame, place, selected]);

  function select(chosen: GazetteerPlace, fly: boolean) {
    selecting.current = chosen;
    setLocating(true);
    loadFrameBounds(chosen).then((bounds) => {
      if (selecting.current !== chosen) return;
      setLocating(false);
      if (fly) {
        setAspect(bestAspect(bounds, session.view.bearing));
        setTarget({ ...chosen, bounds });
      }
      setPlace(chosen);
      setPlaceBounds(bounds);
      setExtras([]);
    });
  }

  function removePlace(removed: GazetteerPlace) {
    if (removed.id !== place?.id) {
      setExtras((current) => current.filter((one) => one.id !== removed.id));
      return;
    }
    const [next, ...rest] = extras;
    if (!next) {
      setPlace(null);
      return;
    }
    selecting.current = next;
    setLocating(true);
    loadFrameBounds(next).then((bounds) => {
      if (selecting.current !== next) return;
      setLocating(false);
      setPlace(next);
      setPlaceBounds(bounds);
      setExtras(rest);
    });
  }

  function addDrawn(ring: number[]) {
    const area = drawnArea(ring);
    setDrawing(false);
    if (focusActive) {
      setExtras((current) => [...current, area]);
      return;
    }
    selecting.current = area;
    setLocating(false);
    setPlace(area);
    setPlaceBounds(area.bounds);
    setExtras([]);
  }

  function toggleChoice(chosen: GazetteerPlace) {
    if (!focusActive) select(chosen, false);
    else if (selected.some((one) => one.id === chosen.id)) removePlace(chosen);
    else setExtras((current) => [...current, chosen]);
  }

  function generate() {
    if (!frame || problem || job) return;
    setError('');
    setProgress(null);
    const next = generateWorldMap(
      Promise.all(
        focusPlaces.map((one) =>
          loadFocusRings(one).then((rings) => focusOf(one, rings)),
        ),
      ).then((focus) => ({
        type: 'map',
        frame,
        size,
        aspect,
        detail: chosenDetail,
        seas,
        timed,
        mountains,
        rivers,
        name:
          focus.length > 0 && place && place.kind !== DRAWN_KIND
            ? place.name
            : '',
        focus,
        cities: index ? citiesIn(index, lonLatBounds(frame)) : [],
      })),
      setProgress,
    );
    setJob(next);
    next.promise
      .then((map) => {
        setJob(null);
        onGenerated(map);
        onHide();
      })
      .catch((e: Error) => {
        setJob(null);
        setProgress(null);
        if (e.message !== 'cancelled')
          setError(
            ERROR_TEXT[e.message] ??
              `Could not build a map from this area (${e.message}). Check your connection and try again.`,
          );
      });
  }

  return (
    <Modal show onHide={onHide} fullscreen>
      <Modal.Body className="p-0 position-relative">
        <WorldMap
          aspect={image.width / image.height}
          rightInset={collapsed ? 0 : PANEL_INSET}
          target={target}
          highlights={highlights}
          choices={choices}
          onToggleChoice={toggleChoice}
          drawing={drawing && !job}
          onToggleDrawing={job ? undefined : () => setDrawing((on) => !on)}
          onDrawn={addDrawn}
          initialView={session.view}
          onFrameChange={setFrame}
          onViewChange={(view) => {
            session.view = view;
          }}
          onError={setMapError}
        />
        {collapsed ? (
          <Button
            variant="secondary"
            size="sm"
            className="position-absolute top-0 end-0 m-2 z-2"
            onClick={() => setCollapsed(false)}
          >
            ☰
          </Button>
        ) : (
          <div
            className="position-absolute top-0 end-0 bg-body bg-opacity-75 border rounded p-3 m-2 d-flex flex-column gap-2 overflow-y-auto overflow-x-hidden no-scrollbar z-2"
            style={{
              width: `min(${PANEL_WIDTH}px, calc(100vw - 1rem))`,
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
              className="fw-bold text-center"
            >
              Earth
            </div>
            <SearchBox
              key={searchKey}
              initialQuery={place?.name ?? ''}
              onSelect={(chosen) => select(chosen, true)}
            />
            {drawing && !job && (
              <div className="small text-muted">
                Drag on the map to outline an area.
              </div>
            )}
            {locating && (
              <div className="small text-muted">Finding the borders…</div>
            )}
            {focusPlaces.length > 0 && (
              <div className="badge text-bg-primary text-wrap d-flex align-items-center justify-content-between gap-2">
                Only {focusLabel(focusPlaces.map((one) => one.name))}
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  aria-label="Include the surroundings"
                  disabled={!!job}
                  onClick={() => {
                    setPlace(null);
                    setExtras([]);
                    setSearchKey((key) => key + 1);
                  }}
                />
              </div>
            )}
            <Form.Group className="d-flex align-items-center gap-2">
              <Form.Label className="small mb-0" style={{ minWidth: 45 }}>
                Size
              </Form.Label>
              <Form.Select
                size="sm"
                value={size}
                disabled={!!job}
                onChange={(e) => setSize(e.target.value as MapSize)}
              >
                {SIZES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Form.Select>
              <Form.Select
                size="sm"
                className="w-auto"
                value={aspect}
                disabled={!!job}
                onChange={(e) => setAspect(e.target.value as MapAspect)}
              >
                {ASPECTS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="d-flex align-items-center gap-2">
              <Form.Label className="small mb-0" style={{ minWidth: 45 }}>
                Detail
              </Form.Label>
              <Form.Select
                size="sm"
                value={chosenDetail}
                disabled={!!job}
                onChange={(e) => setDetail(e.target.value as OsmDetail)}
              >
                {(Object.keys(DETAIL_LABELS) as OsmDetail[]).map((value) => (
                  <option
                    key={value}
                    value={value}
                    disabled={value !== 'auto' && !available.includes(value)}
                  >
                    {DETAIL_LABELS[value]}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <div className="d-flex align-items-center gap-2">
              <Form.Check
                type="checkbox"
                label="Seas"
                checked={seas}
                disabled={!!job}
                onChange={(e) => setSeas(e.target.checked)}
              />
              <Help>{SEAS_HELP}</Help>
            </div>
            <div className="d-flex align-items-center gap-2">
              <Form.Check
                type="checkbox"
                label="Timed connections"
                checked={timed}
                disabled={!!job}
                onChange={(e) => setTimed(e.target.checked)}
              />
              <Help>{TIMED_CONNECTIONS_HELP}</Help>
            </div>
            <div className="d-flex align-items-center gap-2">
              <Form.Check
                type="checkbox"
                label="Mountains"
                checked={mountains}
                disabled={!!job}
                onChange={(e) => setMountains(e.target.checked)}
              />
              <Help>{EARTH_MOUNTAINS_HELP}</Help>
            </div>
            <div className="d-flex align-items-center gap-2">
              <Form.Check
                type="checkbox"
                label="Rivers"
                checked={rivers}
                disabled={!!job}
                onChange={(e) => setRivers(e.target.checked)}
              />
              <Help>{EARTH_RIVERS_HELP}</Help>
            </div>
            {job && (
              <>
                <span className="small">{progressText(progress)}</span>
                <ProgressBar
                  now={
                    progress?.stage === 'download'
                      ? (progress.done / Math.max(1, progress.total)) * 100
                      : 100
                  }
                  animated={progress?.stage !== 'download'}
                />
              </>
            )}
            {(error || mapError || problem) && (
              <div
                className={`small ${error || mapError ? 'text-danger' : 'text-muted'}`}
              >
                {error || mapError || problem}
              </div>
            )}
            <div className="d-flex gap-2">
              <Button
                size="sm"
                className="w-100"
                onClick={generate}
                disabled={!!problem || !!job}
              >
                {job ? 'Generating…' : 'Generate'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="w-100"
                onClick={job ? job.cancel : onHide}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
        <div
          className="position-absolute bottom-0 end-0 m-2 px-2 bg-body bg-opacity-75 rounded small text-muted text-end z-1"
          style={{ maxWidth: 'calc(100% - 1rem)' }}
        >
          {CREDITS}
        </div>
      </Modal.Body>
    </Modal>
  );
}

export default WorldMapModal;
