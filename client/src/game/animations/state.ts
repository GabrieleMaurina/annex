import { CANVAS_FONT_FAMILY } from '../GameMap/helpers';
import { makeEntrenchParticles } from './entrench';
import { makeExplosionParticles } from './nukes/explosion';
import { type DustPuff, makeUnlockEffect, type RockPiece } from './unlock';

export type AnimationType =
  | 'add'
  | 'remove'
  | 'explosion'
  | 'entrench'
  | 'starve'
  | 'arrow'
  | 'nuke'
  | 'unlock';

export interface Particle {
  angle: number;
  speed: number;
  size: number;
  color?: string;
  kind: 'fire' | 'smoke' | 'spark' | 'dust';
  spin?: number;
  rotation0?: number;
  maxLife?: number;
  vx0?: number;
  vy0?: number;
  jitters?: number[];
}

export interface Animation {
  type: AnimationType;
  x: number;
  y: number;
  startedAt: number;
  label?: string;
  labelColor?: string;
  particles?: Particle[];
  arrowPath?: { x: number; y: number }[][];
  arrowFades?: ('start' | 'end' | undefined)[][];
  fromX?: number;
  fromY?: number;
  intercepted?: boolean;
  interceptFromX?: number;
  interceptFromY?: number;
  tileId?: number;
  points?: [number, number][];
  cracks?: { points: [number, number][]; start: number }[];
  rocks?: RockPiece[];
  dust?: DustPuff[];
}

export const NUKE_FLIGHT_MS = 1200;
export const NUKE_MUSHROOM_MS = 1800;
export const UNLOCK_DELAY_MS = 120;
export const UNLOCK_CRACK_MS = 300;
export const UNLOCK_CRUMBLE_MS = 850;
const UNLOCK_REVEAL_MS = UNLOCK_DELAY_MS + UNLOCK_CRACK_MS;

export const DURATIONS: Record<AnimationType, number> = {
  add: 400,
  remove: 400,
  explosion: 1000,
  entrench: 700,
  starve: 1000,
  arrow: 500,
  nuke: NUKE_FLIGHT_MS + NUKE_MUSHROOM_MS,
  unlock: UNLOCK_DELAY_MS + UNLOCK_CRACK_MS + UNLOCK_CRUMBLE_MS,
};
export const TROOP_CHANGE_RING_COLOR = '255, 255, 255';
const REFERENCE_RADIUS = 20;
const LABEL_DURATION = 1500;
const LABEL_GAP = 8;
const LABEL_RISE = 24;
export const CARD_SET_FLASH_DURATION = 2000;

export function radiusScale(radius: number): number {
  return Math.min(1, radius / REFERENCE_RADIUS);
}

