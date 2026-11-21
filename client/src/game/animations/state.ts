import { CANVAS_FONT_FAMILY } from '../GameMap/helpers';
import { animationNow, atAnimationTime } from './clock';
import { makeEntrenchParticles } from './entrench';
import { makeExplosionParticles } from './nukes/explosion';
import { capturesActive } from './transitions/capture';
import { presenceActive } from './transitions/presence';
import {
  clearShipMoves,
  pruneShipMoves,
  shipMovesActive,
  type ArrowPoint,
} from './transitions/shipMoves';
import { makeUnlockEffect, type DustPuff, type RockPiece } from './unlock';
import { makeZombieParticles } from './zombie/effects';

export type AnimationType =
  | 'add'
  | 'remove'
  | 'explosion'
  | 'entrench'
  | 'starve'
  | 'arrow'
  | 'nuke'
  | 'unlock'
  | 'spawn'
  | 'infect';

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
  arrowPath?: ArrowPoint[][];
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
  spawn: 900,
  infect: 1100,
};
export const TROOP_CHANGE_RING_COLOR = '255, 255, 255';
const REFERENCE_RADIUS = 20;
const LABEL_DURATION = 2000;
const LABEL_FADE_DELAY = 1000;
const LABEL_FONT_SCALE = 1.3;
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
let startDelay = 0;
let continuousAnimationActive = false;
let portalsActive = false;
let toxinsActive = false;
let radiationActive = false;
let fogActive = false;
let timedLinksActive = false;
let endCardActive = false;
let turnStartActive = false;
const toggleListeners = new Set<() => void>();

export function getAnimations(): readonly Animation[] {
  return animations;
}

export function onAnimationsToggle(listener: () => void): () => void {
  toggleListeners.add(listener);
  return () => toggleListeners.delete(listener);
}

export function withAnimationDelay<T>(milliseconds: number, run: () => T): T {
  const saved = startDelay;
  startDelay = milliseconds;
  try {
    return run();
  } finally {
    startDelay = saved;
  }
}

export function startAnimation(
  type: AnimationType,
  x: number,
  y: number,
  label?: string,
  labelColor?: string,
  arrowPath?: ArrowPoint[][],
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
    startedAt: animationNow() + startDelay,
    label,
    labelColor,
    particles:
      type === 'explosion'
        ? makeExplosionParticles()
        : type === 'entrench'
          ? makeEntrenchParticles()
          : type === 'spawn' || type === 'infect'
            ? makeZombieParticles(type)
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
    startedAt: animationNow(),
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
    startedAt: animationNow(),
    tileId: tile.id,
    ...makeUnlockEffect(tile),
  });
}

export function crackingTileIds(): Set<number> {
  const now = animationNow();
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
  if (disabled) {
    animations = [];
    clearShipMoves();
  }
  document.documentElement.classList.toggle('animations-off', value);
  toggleListeners.forEach((listener) => listener());
}

interface AnimationScope {
  animations: Animation[];
}

export function createAnimationScope(): AnimationScope {
  return { animations: [] };
}

export function inAnimationScope<T>(
  scope: AnimationScope,
  milliseconds: number,
  run: () => T,
): T {
  const savedAnimations = animations;
  const savedDisabled = disabled;
  animations = scope.animations;
  disabled = false;
  try {
    return atAnimationTime(milliseconds, run);
  } finally {
    scope.animations = animations;
    animations = savedAnimations;
    disabled = savedDisabled;
  }
}

export function renderStill<T>(draw: () => T): T {
  const savedAnimations = animations;
  const savedDisabled = disabled;
  animations = [];
  disabled = true;
  try {
    return draw();
  } finally {
    animations = savedAnimations;
    disabled = savedDisabled;
  }
}

export function toggleAnimationsDisabled() {
  setAnimationsDisabled(!disabled);
}

export function pruneAnimations() {
  const now = animationNow();
  animations = animations.filter(
    (a) => now - a.startedAt < animationLifetime(a),
  );
  pruneShipMoves();
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

export function setEndCardActive(active: boolean) {
  endCardActive = active;
}

export function setTurnStartActive(active: boolean) {
  turnStartActive = active;
}

export function hasActiveAnimations(): boolean {
  if (animations.length > 0) return true;
  if (disabled) return false;
  if (shipMovesActive()) return true;
  return (
    capturesActive() ||
    presenceActive() ||
    continuousAnimationActive ||
    portalsActive ||
    toxinsActive ||
    radiationActive ||
    fogActive ||
    timedLinksActive ||
    endCardActive ||
    turnStartActive
  );
}

export function getAnimationDuration(type: AnimationType): number {
  return DURATIONS[type];
}

interface LabelSprite {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  baseline: number;
}

const MAX_LABEL_SPRITES = 256;
const labelSprites = new Map<string, LabelSprite>();

function labelSprite(
  text: string,
  color: string,
  radius: number,
  dpr: number,
): LabelSprite {
  const key = `${text}|${color}|${radius}|${dpr}`;
  const cached = labelSprites.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const font = `bold ${radius}px ${CANVAS_FONT_FAMILY}`;
  const lineWidth = radius * 0.15;
  ctx.font = font;
  const metrics = ctx.measureText(text);
  const ascent = metrics.actualBoundingBoxAscent;
  canvas.width = Math.ceil((metrics.width + 2 * lineWidth) * dpr);
  canvas.height = Math.ceil(
    (ascent + metrics.actualBoundingBoxDescent + 2 * lineWidth) * dpr,
  );
  const width = canvas.width / dpr;
  ctx.scale(dpr, dpr);
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.strokeText(text, width / 2, lineWidth + ascent);
  ctx.fillStyle = color;
  ctx.fillText(text, width / 2, lineWidth + ascent);
  if (labelSprites.size >= MAX_LABEL_SPRITES) labelSprites.clear();
  const sprite = {
    canvas,
    width,
    height: canvas.height / dpr,
    baseline: lineWidth + ascent,
  };
  labelSprites.set(key, sprite);
  return sprite;
}

export function drawLabel(
  ctx: CanvasRenderingContext2D,
  a: Animation,
  p: { x: number; y: number },
  radius: number,
  troopFontSize: number,
  now: number,
) {
  if (!a.label) return;
  const elapsed = now - a.startedAt;
  const labelProgress = Math.min(1, elapsed / LABEL_DURATION);
  const fadeProgress = Math.min(
    1,
    Math.max(
      0,
      (elapsed - LABEL_FADE_DELAY) / (LABEL_DURATION - LABEL_FADE_DELAY),
    ),
  );
  const scale = radiusScale(radius);
  const sprite = labelSprite(
    a.label,
    a.labelColor ?? '#ffffff',
    Math.round(troopFontSize * LABEL_FONT_SCALE * 2) / 2,
    ctx.getTransform().a,
  );
  ctx.save();
  ctx.globalAlpha = 1 - fadeProgress;
  ctx.drawImage(
    sprite.canvas,
    p.x - sprite.width / 2,
    p.y -
      radius -
      (LABEL_GAP + labelProgress * LABEL_RISE) * scale -
      sprite.baseline,
    sprite.width,
    sprite.height,
  );
  ctx.restore();
}
