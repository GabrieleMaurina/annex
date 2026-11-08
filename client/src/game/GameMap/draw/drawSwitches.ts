import type { MapSwitch, SwitchedLink } from '../../../lib/types';
import { animationNow } from '../../animations/clock';
import { areAnimationsDisabled, radiusScale } from '../../animations/state';
import {
  SWITCH_HEIGHT_RADII,
  SWITCH_WIDTH_RADII,
  switchVertexId,
} from '../../switches/switches';
import { STATE_STYLE, type Point } from '../helpers';

const ON_TRACK = [47, 179, 68];
const OFF_TRACK = [92, 99, 112];
const KNOB = '#ffffff';
const OUTLINE = '#000000';
const WIRE = '#ffd43b';
const WIRE_SHADOW = 'rgba(0, 0, 0, 0.75)';
const SLIDE_MS = 300;
const WIRE_DASH_PER_MS = 0.04;
const WIRE_SAG = 0.12;

type NodeState = keyof typeof STATE_STYLE;

interface Slide {
  on: boolean;
  since: number;
  from: number;
}

const slidesByImage = new WeakMap<HTMLImageElement, Map<number, Slide>>();

function slidesOf(image: HTMLImageElement | null): Map<number, Slide> {
  if (!image) return new Map();
  const slides = slidesByImage.get(image) ?? new Map<number, Slide>();
  slidesByImage.set(image, slides);
  return slides;
}

function positionAt(slide: Slide, now: number): number {
  const target = slide.on ? 1 : 0;
  const p = Math.min(1, Math.max(0, now - slide.since) / SLIDE_MS);
  const eased = 1 - (1 - p) ** 3;
  return slide.from + (target - slide.from) * eased;
}

function knobPosition(
  image: HTMLImageElement | null,
  switchId: number,
  on: boolean,
): number {
  if (areAnimationsDisabled()) return on ? 1 : 0;
  const now = animationNow();
  const slides = slidesOf(image);
  const slide = slides.get(switchId);
  if (!slide) {
    slides.set(switchId, { on, since: -Infinity, from: on ? 1 : 0 });
    return on ? 1 : 0;
  }
  if (slide.on !== on) {
    const from = positionAt(slide, now);
    slides.set(switchId, { on, since: now, from });
    return from;
  }
  return positionAt(slide, now);
}

function trackColor(knob: number): string {
  const [r, g, b] = OFF_TRACK.map((off, i) =>
    Math.round(off + (ON_TRACK[i] - off) * knob),
  );
  return `rgb(${r}, ${g}, ${b})`;
}

export function drawSwitchIcon(
  ctx: CanvasRenderingContext2D,
  center: Point,
  width: number,
  knob: number,
  scale: number,
  outline = OUTLINE,
) {
  const height = (width * SWITCH_HEIGHT_RADII) / SWITCH_WIDTH_RADII;
  const left = center.x - width / 2;
  const top = center.y - height / 2;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(left, top, width, height, height / 2);
  ctx.fillStyle = trackColor(knob);
  ctx.fill();
  ctx.lineWidth = 2 * scale;
  ctx.strokeStyle = outline;
  ctx.stroke();
  const knobRadius = height / 2 - 2.5 * scale;
  ctx.beginPath();
  ctx.arc(
    left + height / 2 + knob * (width - height),
    center.y,
    Math.max(1, knobRadius),
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = KNOB;
  ctx.fill();
  ctx.lineWidth = 1.5 * scale;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.restore();
}

function strokeState(
  ctx: CanvasRenderingContext2D,
  center: Point,
  width: number,
  state: NodeState,
  scale: number,
) {
  if (state === 'normal') return;
  const style = STATE_STYLE[state];
  const height = (width * SWITCH_HEIGHT_RADII) / SWITCH_WIDTH_RADII;
  const pad = (style.width / 2 + 1) * scale;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(
    center.x - width / 2 - pad,
    center.y - height / 2 - pad,
    width + pad * 2,
    height + pad * 2,
    height / 2 + pad,
  );
  ctx.lineWidth = style.width * scale;
  ctx.strokeStyle = style.stroke;
  ctx.stroke();
  ctx.restore();
}

export interface SwitchedLinkSpot {
  at: Point;
  control: SwitchedLink;
}

interface SwitchLayer {
  switches: MapSwitch[];
  switchOn: boolean[];
  spots: SwitchedLinkSpot[];
  nodeState: (id: number) => NodeState;
  toScreen: (p: Point) => Point;
  screenRadius: number;
  uiScale: number;
  image: HTMLImageElement | null;
}

function drawWire(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  scale: number,
  now: number,
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const control = {
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2 + Math.hypot(dx, dy) * WIRE_SAG,
  };
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(control.x, control.y, to.x, to.y);
  };
  ctx.save();
  ctx.lineCap = 'round';
  path();
  ctx.lineWidth = 5 * scale;
  ctx.strokeStyle = WIRE_SHADOW;
  ctx.stroke();
  path();
  ctx.setLineDash([8 * scale, 6 * scale]);
  ctx.lineDashOffset = -now * WIRE_DASH_PER_MS * scale;
  ctx.lineWidth = 2.5 * scale;
  ctx.strokeStyle = WIRE;
  ctx.stroke();
  ctx.restore();
}

export function drawSwitches(
  ctx: CanvasRenderingContext2D,
  layer: SwitchLayer,
) {
  const { switches, spots, toScreen, screenRadius, uiScale, nodeState } = layer;
  const iconScale = radiusScale(screenRadius);
  const width = SWITCH_WIDTH_RADII * screenRadius;
  const now = areAnimationsDisabled() ? 0 : animationNow();
  const focusedSwitch = (i: number) => {
    const state = nodeState(switchVertexId(i));
    return state === 'hovered' || state === 'selected';
  };

  for (const spot of spots)
    for (const i of spot.control.switches.filter(focusedSwitch))
      drawWire(ctx, toScreen(switches[i]), spot.at, uiScale, now);

  switches.forEach((s, i) => {
    const center = toScreen(s);
    strokeState(ctx, center, width, nodeState(switchVertexId(i)), uiScale);
    drawSwitchIcon(
      ctx,
      center,
      width,
      knobPosition(layer.image, i, layer.switchOn[i] ?? false),
      iconScale,
    );
  });
}
