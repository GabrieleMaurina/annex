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
  'join',
];

declare const __MUSIC_TRACKS__: string[];

const audioByName = new Map<string, HTMLAudioElement>();
let muted = false;
let volume = 0.5;
let effectsVolume = 1;
let musicVolume = 1;
const CLICK_DEDUPE_MS = 120;
let lastClickAt = -Infinity;
const VOLUME_RANGE_DB = 40;
const MUSIC_FADE_MS = 1000;
const MUSIC_FADE_STEP_MS = 50;
const MUSIC_RESTART_S = 3;
const THEMED_TRACK_CHANCE = 0.5;
let musicStarted = false;
let music: HTMLAudioElement | null = null;
let fadingMusic: HTMLAudioElement | null = null;
let fadeTimer: ReturnType<typeof setInterval> | undefined;
const trackHistory: string[] = [];
let historyIndex = -1;
let musicVersion = 0;
const musicListeners = new Set<() => void>();
let musicMapType: string | null = null;
const playedTracks = new Set<string>();

function perceivedVolume(value: number): number {
  if (value === 0) return 0;
  return 10 ** ((VOLUME_RANGE_DB * (value - 1)) / 20);
}

function effectsLevel(): number {
  if (muted) return 0;
  return perceivedVolume(volume) * perceivedVolume(effectsVolume);
}

function musicLevel(): number {
  if (muted) return 0;
  return perceivedVolume(volume) * perceivedVolume(musicVolume);
}

export function preloadSounds() {
  for (const name of SOUND_NAMES) {
    const audio = new Audio(`/sounds/${name}.mp3`);
    audio.preload = 'auto';
    audio.volume = effectsLevel();
    audioByName.set(name, audio);
  }
}

export function playSound(name: string, gain = 1) {
  const level = effectsLevel();
  if (level === 0) return;
  const audio = audioByName.get(name);
  if (!audio) return;
  if (name === 'click') {
    const now = performance.now();
    if (now - lastClickAt < CLICK_DEDUPE_MS) return;
    lastClickAt = now;
  }
  audio.volume = level * gain;
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

function updateEffects() {
  for (const audio of audioByName.values()) audio.volume = effectsLevel();
}

function trackFolder(track: string): string {
  const slash = track.indexOf('/');
  return slash === -1 ? '' : track.slice(0, slash);
}

function pickFrom(pool: string[]): string {
  let fresh = pool.filter((track) => !playedTracks.has(track));
  if (fresh.length === 0) {
    for (const track of pool) playedTracks.delete(track);
    fresh =
      pool.length > 1
        ? pool.filter((track) => track !== trackHistory[historyIndex])
        : pool;
  }
  const track = fresh[Math.floor(Math.random() * fresh.length)];
  playedTracks.add(track);
  return track;
}

function pickTrack(): string {
  const general = __MUSIC_TRACKS__.filter((track) => trackFolder(track) === '');
  const themed = musicMapType
    ? __MUSIC_TRACKS__.filter((track) => trackFolder(track) === musicMapType)
    : [];
  const themedAvailable = themed.some(
    (track) => track !== trackHistory[historyIndex],
  );
  const useThemed =
    themed.length > 0 &&
    (general.length === 0 ||
      (themedAvailable && Math.random() < THEMED_TRACK_CHANCE));
  return pickFrom(useThemed ? themed : general);
}

function playOnNextGesture(audio: HTMLAudioElement) {
  function stopWaiting() {
    document.removeEventListener('click', resume, true);
    document.removeEventListener('keydown', resume, true);
  }
  function resume() {
    if (music === audio) audio.play().then(stopWaiting, () => {});
    else stopWaiting();
  }
  document.addEventListener('click', resume, true);
  document.addEventListener('keydown', resume, true);
}

function notifyMusic() {
  musicVersion += 1;
  musicListeners.forEach((listener) => listener());
}

function playTrack(track: string) {
  const audio = new Audio(`/music/${track}`);
  audio.volume = musicLevel();
  audio.onended = startTrack;
  music = audio;
  notifyMusic();
  audio.play().catch(() => playOnNextGesture(audio));
}

function startTrack() {
  music = null;
  if (musicLevel() === 0) {
    notifyMusic();
    return;
  }
  if (historyIndex === trackHistory.length - 1) trackHistory.push(pickTrack());
  historyIndex += 1;
  playTrack(trackHistory[historyIndex]);
}

function stopMusic() {
  clearInterval(fadeTimer);
  fadeTimer = undefined;
  fadingMusic?.pause();
  fadingMusic = null;
  music?.pause();
  music = null;
  notifyMusic();
}

function updateMusic() {
  const level = musicLevel();
  if (level === 0) stopMusic();
  else if (music) music.volume = level;
  else if (musicStarted && !fadeTimer) startTrack();
}

export function startMusic() {
  musicStarted = true;
  updateMusic();
}

export function changeMusic() {
  if (!musicStarted || fadeTimer) return;
  const audio = music;
  if (!audio) {
    startTrack();
    return;
  }
  music = null;
  fadingMusic = audio;
  audio.onended = null;
  const startVolume = audio.volume;
  const startedAt = performance.now();
  fadeTimer = setInterval(() => {
    const t = Math.min(1, (performance.now() - startedAt) / MUSIC_FADE_MS);
    audio.volume = startVolume * (1 - t);
    if (t < 1) return;
    clearInterval(fadeTimer);
    fadeTimer = undefined;
    audio.pause();
    fadingMusic = null;
    startTrack();
  }, MUSIC_FADE_STEP_MS);
}

export function getCurrentTrack(): string | null {
  return music || fadingMusic ? trackHistory[historyIndex] : null;
}

export function previousTrack() {
  if (music && (music.currentTime > MUSIC_RESTART_S || historyIndex === 0)) {
    music.currentTime = 0;
    return;
  }
  if (historyIndex <= 0) return;
  stopMusic();
  historyIndex -= 1;
  playTrack(trackHistory[historyIndex]);
}

export function nextTrack() {
  stopMusic();
  startTrack();
}

export function getMusicVersion(): number {
  return musicVersion;
}

export function subscribeMusic(listener: () => void): () => void {
  musicListeners.add(listener);
  return () => {
    musicListeners.delete(listener);
  };
}

export function setMusicMapType(type: string | null) {
  musicMapType = type;
}

export function isSoundMuted(): boolean {
  return muted;
}

export function setSoundMuted(value: boolean) {
  muted = value;
  if (muted) {
    for (const audio of audioByName.values()) audio.pause();
  }
  updateMusic();
}

export function toggleSoundMuted() {
  setSoundMuted(!muted);
}

export function getSoundVolume(): number {
  return volume;
}

export function setSoundVolume(value: number) {
  volume = value;
  updateEffects();
  updateMusic();
}

export function getEffectsVolume(): number {
  return effectsVolume;
}

export function setEffectsVolume(value: number) {
  effectsVolume = value;
  updateEffects();
}

export function getMusicVolume(): number {
  return musicVolume;
}

export function setMusicVolume(value: number) {
  musicVolume = value;
  updateMusic();
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
