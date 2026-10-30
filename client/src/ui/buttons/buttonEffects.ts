import { areAnimationsDisabled } from '../../game/animations';

const FX_VARIABLES = ['--button-fx-color', '--button-fx-glow'];
const SPARK_CLASSES = [
  'button-fx-spark-white',
  'button-fx-spark-glow',
  'button-fx-spark-color',
];
const SPARK_COUNT = 14;
const SMOKE_COUNT = 5;
const BURST_DURATION = 1100;
const MAX_JIGGLE_ANGLE = 12;
const JIGGLE_EDGE_SHIFT = 2.5;

let layer: HTMLDivElement | null = null;

function fxLayer(): HTMLDivElement {
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'button-fx-layer';
    document.body.appendChild(layer);
  }
  return layer;
}

function random(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function burst(x: number, y: number, button: HTMLElement) {
  const style = getComputedStyle(button);
  const group = document.createElement('div');
  FX_VARIABLES.forEach((name) =>
    group.style.setProperty(name, style.getPropertyValue(name)),
  );
  fxLayer().appendChild(group);

  function particle(
    className: string,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
  ) {
    const el = document.createElement('div');
    el.className = `button-fx-particle ${className}`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    group.appendChild(el);
    el.animate(keyframes, { ...options, fill: 'forwards' });
  }

  particle(
    'button-fx-ring',
    [
      { transform: 'scale(.2)', opacity: 1 },
      { transform: 'scale(5)', opacity: 0 },
    ],
    { duration: 520, easing: 'cubic-bezier(.1,.7,.3,1)' },
  );
  particle(
    'button-fx-flash',
    [
      { transform: 'scale(.3)', opacity: 1 },
      { transform: 'scale(1.4)', opacity: 0 },
    ],
    { duration: 240, easing: 'ease-out' },
  );
  for (let i = 0; i < SPARK_COUNT; i++) {
    const angle = random(0, Math.PI * 2);
    const distance = random(30, 90);
    particle(
      `button-fx-spark ${SPARK_CLASSES[i % SPARK_CLASSES.length]}`,
      [
        { transform: 'translate(0, 0)', opacity: 1 },
        {
          transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance + 20}px)`,
          opacity: 0,
        },
      ],
      { duration: random(380, 650), easing: 'cubic-bezier(.2,.7,.4,1)' },
    );
  }
  for (let i = 0; i < SMOKE_COUNT; i++) {
    const size = random(0.75, 1.25);
    particle(
      'button-fx-smoke',
      [
        { transform: `scale(${0.4 * size})`, opacity: 0.9 },
        {
          transform: `translate(${random(-30, 30)}px, ${random(-40, -15)}px) scale(${2.2 * size})`,
          opacity: 0,
        },
      ],
      { duration: random(800, BURST_DURATION), easing: 'ease-out' },
    );
  }
  setTimeout(() => group.remove(), BURST_DURATION);
}

function recoil(button: HTMLElement) {
  button.animate(
    [
      { transform: 'translate(0, 0)' },
      { transform: 'translate(-3px, 1.5px)' },
      { transform: 'translate(3px, -1.5px)' },
      { transform: 'translate(-1.8px, -.9px)' },
      { transform: 'translate(1.2px, .6px)' },
      { transform: 'translate(0, 0)' },
    ],
    { duration: 280, composite: 'add' },
  );
}

function jiggle(button: HTMLElement) {
  const angle = Math.min(
    MAX_JIGGLE_ANGLE,
    (Math.atan((2 * JIGGLE_EDGE_SHIFT) / button.offsetWidth) * 180) / Math.PI,
  );
  button.animate(
    [
      { transform: 'rotate(0deg)' },
      { transform: `rotate(${-angle}deg)` },
      { transform: `rotate(${angle * 0.8}deg)` },
      { transform: `rotate(${-angle * 0.45}deg)` },
      { transform: `rotate(${angle * 0.2}deg)` },
      { transform: 'rotate(0deg)' },
    ],
    { duration: 360, easing: 'ease-out', composite: 'add' },
  );
}

function buttonAt(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element
    ? target.closest<HTMLElement>('.btn, .btn-close')
    : null;
}

export function initButtonEffects() {
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse' || areAnimationsDisabled()) return;
    const button = buttonAt(e.target);
    if (!button || button.contains(e.relatedTarget as Node | null)) return;
    jiggle(button);
  });
  document.addEventListener(
    'click',
    (e) => {
      if (areAnimationsDisabled()) return;
      const button = buttonAt(e.target);
      if (!button) return;
      const rect = button.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const fromPointer = e.detail > 0;
      const x = fromPointer ? e.clientX : rect.left + rect.width / 2;
      const y = fromPointer ? e.clientY : rect.top + rect.height / 2;
      burst(x, y, button);
      recoil(button);
    },
    true,
  );
}
