import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Replays() {
  return (
    <>
      <WikiSection id="open" title="Opening a replay">
        <ul>
          <li>Click a game on the Games page or a profile.</li>
          <li>Press Watch Replay on the end screen.</li>
          <li>
            Share the replay link. Anyone with it can watch (a Share button sits
            in the corner).
          </li>
        </ul>
        <p>
          Replays show the full board with no fog, and every chat message and
          emoji sent. A Results button switches back to the table.
        </p>
      </WikiSection>
      <WikiSection id="controls" title="Controls">
        <WikiTable
          head={['Control', 'Does']}
          rows={[
            ['Play and pause', 'Space, or the play button.'],
            [
              'Step',
              'Left and right arrows, the wheel or dragging the bar move one frame.',
            ],
            ['Ctrl while stepping', 'Move by whole turns.'],
            ['Shift while stepping', 'Move by whole rounds.'],
            ['Jump to start or end', 'The first and last buttons.'],
            ['Speed', 'The speed button cycles playback speed.'],
          ]}
        />
        <p>
          A frame is one deployment, attack or fortify. The bar shows the
          current player, and the logs panel reveals lines in step with the map.
        </p>
      </WikiSection>
      <WikiSection id="charts" title="Charts and heat map">
        <p>
          The stats chart plots each player against time. Switch between Troops,
          Territories, Capitals, Largest Stack, Cards In Hand, Bonuses
          (continents held), Generation (the troops each player received at the
          start of their turn, not counting card sets), ownership, Points,
          kills, troops gained, killed and lost, conquests, cards and sets
          played.
        </p>
        <p>
          Hover a line or area to see which player it belongs to, the round, the
          value, how it changed, the rank and any bot or disconnected status.
          Click to keep the tooltip open, then click the tooltip, press Escape
          or click anywhere else to close it.
        </p>
        <p>
          On the Over time view, a skull marks the moment a player was
          eliminated and a square marks a captured capital, each with a dashed
          vertical line in the player's color. Hover a marker to see who it was
          and, for an elimination, who did it. The Per round view swaps the
          lines for bars: one bar per player for each round, showing how much
          the stat changed during that round.
        </p>
        <p>
          Under the chart, the Troops destroyed table shows how many troops each
          player destroyed of every other player, with each row in its player's
          color and stronger colors for bigger numbers. Hover a cell to see both
          directions.
        </p>
        <p>
          The heat map button on the replay map shades every territory by how
          many attacks happened there, as attacker or defender. Show it for all
          players or for one, to see where the war was fought.
        </p>
      </WikiSection>
      <WikiSection id="more" title="Also from a replay">
        <ul>
          <li>
            Export a clip as a GIF or MP4 (<WikiLink to="history/export" />
            ).
          </li>
          <li>Like the map or save it to your library (accounts).</li>
          <li>
            Players who took part can report others within 24 hours and add
            friends (<WikiLink to="ranking/reports" />
            ).
          </li>
        </ul>
      </WikiSection>
      <SeeAlso
        pages={['history/results', 'tools/shortcuts', 'history/games']}
      />
    </>
  );
}

export default Replays;
