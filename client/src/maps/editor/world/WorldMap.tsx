import {
  LngLat,
  Map as MapLibre,
  Marker,
  MercatorCoordinate,
  setWorkerUrl,
  type ErrorEvent,
  type GeoJSONSource,
  type MapMouseEvent,
  type MapTouchEvent,
} from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import { Button } from 'react-bootstrap';
import { loadWhiteIcon } from '../../../common/icon';
import WhiteIcon from '../../../common/icons/WhiteIcon';
import { loadOutline, type GazetteerPlace } from './gazetteer';
import type { WorldFrame } from './tileCover';

setWorkerUrl(workerUrl);

const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
const MARGIN = 56;
const QUARTER_TURN = 90;
const MIN_ZOOM = 0;
const MAX_ZOOM = 16;
const FIT_GAP = 0.06;
const MAX_LATITUDE = 85.051129;
const OUTLINE_SOURCE = 'selected-outline';
const DRAFT_SOURCE = 'drawn-draft';
const MIN_DRAW_STEP = 3;
const MIN_DRAWN_POINTS = 3;
const HIGHLIGHT_COLOR = '#ffffff';
const HIGHLIGHT_WIDTH = 3;
const ELLIPSE_POINTS = 64;
const CHOICE_SIZE = '24px';

const NO_HIGHLIGHT: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface EarthView {
  center: [number, number];
  zoom: number;
  bearing: number;
}

export interface PlaceChoice {
  place: GazetteerPlace;
  point: [number, number];
  added: boolean;
}

interface Props {
  aspect: number;
  rightInset: number;
  target: GazetteerPlace | null;
  highlights: GazetteerPlace[];
  choices: PlaceChoice[];
  onToggleChoice: (place: GazetteerPlace) => void;
  drawing: boolean;
  onToggleDrawing?: () => void;
  onDrawn: (ring: number[]) => void;
  initialView: EarthView;
  onFrameChange: (frame: WorldFrame) => void;
  onViewChange: (view: EarthView) => void;
  onError: (message: string) => void;
}

function frameRect(
  width: number,
  height: number,
  aspect: number,
  rightInset: number,
): Rect {
  const inset = rightInset <= width / 2 ? rightInset : 0;
  const availableWidth = Math.max(1, width - inset - MARGIN * 2);
  const availableHeight = Math.max(1, height - MARGIN * 2);
  const frameWidth = Math.min(availableWidth, availableHeight * aspect);
  const frameHeight = frameWidth / aspect;
  return {
    left: MARGIN + (availableWidth - frameWidth) / 2,
    top: MARGIN + (availableHeight - frameHeight) / 2,
    width: frameWidth,
    height: frameHeight,
  };
}

function worldFrame(map: MapLibre, rect: Rect): WorldFrame {
  const corner = (x: number, y: number) =>
    MercatorCoordinate.fromLngLat(map.unproject([x, y]));
  const origin = corner(rect.left, rect.top);
  const right = corner(rect.left + rect.width, rect.top);
  const down = corner(rect.left, rect.top + rect.height);
  return {
    x0: origin.x,
    y0: origin.y,
    ux: right.x - origin.x,
    uy: right.y - origin.y,
    vx: down.x - origin.x,
    vy: down.y - origin.y,
  };
}

function closedRing(ring: number[]): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i < ring.length; i += 2) points.push([ring[i], ring[i + 1]]);
  return [...points, points[0]];
}

function boundsEllipse([w, s, e, n]: GazetteerPlace['bounds']): [
  number,
  number,
][] {
  const points: [number, number][] = [];
  for (let i = 0; i <= ELLIPSE_POINTS; i++) {
    const angle = (i / ELLIPSE_POINTS) * 2 * Math.PI;
    points.push([
      (w + e) / 2 + ((e - w) / 2) * Math.cos(angle),
      (s + n) / 2 + ((n - s) / 2) * Math.sin(angle),
    ]);
  }
  return points;
}

function outlineOf(
  place: GazetteerPlace,
  rings: number[][],
): [number, number][][] {
  return rings.length > 0
    ? rings.map(closedRing)
    : [boundsEllipse(place.bounds)];
}

function highlightOf(lines: [number, number][][]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'MultiLineString', coordinates: lines },
      },
    ],
  };
}

