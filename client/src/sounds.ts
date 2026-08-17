const SOUND_NAMES = ['deploy', 'select'];

const audioByName = new Map<string, HTMLAudioElement>();
let muted = false;

export function preloadSounds() {
  for (const name of SOUND_NAMES) {
    const audio = new Audio(`/sounds/${name}.mp3`);
    audio.preload = 'auto';
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

export function toggleSoundMuted() {
  muted = !muted;
  if (muted) {
    for (const audio of audioByName.values()) audio.pause();
  }
}