export function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function regularPolygonPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  sides: number,
) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function jaggedPolygonPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  rotation: number,
  jitters: number[],
) {
  ctx.beginPath();
  for (let i = 0; i < jitters.length; i++) {
    const angle = rotation + (i * Math.PI * 2) / jitters.length;
    const px = cx + Math.cos(angle) * r * jitters[i];
    const py = cy + Math.sin(angle) * r * jitters[i];
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function animationLifetime(a: Animation): number {
  return a.label
    ? Math.max(DURATIONS[a.type], LABEL_DURATION)
    : DURATIONS[a.type];
}

let animations: Animation[] = [];
let disabled = false;
let continuousAnimationActive = false;
let portalsActive = false;
let toxinsActive = false;
let radiationActive = false;
let fogActive = false;
let timedLinksActive = false;
const toggleListeners = new Set<() => void>();

export function getAnimations(): readonly Animation[] {
  return animations;
}

export function onAnimationsToggle(listener: () => void): () => void {
  toggleListeners.add(listener);
  return () => toggleListeners.delete(listener);
}

export function startAnimation(
  type: AnimationType,
  x: number,
  y: number,
  label?: string,
  labelColor?: string,
  arrowPath?: { x: number; y: number }[][],
  arrowFades?: ('start' | 'end' | undefined)[][],
) {
  if (disabled) return;
  if (label)
    for (const a of animations)
      if (a.label && a.x === x && a.y === y) a.label = undefined;
  animations.push({
    type,
    x,
    y,
    startedAt: performance.now(),
    label,
    labelColor,
    particles:
      type === 'explosion'
        ? makeExplosionParticles()
        : type === 'entrench'
          ? makeEntrenchParticles()
          : undefined,
    arrowPath,
    arrowFades,
  });
}

export function startNukeAnimation(
  from: { x: number; y: number },
  to: { x: number; y: number },
  intercepted: boolean,
  interceptFrom: { x: number; y: number } | null,
) {
  if (disabled) return;
  animations.push({
    type: 'nuke',
    x: to.x,
    y: to.y,
    fromX: from.x,
    fromY: from.y,
    intercepted,
    interceptFromX: interceptFrom?.x,
    interceptFromY: interceptFrom?.y,
    startedAt: performance.now(),
    particles: makeExplosionParticles(),
  });
}

export function startUnlockAnimation(tile: {
  id: number;
  x: number;
  y: number;
  points: [number, number][];
}) {
  if (disabled) return;
  animations.push({
    type: 'unlock',
    x: tile.x,
    y: tile.y,
    startedAt: performance.now(),
    tileId: tile.id,
    ...makeUnlockEffect(tile),
  });
}

export function crackingTileIds(): Set<number> {
  const now = performance.now();
  return new Set(
    animations
      .filter(
        (a) => a.type === 'unlock' && now - a.startedAt < UNLOCK_REVEAL_MS,
      )
      .map((a) => a.tileId!),
  );
}

export function areAnimationsDisabled(): boolean {
  return disabled;
}

export function setAnimationsDisabled(value: boolean) {
  disabled = value;
  if (disabled) animations = [];
  toggleListeners.forEach((listener) => listener());
}

export function toggleAnimationsDisabled() {
  setAnimationsDisabled(!disabled);
}

export function pruneAnimations() {
  const now = performance.now();
  animations = animations.filter(
    (a) => now - a.startedAt < animationLifetime(a),
  );
}

export function setContinuousAnimation(active: boolean) {
  continuousAnimationActive = active;
}

export function setPortalsActive(active: boolean) {
  portalsActive = active;
}

export function setToxinsActive(active: boolean) {
  toxinsActive = active;
}

export function setRadiationActive(active: boolean) {
  radiationActive = active;
}

export function setFogActive(active: boolean) {
  fogActive = active;
}

export function setTimedLinksActive(active: boolean) {
  timedLinksActive = active;
}

export function hasActiveAnimations(): boolean {
  if (animations.length > 0) return true;
  if (disabled) return false;
  return (
    continuousAnimationActive ||
    portalsActive ||
    toxinsActive ||
    radiationActive ||
    fogActive ||
    timedLinksActive
  );
}

export function getAnimationDuration(type: AnimationType): number {
  return DURATIONS[type];
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

export function drawLabel(
  ctx: CanvasRenderingContext2D,
  a: Animation,
  p: { x: number; y: number },
  radius: number,
  now: number,
) {
  if (!a.label) return;
  const labelProgress = Math.min(1, (now - a.startedAt) / LABEL_DURATION);
  const alpha = 1 - labelProgress;
  const [r, g, b] = hexToRgb(a.labelColor ?? '#ffffff');
  const scale = radiusScale(radius);
  const x = p.x;
  const y = p.y - radius - (LABEL_GAP + labelProgress * LABEL_RISE) * scale;
  ctx.save();
  ctx.font = `bold ${radius}px ${CANVAS_FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = radius * 0.15;
  ctx.strokeStyle = `rgba(0, 0, 0, ${alpha * 0.8})`;
  ctx.strokeText(a.label, x, y);
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
  ctx.fillText(a.label, x, y);
  ctx.restore();
}
