import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Stalemate() {
  return (
    <>
      <p>
        Some games never end. These settings turn a hopeless deadlock into a
        draw. A draw has no winner, and every remaining player draws.
        Eliminated, surrendered and disconnected players still lose (
        <WikiLink to="rules/winning#draws" />
        ).
      </p>
      <WikiSection id="limits" title="Limits">
        <WikiTable
          head={['Setting', 'Default', 'Effect']}
          rows={[
            [
              'Max Rounds',
              '1000',
              'Ends in a stalemate when this many full rounds have been played. Range 20 to 5000.',
            ],
            [
              'Max Duration',
              '3 hours',
              'Ends at the end of the current turn after this much play time. Paused time does not count. From 30 minutes to 10 hours.',
            ],
            [
              'Capital Standoff',
              '50',
              'Capitals mode only. Ends if this many rounds pass with no capital changing owner. Range 5 to 5000.',
            ],
          ]}
        />
      </WikiSection>
      <WikiSection id="draw" title="Draw Offer Round">
        <p>
          From this round on (500 by default, range 20 to 5000), a Draw button
          appears next to Surrender. If every remaining human turns it on at the
          same time, the game ends in a draw immediately. Bots never vote, and
          at least two remaining players are needed, so one human and one bot
          can draw.
        </p>
      </WikiSection>
      <WikiSection id="abort" title="Aborting early">
        <p>
          In the first round of an online game a quiet Abort button lets all
          remaining humans cancel the game. It ends as a draw with no Elo,
          reputation, achievements or history. There is no setting for it. It is
          deliberately quiet: no sound or popup, only a small mark next to the
          name of whoever asked.
        </p>
      </WikiSection>
      <SeeAlso pages={['rules/winning', 'modes/capitals', 'ranking/elo']} />
    </>
  );
}

export default Stalemate;
