import Callout from '../../parts/Callout';
import SeeAlso from '../../parts/SeeAlso';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Export() {
  return (
    <>
      <WikiSection id="start" title="Making a clip">
        <ol>
          <li>Open a replay and press Export Replay.</li>
          <li>Preview and choose the part to keep.</li>
          <li>Pick the options below and press the export button.</li>
          <li>Wait while the clip is made, then save or share the file.</li>
        </ol>
        <p>
          The clip shows the map exactly as in the replay and is made on your
          own device.
        </p>
      </WikiSection>
      <WikiSection id="options" title="Options">
        <WikiTable
          head={['Option', 'Meaning']}
          rows={[
            [
              'Trim',
              'Drag the two handles to choose the first and last round. A playhead lets you check the result.',
            ],
            [
              'Detail',
              'How many frames to keep: Every round, Every turn or Every move. Every move is suggested.',
            ],
            [
              'Duration',
              'How long the clip lasts. A length is suggested from the frame count.',
            ],
            [
              'Format',
              'GIF or MP4. MP4 needs a browser that supports it and is suggested when available.',
            ],
            ['Show round number', 'Overlays the round on each frame.'],
            [
              'Sounds, Music',
              'Volume of battle sounds and music in MP4 clips. GIF has no audio.',
            ],
          ]}
        />
        <Callout kind="warning">
          A clip holds at most 1000 frames. If you choose too many, trim the
          range or reduce the detail.
        </Callout>
      </WikiSection>
      <WikiSection id="result" title="Getting the file">
        <p>
          When rendering finishes, the file size is shown. Download it, or share
          it directly on devices that support sharing. Files are named after the
          game, for example my-game-replay.mp4.
        </p>
      </WikiSection>
      <SeeAlso pages={['history/replays', 'tools/client-settings']} />
    </>
  );
}

export default Export;