function choiceButton(
  choice: PlaceChoice,
  onToggle: (place: GazetteerPlace) => void,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `btn btn-sm ${choice.added ? 'btn-light' : 'btn-secondary'} rounded-circle p-0 d-flex align-items-center justify-content-center`;
  button.style.width = CHOICE_SIZE;
  button.style.height = CHOICE_SIZE;
  const icon = document.createElement('img');
  icon.width = 12;
  icon.height = 12;
  icon.alt = '';
  icon.src = choice.added ? '/icons/minus.svg' : '/icons/plus.svg';
  if (!choice.added)
    loadWhiteIcon('/icons/plus.svg').then((src) => {
      icon.src = src;
    });
  button.append(icon);
  button.title = `${choice.added ? 'Remove' : 'Add'} ${choice.place.name}`;
  button.setAttribute('aria-label', button.title);
  button.addEventListener('click', () => onToggle(choice.place));
  return button;
}

function showHighlight(map: MapLibre, highlight: GeoJSON.FeatureCollection) {
  map.getSource<GeoJSONSource>(OUTLINE_SOURCE)?.setData(highlight);
}

function draftOf(points: [number, number][]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features:
      points.length < 2
        ? []
        : [
            {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: points },
            },
          ],
  };
}

function showDraft(map: MapLibre, points: [number, number][]) {
  map.getSource<GeoJSONSource>(DRAFT_SOURCE)?.setData(draftOf(points));
}

function addHighlightLayer(
  map: MapLibre,
  highlight: GeoJSON.FeatureCollection,
) {
  map.addSource(OUTLINE_SOURCE, { type: 'geojson', data: highlight });
  map.addLayer({
    id: OUTLINE_SOURCE,
    type: 'line',
    source: OUTLINE_SOURCE,
    paint: { 'line-color': HIGHLIGHT_COLOR, 'line-width': HIGHLIGHT_WIDTH },
  });
  map.addSource(DRAFT_SOURCE, { type: 'geojson', data: draftOf([]) });
  map.addLayer({
    id: DRAFT_SOURCE,
    type: 'line',
    source: DRAFT_SOURCE,
    paint: {
      'line-color': HIGHLIGHT_COLOR,
      'line-width': HIGHLIGHT_WIDTH,
      'line-dasharray': [2, 1],
    },
  });
}

function nextQuarterTurn(bearing: number): number {
  const normalized = ((Math.round(bearing) % 360) + 360) % 360;
  return ((Math.floor(normalized / QUARTER_TURN) + 1) * QUARTER_TURN) % 360;
}

