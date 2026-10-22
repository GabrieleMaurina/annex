import { useEffect, useRef } from 'react';

const SOUND_NAMES = [
  'click',
  'deploy',
  'select',
  'fortify',
  'explode',
  'entrench',
  'toxins',
  'radiation',
  'emoji',
  'start',
  'end',
  'phase',
  'turn',
  'bell',
  'dice',
];

const audioByName = new Map<string, HTMLAudioElement>();
let muted = false;
let volume = 1;
const CLICK_DEDUPE_MS = 120;
let lastClickAt = -Infinity;
const VOLUME_RANGE_DB = 40;

function perceivedVolume(): number {
  if (volume === 0) return 0;
  return 10 ** ((VOLUME_RANGE_DB * (volume - 1)) / 20);
}

export function preloadSounds() {
  for (const name of SOUND_NAMES) {
    const audio = new Audio(`/sounds/${name}.mp3`);
    audio.preload = 'auto';
    audio.volume = perceivedVolume();
    audioByName.set(name, audio);
  }
}

export function playSound(name: string, gain = 1) {
  if (muted) return;
  const audio = audioByName.get(name);
  if (!audio) return;
  if (name === 'click') {
    const now = performance.now();
    if (now - lastClickAt < CLICK_DEDUPE_MS) return;
    lastClickAt = now;
  }
  audio.volume = perceivedVolume() * gain;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

export function useToggleSound(value: unknown) {
  const previousRef = useRef(value);
  useEffect(() => {
    if (previousRef.current === value) return;
    previousRef.current = value;
    playSound('click');
  }, [value]);
}

export function isSoundMuted(): boolean {
  return muted;
}

export function setSoundMuted(value: boolean) {
  muted = value;
  if (muted) {
    for (const audio of audioByName.values()) audio.pause();
  }
}

export function toggleSoundMuted() {
  setSoundMuted(!muted);
}

export function getSoundVolume(): number {
  return volume;
}

export function setSoundVolume(value: number) {
  volume = value;
  for (const audio of audioByName.values()) audio.volume = perceivedVolume();
}

const CLICK_SOUND_SELECTOR =
  'button, a, input[type="checkbox"], input[type="radio"], input[type="range"], input[type="color"], select, [role="button"]';
const CHANGE_SOUND_SELECTOR =
  'select, input[type="range"], input[type="color"]';

export function initUiClickSounds() {
  document.addEventListener(
    'click',
    (e) => {
      const target = e.target as HTMLElement | null;
      const el = target?.closest(CLICK_SOUND_SELECTOR);
      if (!el || el.closest('[data-no-click-sound]')) return;
      playSound('click');
    },
    true,
  );
  document.addEventListener(
    'change',
    (e) => {
      const target = e.target as HTMLElement | null;
      if (!target?.matches(CHANGE_SOUND_SELECTOR)) return;
      if (target.closest('[data-no-click-sound]')) return;
      playSound('click');
    },
    true,
  );
  document.addEventListener(
    'input',
    (e) => {
      const target = e.target;
      if (!(target instanceof HTMLInputElement) || target.type !== 'number')
        return;
      if ((e as InputEvent).inputType) return;
      playSound('click');
    },
    true,
  );
}
