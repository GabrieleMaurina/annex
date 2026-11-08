interface Mp4Writer {
  add: (timestampSeconds: number, durationSeconds: number) => Promise<void>;
  finish: () => Promise<Blob>;
  cancel: () => void;
}

export const MP4_SUPPORTED = typeof VideoEncoder !== 'undefined';

export function createMp4Writer(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  audio: AudioBuffer | null,
): Promise<Mp4Writer> {
  return import('mediabunny').then(
    ({
      AudioBufferSource,
      BufferTarget,
      CanvasSource,
      getFirstEncodableAudioCodec,
      getFirstEncodableVideoCodec,
      Mp4OutputFormat,
      Output,
      QUALITY_HIGH,
    }) => {
      const format = new Mp4OutputFormat();
      return Promise.all([
        getFirstEncodableVideoCodec(format.getSupportedVideoCodecs(), {
          width,
          height,
        }),
        audio
          ? getFirstEncodableAudioCodec(format.getSupportedAudioCodecs(), {
              numberOfChannels: audio.numberOfChannels,
              sampleRate: audio.sampleRate,
            })
          : Promise.resolve(null),
      ]).then(([videoCodec, audioCodec]) => {
        if (!videoCodec)
          throw new Error('This browser cannot encode MP4 video.');
        if (audio && !audioCodec)
          throw new Error('This browser cannot encode MP4 audio.');
        const target = new BufferTarget();
        const output = new Output({ format, target });
        const source = new CanvasSource(canvas, {
          codec: videoCodec,
          quality: QUALITY_HIGH,
        });
        output.addVideoTrack(source);
        const audioSource =
          audio && audioCodec
            ? new AudioBufferSource({
                codec: audioCodec,
                quality: QUALITY_HIGH,
              })
            : null;
        if (audioSource) output.addAudioTrack(audioSource);
        return output.start().then(() => ({
          add: (timestampSeconds, durationSeconds) =>
            source.add(timestampSeconds, durationSeconds),
          finish: () =>
            (audioSource && audio
              ? audioSource.add(audio).then(() => audioSource.close())
              : Promise.resolve()
            )
              .then(() => output.finalize())
              .then(() => new Blob([target.buffer!], { type: 'video/mp4' })),
          cancel: () => {
            output.cancel().catch(() => {});
          },
        }));
      });
    },
  );
}
