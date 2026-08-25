const SOUND_NAMES = [
  'deploy',
  'select',
  'fortify',
  'explode',
  'entrench',
  'toxins',
  'emoji',
  'start',
  'end',
  'phase',
  'turn',
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