function WorldMap({
  aspect,
  rightInset,
  target,
  highlights,
  choices,
  onToggleChoice,
  drawing,
  onToggleDrawing,
  onDrawn,
  initialView,
  onFrameChange,
  onViewChange,
  onError,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [bearing, setBearing] = useState(initialView.bearing);
  const initial = useRef(initialView);
  const shownHighlight = useRef(NO_HIGHLIGHT);
  const rect = frameRect(size.width, size.height, aspect, rightInset);
  const latest = useRef({
    rect,
    size,
    onFrameChange,
    onViewChange,
    onError,
    onToggleChoice,
    onDrawn,
  });
  useEffect(() => {
    latest.current = {
      rect,
      size,
      onFrameChange,
      onViewChange,
      onError,
      onToggleChoice,
      onDrawn,
    };
  });

  useEffect(() => {
    const container = containerRef.current!;
    const map = new MapLibre({
      container,
      style: STYLE_URL,
      center: initial.current.center,
      zoom: initial.current.zoom,
      bearing: initial.current.bearing,
      maxZoom: MAX_ZOOM,
      attributionControl: false,
      pitchWithRotate: false,
      touchPitch: false,
      transformConstrain: (lngLat, zoom) => ({
        center: new LngLat(
          lngLat.lng,
          Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, lngLat.lat)),
        ),
        zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)),
      }),
    });
    map.on('load', () => addHighlightLayer(map, shownHighlight.current));
    map.on('rotate', () => setBearing(map.getBearing()));
    const report = () =>
      latest.current.onFrameChange(worldFrame(map, latest.current.rect));
    map.on('load', report);
    map.on('moveend', () => {
      report();
      const { lng, lat } = map.getCenter();
      latest.current.onViewChange({
        center: [lng, lat],
        zoom: map.getZoom(),
        bearing: map.getBearing(),
      });
    });
    const fail = (e: ErrorEvent) =>
      latest.current.onError(e.error?.message ?? 'The map failed to load.');
    map.on('error', fail);
    map.once('load', () => map.off('error', fail));
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
      map.resize();
    });
    observer.observe(container);
    mapRef.current = map;
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (map) latest.current.onFrameChange(worldFrame(map, latest.current.rect));
  }, [rect.left, rect.top, rect.width, rect.height]);

  useEffect(() => {
    let cancelled = false;
    const show = (next: GeoJSON.FeatureCollection) => {
      if (cancelled) return;
      shownHighlight.current = next;
      if (mapRef.current) showHighlight(mapRef.current, next);
    };
    Promise.all(
      highlights.map((place) =>
        loadOutline(place)
          .catch(() => [])
          .then((rings) => outlineOf(place, rings)),
      ),
    ).then((outlines) => show(highlightOf(outlines.flat())));
    return () => {
      cancelled = true;
    };
  }, [highlights]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = choices.map((choice) =>
      new Marker({
        element: choiceButton(choice, (place) =>
          latest.current.onToggleChoice(place),
        ),
      })
        .setLngLat(choice.point)
        .addTo(map),
    );
    return () => markers.forEach((marker) => marker.remove());
  }, [choices]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !drawing) return;
    let points: [number, number][] = [];
    let last: { x: number; y: number } | null = null;
    const add = (event: MapMouseEvent | MapTouchEvent) => {
      if (
        last &&
        Math.hypot(event.point.x - last.x, event.point.y - last.y) <
          MIN_DRAW_STEP
      )
        return;
      last = event.point;
      points.push([event.lngLat.lng, event.lngLat.lat]);
      showDraft(map, points);
    };
    const start = (event: MapMouseEvent | MapTouchEvent) => {
      const { originalEvent } = event;
      if (
        originalEvent instanceof MouseEvent &&
        (originalEvent.button !== 0 || originalEvent.ctrlKey)
      )
        return;
      points = [];
      last = null;
      add(event);
    };
    const move = (event: MapMouseEvent | MapTouchEvent) => {
      if (points.length > 0) add(event);
    };
    const end = () => {
      if (points.length >= MIN_DRAWN_POINTS)
        latest.current.onDrawn(points.flat());
      points = [];
      showDraft(map, points);
    };
    map.dragPan.disable();
    map.touchZoomRotate.disable();
    map.getCanvas().style.cursor = 'crosshair';
    map.on('mousedown', start);
    map.on('mousemove', move);
    map.on('mouseup', end);
    map.on('touchstart', start);
    map.on('touchmove', move);
    map.on('touchend', end);
    return () => {
      map.off('mousedown', start);
      map.off('mousemove', move);
      map.off('mouseup', end);
      map.off('touchstart', start);
      map.off('touchmove', move);
      map.off('touchend', end);
      showDraft(map, []);
      map.getCanvas().style.cursor = '';
      map.touchZoomRotate.enable();
      map.dragPan.enable();
    };
  }, [drawing]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !target) return;
    const { rect: r, size: view } = latest.current;
    const gap = Math.min(r.width, r.height) * FIT_GAP;
    const [w, s, e, n] = target.bounds;
    map.fitBounds(
      [
        [w, s],
        [e, n],
      ],
      {
        padding: {
          left: r.left + gap,
          right: view.width - r.left - r.width + gap,
          top: r.top + gap,
          bottom: view.height - r.top - r.height + gap,
        },
        bearing: map.getBearing(),
        duration: 800,
      },
    );
  }, [target]);

  return (
    <div className="position-absolute top-0 bottom-0 start-0 end-0 overflow-hidden">
      <div ref={containerRef} className="w-100 h-100" />
      <div
        className="position-absolute border border-2 border-light rounded pe-none"
        style={{
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          boxShadow: '0 0 0 100vmax rgba(0, 0, 0, 0.35)',
        }}
      />
      <div className="position-absolute bottom-0 start-0 m-2 d-flex flex-column gap-2">
        <Button
          variant="secondary"
          size="sm"
          aria-label="Rotate the map by 90 degrees"
          onClick={() =>
            mapRef.current?.easeTo({ bearing: nextQuarterTurn(bearing) })
          }
        >
          <span
            className="d-inline-block"
            style={{ transform: `rotate(${-bearing}deg)` }}
          >
            ↑N
          </span>
        </Button>
        <Button
          variant={drawing ? 'primary' : 'secondary'}
          size="sm"
          aria-label="Draw an area"
          title="Draw an area"
          disabled={!onToggleDrawing}
          onClick={onToggleDrawing}
        >
          <WhiteIcon path="/icons/pencil.svg" />
        </Button>
      </div>
    </div>
  );
}

export default WorldMap;
