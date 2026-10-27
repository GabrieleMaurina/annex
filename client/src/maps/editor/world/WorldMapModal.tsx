import {
  mapImageSize,
  type MapAspect,
  type MapSize,
  type OsmDetail,
  type OsmGeneratedMap,
} from 'engine';
import { useEffect, useRef, useState } from 'react';
import { Button, Form, Modal, ProgressBar } from 'react-bootstrap';
import Help from '../../../common/tooltips/Help';
import {
  SEAS_HELP,
  TIMED_CONNECTIONS_HELP,
} from '../../../lobby/settings/settingsHelp';
import {
  citiesIn,
  loadFrameBounds,
  loadGazetteer,
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
import WorldMap, { type EarthView } from './WorldMap';
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

const FOCUSABLE_KINDS = ['country', 'state', 'city'];
const WIDE_FIT_MIN_RATIO = 4 / 3;
const MIN_PLACE_OVERLAP = 0.5;
const MAX_ZOOM_OUT = 3;
const PANEL_WIDTH = 300;
const PANEL_INSET = PANEL_WIDTH + 16;

interface EarthSession {
  size: MapSize;
  aspect: MapAspect;
  detail: OsmDetail;
  seas: boolean;
  timed: boolean;
  place: GazetteerPlace | null;
  placeBounds: GazetteerPlace['bounds'] | null;
  collapsed: boolean;
  view: EarthView;
}

const session: EarthSession = {
  size: 'medium',
  aspect: 'wide',
  detail: 'auto',
  seas: false,
  timed: false,
  place: null,
  placeBounds: null,
  collapsed: false,
  view: { center: [10, 30], zoom: 1.5, bearing: 0 },
};

const CREDITS =
  'Map data © OpenStreetMap contributors · © OpenMapTiles · OpenFreeMap · Search data: GeoNames (CC BY 4.0), Natural Earth';

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

function placeInFrame(
  [w, s, e, n]: GazetteerPlace['bounds'],
  frame: WorldFrame,
): boolean {
  const box = frameBounds(frame);
  const shift = Math.round((box.x0 + box.x1) / 2 - ((w + e) / 2 + 180) / 360);
  const x0 = (w + 180) / 360 + shift;
  const x1 = (e + 180) / 360 + shift;
  const y0 = mercatorY(n);
  const y1 = mercatorY(s);
  const overlap =
    Math.max(0, Math.min(x1, box.x1) - Math.max(x0, box.x0)) *
    Math.max(0, Math.min(y1, box.y1) - Math.max(y0, box.y0));
  const placeArea = (x1 - x0) * (y1 - y0);
  const frameArea = (box.x1 - box.x0) * (box.y1 - box.y0);
  return (
    overlap >= MIN_PLACE_OVERLAP * Math.min(placeArea, frameArea) &&
    box.x1 - box.x0 <= MAX_ZOOM_OUT * (x1 - x0)
  );
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

function focusOf(place: GazetteerPlace): WorldFocus | null {
  if (!FOCUSABLE_KINDS.includes(place.kind)) return null;
  const [w, s, e, n] = place.bounds;
  return {
    id: place.id,
    kind: place.kind,
    name: place.name,
    lon: (w + e) / 2,
    lat: (s + n) / 2,
    population: place.kind === 'city' ? place.rank : 0,
  };
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
  const [frame, setFrame] = useState<WorldFrame | null>(null);
  const [target, setTarget] = useState<GazetteerPlace | null>(null);
  const [place, setPlace] = useState(session.place);
  const [placeBounds, setPlaceBounds] = useState(session.placeBounds);
  const selecting = useRef<GazetteerPlace | null>(null);
  const [job, setJob] = useState<WorldMapJob | null>(null);
  const [progress, setProgress] = useState<WorldMapProgress | null>(null);
  const [error, setError] = useState('');
  const [mapError, setMapError] = useState('');
  const [collapsed, setCollapsed] = useState(session.collapsed);
  const [index, setIndex] = useState<GazetteerIndex | null>(null);

  useEffect(() => {
    Object.assign(session, {
      size,
      aspect,
      detail,
      seas,
      timed,
      place,
      placeBounds,
      collapsed,
    });
  });

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
  const placeInView =
    place && placeBounds && frame && placeInFrame(placeBounds, frame)
      ? place
      : null;
  const focus = placeInView ? focusOf(placeInView) : null;

  function generate() {
    if (!frame || problem || job) return;
    setError('');
    setProgress(null);
    const next = generateWorldMap(
      {
        frame,
        size,
        aspect,
        detail: chosenDetail,
        seas,
        timed,
        name: placeInView?.name ?? '',
        focus,
        cities: index ? citiesIn(index, lonLatBounds(frame)) : [],
      },
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
          highlight={place}
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
              initialQuery={session.place?.name ?? ''}
              onSelect={(selected) => {
                selecting.current = selected;
                loadFrameBounds(selected).then((bounds) => {
                  if (selecting.current !== selected) return;
                  setAspect(bestAspect(bounds, session.view.bearing));
                  setTarget({ ...selected, bounds });
                  setPlace(selected);
                  setPlaceBounds(bounds);
                });
              }}
            />
            {focus && (
              <div className="badge text-bg-primary d-flex align-items-center justify-content-between gap-2">
                Only {focus.name}
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  aria-label="Include the surroundings"
                  disabled={!!job}
                  onClick={() => setPlace(null)}
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
