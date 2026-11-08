import { exportTrack, perceivedVolume } from '../../../../lib/sounds';
import type { ReplayAnimation } from '../../../../lib/types';
import { frameSounds, type ReplayData } from '../../replay';

const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const MUSIC_FADE_IN_SECONDS = 0.5;
const MUSIC_FADE_OUT_SECONDS = 1.5;
const MAX_SOUND_STEP_SECONDS = 0.12;

interface SoundEvent {
  name: string;
  time: number;
}

interface AudioRequest {
  replay: ReplayData;
  indices: number[];
  durations: number[];
  sounds: number;
  music: number;
}

function animationSound(animation: ReplayAnimation): string | null {
  switch (animation.type) {
    case 'deploy':
    case 'buyShips':
      return 'deploy';
    case 'fortify':
    case 'sail':
      return 'fortify';
    case 'entrench':
      return 'entrench';
    case 'toxins':
      return 'toxins';
    case 'nuke':
    case 'unlock':
      return 'explode';
    case 'switch':
      return 'click';
    case 'attack':
      return animation.defenderId !== undefined ? 'explode' : null;
    case 'attackSea':
      return animation.attackLosses > 0 || animation.defenceLosses > 0
        ? 'explode'
        : null;
    default:
      return null;
  }
}

function soundsBetween(replay: ReplayData, from: number, to: number) {
  const names = new Set<string>();
  for (let i = from; i < to; i++) {
    const own = animationSound(replay.frames[i].animation);
    if (own) names.add(own);
    for (const name of frameSounds(replay, i)) names.add(name);
  }
  return [...names];
}

function soundEvents(
  replay: ReplayData,
  indices: number[],
  durations: number[],
): SoundEvent[] {
  const events: SoundEvent[] = [];
  let frameStart = 0;
  indices.forEach((index, position) => {
    const seconds = durations[position] / 1000;
    if (position > 0) {
      const names = soundsBetween(replay, indices[position - 1], index);
      const step = Math.min(MAX_SOUND_STEP_SECONDS, seconds / names.length);
      names.forEach((name, i) =>
        events.push({ name, time: frameStart + i * step }),
      );
    }
    frameStart += seconds;
  });
  return events;
}

function decode(
  context: OfflineAudioContext,
  url: string,
): Promise<AudioBuffer> {
  return fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error('An audio file failed to load.');
      return response.arrayBuffer();
    })
    .then((data) => context.decodeAudioData(data));
}

export function renderClipAudio({
  replay,
  indices,
  durations,
  sounds,
  music,
}: AudioRequest): Promise<AudioBuffer> {
  const totalSeconds = durations.reduce((sum, d) => sum + d, 0) / 1000;
  const context = new OfflineAudioContext(
    CHANNELS,
    Math.ceil(totalSeconds * SAMPLE_RATE),
    SAMPLE_RATE,
  );
  const events = sounds > 0 ? soundEvents(replay, indices, durations) : [];
  const names = [...new Set(events.map((event) => event.name))];
  const track = music > 0 ? exportTrack() : null;

  return Promise.all([
    Promise.all(
      names.map((name) =>
        decode(context, `/sounds/${name}.mp3`).then(
          (buffer) => [name, buffer] as const,
        ),
      ),
    ),
    track ? decode(context, `/music/${track}`) : Promise.resolve(null),
  ]).then(([effectBuffers, musicBuffer]) => {
    const master = context.createDynamicsCompressor();
    master.connect(context.destination);

    const effects = context.createGain();
    effects.gain.value = perceivedVolume(sounds);
    effects.connect(master);
    const bufferByName = new Map(effectBuffers);
    for (const { name, time } of events) {
      const source = context.createBufferSource();
      source.buffer = bufferByName.get(name)!;
      source.connect(effects);
      source.start(time);
    }

    if (musicBuffer) {
      const fadeIn = Math.min(MUSIC_FADE_IN_SECONDS, totalSeconds / 4);
      const fadeOut = Math.min(MUSIC_FADE_OUT_SECONDS, totalSeconds / 4);
      const musicLevel = perceivedVolume(music);
      const level = context.createGain();
      level.gain.setValueAtTime(0, 0);
      level.gain.linearRampToValueAtTime(musicLevel, fadeIn);
      level.gain.setValueAtTime(musicLevel, totalSeconds - fadeOut);
      level.gain.linearRampToValueAtTime(0, totalSeconds);
      level.connect(master);
      const source = context.createBufferSource();
      source.buffer = musicBuffer;
      source.loop = true;
      source.connect(level);
      source.start(0);
    }

    return context.startRendering();
  });
}
