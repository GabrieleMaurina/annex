import { makeEntrenchParticles } from './entrench';
import { makeExplosionParticles } from './explosion';

export type AnimationType =
  'add' | 'remove' | 'explosion' | 'entrench' | 'starve' | 'arrow';

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
}

export const DURATIONS: Record<AnimationType, number> = {
  add: 400,
  remove: 400,
  explosion: 1000,
  entrench: 700,
  starve: 1000,
  arrow: 500,
};
export const TROOP_CHANGE_RING_COLOR = '255, 255, 255';
const LABEL_DURATION = 1500;
export const CARD_SET_FLASH_DURATION = 2000;

export function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
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
  continuousAnimationActive = active && !disabled;
}

export function setPortalsActive(active: boolean) {
  portalsActive = active && !disabled;
}

export function setToxinsActive(active: boolean) {
  toxinsActive = active && !disabled;
}

export function setRadiationActive(active: boolean) {
  radiationActive = active && !disabled;
}

export function setFogActive(active: boolean) {
  fogActive = active && !disabled;
}

export function hasActiveAnimations(): boolean {
  return (
    animations.length > 0 ||
    (continuousAnimationActive && !disabled) ||
    (portalsActive && !disabled) ||
    (toxinsActive && !disabled) ||
    (radiationActive && !disabled) ||
    (fogActive && !disabled)
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
  const x = p.x;
  const y = p.y - radius - 8 - labelProgress * 24;
  ctx.save();
  ctx.font = `bold ${radius}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = Math.max(2, radius * 0.15);
  ctx.strokeStyle = `rgba(0, 0, 0, ${alpha * 0.8})`;
  ctx.strokeText(a.label, x, y);
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
  ctx.fillText(a.label, x, y);
  ctx.restore();
}
