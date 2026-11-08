import type { GameState } from '../../../lib/types';
import type { EndCard } from '../../endCard/endCard';
import type { ReplayData } from '../replay';
import { planSubframes, type ClipFormat } from './clipFrames';
import { clipSize, createClipSession } from './clipRenderer';
import type { ClipScene } from './clipScene';
import { renderClipAudio } from './output/clipAudio';
import { buildPalette, createGifWriter } from './output/gifWriter';
import { createMp4Writer } from './output/mp4Writer';

export interface ClipRequest {
  scene: ClipScene;
  game: GameState;
  replay: ReplayData;
  indices: number[];
  durations: number[];
  showRound: boolean;
  endCard: EndCard | null;
  animate: boolean;
  sounds: number;
  music: number;
  format: ClipFormat;
}

interface ClipCallbacks {
  onProgress: (done: number, total: number) => void;
  onDone: (blob: Blob) => void;
  onError: (message: string) => void;
}

const GIF_WIDTH = 720;
const MP4_WIDTH = 1280;
const PALETTE_STEPS = 8;
const PALETTE_OFFSETS_MS = [150, 400, 800];
const SLICE_MS = 40;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Export failed.';
}

function sampleSteps(stepCount: number): number[] {
  if (stepCount <= 1) return [0];
  const count = Math.min(PALETTE_STEPS, stepCount - 1);
  return Array.from(
    { length: count },
    (_, i) => 1 + Math.round((i * (stepCount - 2)) / (count - 1 || 1)),
  );
}

function exportGif(
  {
    scene,
    game,
    replay,
    indices,
    durations,
    showRound,
    endCard,
    animate,
  }: ClipRequest,
  { onProgress, onDone, onError }: ClipCallbacks,
  isCancelled: () => boolean,
) {
  const size = clipSize(scene, GIF_WIDTH);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const session = createClipSession(scene, game, replay, canvas, size);
  session.timeline(indices, durations, endCard, animate);
  const plan = planSubframes(
    durations,
    'gif',
    animate,
    endCard ? durations.length - 1 : -1,
  );
  const read = () => ctx.getImageData(0, 0, size.w, size.h);

  function paletteSamples() {
    const samples: ImageData[] = [];
    for (const step of sampleSteps(indices.length)) {
      if (step === 0) {
        session.begin(0, showRound);
        samples.push(read());
        continue;
      }
      session.begin(step - 1, showRound);
      const offsets =
        animate || (endCard && step === indices.length - 1)
          ? PALETTE_OFFSETS_MS
          : [0];
      for (const offset of offsets) {
        session.play(step, offset, showRound);
        samples.push(read());
      }
    }
    return samples;
  }

  function run() {
    const writer = createGifWriter(
      buildPalette(paletteSamples()),
      size.w,
      size.h,
    );
    session.begin(0, showRound);
    let position = 0;

    function step() {
      if (isCancelled()) return;
      try {
        const started = performance.now();
        while (
          position < plan.length &&
          performance.now() - started < SLICE_MS
        ) {
          const frame = plan[position];
          session.play(frame.position, frame.offset, showRound);
          writer.add(read().data, frame.duration);
          position++;
        }
        onProgress(position, plan.length);
        if (position < plan.length) setTimeout(step, 0);
        else onDone(writer.finish());
      } catch (error) {
        onError(errorMessage(error));
      }
    }

    step();
  }

  try {
    run();
  } catch (error) {
    onError(errorMessage(error));
  }
}

function exportMp4(
  {
    scene,
    game,
    replay,
    indices,
    durations,
    showRound,
    endCard,
    animate,
    sounds,
    music,
  }: ClipRequest,
  { onProgress, onDone, onError }: ClipCallbacks,
  isCancelled: () => boolean,
  setCancel: (cancel: () => void) => void,
) {
  const size = clipSize(scene, MP4_WIDTH);
  const canvas = document.createElement('canvas');
  const session = createClipSession(scene, game, replay, canvas, size);
  session.timeline(indices, durations, endCard, animate);
  const plan = planSubframes(
    durations,
    'mp4',
    animate,
    endCard ? durations.length - 1 : -1,
  );

  let cancelWriter = () => {};
  const fail = (error: unknown) => {
    if (isCancelled()) return;
    cancelWriter();
    onError(errorMessage(error));
  };

  const audio =
    sounds > 0 || music > 0
      ? renderClipAudio({ replay, indices, durations, sounds, music })
      : Promise.resolve(null);

  audio
    .then((buffer) => createMp4Writer(canvas, size.w, size.h, buffer))
    .then((writer) => {
      cancelWriter = writer.cancel;
      setCancel(writer.cancel);
      if (isCancelled()) {
        writer.cancel();
        return;
      }

      function step(position: number, timestamp: number) {
        if (isCancelled()) return;
        const frame = plan[position];
        const seconds = frame.duration / 1000;
        try {
          if (position === 0) session.begin(0, showRound);
          session.play(frame.position, frame.offset, showRound);
        } catch (error) {
          fail(error);
          return;
        }
        writer
          .add(timestamp, seconds)
          .then(() => {
            onProgress(position + 1, plan.length);
            if (position + 1 < plan.length)
              setTimeout(() => step(position + 1, timestamp + seconds), 0);
            else writer.finish().then(onDone, fail);
          })
          .catch(fail);
      }

      step(0, 0);
    })
    .catch(fail);
}

export function startClipExport(
  request: ClipRequest,
  callbacks: ClipCallbacks,
): () => void {
  let cancelled = false;
  let cancelWriter = () => {};
  const isCancelled = () => cancelled;
  const guarded: ClipCallbacks = {
    onProgress: (done, total) => {
      if (!cancelled) callbacks.onProgress(done, total);
    },
    onDone: (blob) => {
      if (!cancelled) callbacks.onDone(blob);
    },
    onError: (message) => {
      if (!cancelled) callbacks.onError(message);
    },
  };
  try {
    if (request.format === 'gif') exportGif(request, guarded, isCancelled);
    else
      exportMp4(request, guarded, isCancelled, (cancel) => {
        cancelWriter = cancel;
      });
  } catch (error) {
    guarded.onError(errorMessage(error));
  }
  return () => {
    cancelled = true;
    cancelWriter();
  };
}
