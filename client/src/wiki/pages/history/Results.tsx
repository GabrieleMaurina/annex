import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Results() {
  return (
    <>
      <WikiSection id="end" title="The end screen">
        <p>
          When a game ends an animated card announces the winner, then the
          results table opens. Everyone is revealed: names, ranks and flags in
          anonymous games, and bots with their real difficulty and personality.
          Buttons offer Watch Replay, a share link, and in offline games
          Restart. Accounts can like or save the map.
        </p>
      </WikiSection>
      <WikiSection id="table" title="The results table">
        <WikiTable
          head={['Column', 'Meaning']}
          rows={[
            ['#', 'Final position.'],
            [
              'Player',
              'With status icons: bot, muted, eliminated, surrendered, disconnected, and an Elo penalty if one applied.',
            ],
            ['Elo', 'Your new Elo and the change, for rated games.'],
            ['Points', 'Only in points modes.'],
            ['Turns', 'Turns the player took.'],
            ['Players Killed', 'Players eliminated by this player.'],
            [
              'Troops Gained, Killed, Lost',
              'Troops received, enemy troops destroyed, own troops destroyed.',
            ],
            [
              'Territories Conquered, Lost',
              'Territories taken from others, and taken from this player.',
            ],
            ['Capitals Conquered, Lost', 'Only in Capitals mode.'],
            [
              'Cards Gained, Stolen',
              'Cards earned, and cards taken from eliminated players.',
            ],
            ['Sets Played', 'Card sets traded in.'],
            [
              'Sets on 3',
              'Out of the turns that began with exactly three cards, how many had a set you could play. Shown as sets over turns.',
            ],
            [
              'Luck',
              'How the dice treated you. 0% is average, positive is luckier, negative is unluckier.',
            ],
          ]}
        />
        <p>
          Hover a kill count to see who was eliminated. Click a row for actions
          such as add friend, report and block (
          <WikiLink to="ranking/reports" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="luck" title="What luck means">
        <p>
          Luck compares the troops your dice actually won or lost with what was
          expected on average, and turns it into a score from -100% to +100%. It
          is for fun and learning, and does not affect Elo.
        </p>
      </WikiSection>
      <WikiSection id="charts" title="Charts">
        <p>
          The results include charts of how each player changed over time (
          <WikiLink to="history/replays#charts" />
          ).
        </p>
      </WikiSection>
      <SeeAlso pages={['ranking/elo', 'history/replays', 'history/games']} />
    </>
  );
}

export default Results;
