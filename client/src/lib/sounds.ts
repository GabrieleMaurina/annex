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
];

const audioByName = new Map<string, HTMLAudioElement>();
let muted = false;
let volume = 1;

export function preloadSounds() {
  for (const name of SOUND_NAMES) {
    const audio = new Audio(`/sounds/${name}.mp3`);
    audio.preload = 'auto';
    audio.volume = volume;
    audioByName.set(name, audio);
  }
}

export function playSound(name: string) {
  if (muted) return;
  const audio = audioByName.get(name);
  if (!audio) return;
  audio.currentTime = 0;
  audio.play().catch(() => {});
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
  for (const audio of audioByName.values()) audio.volume = value;
}

const CLICK_SOUND_SELECTOR =
  'button, a, input[type="checkbox"], input[type="radio"], select, [role="button"]';

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
}
