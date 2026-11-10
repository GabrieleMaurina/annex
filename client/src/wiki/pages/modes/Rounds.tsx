import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';

function Rounds() {
  return (
    <>
      <WikiSection id="rule" title="The rule">
        <p>
          5-Round and 10-Round games end after 5 or 10 full rounds. Whoever
          holds the most territories at that point wins. If someone wipes out
          everyone else sooner, they win sooner.
        </p>
      </WikiSection>
      <WikiSection id="ties" title="Ties">
        <p>
          Players level on territories are separated by players killed, then
          troops killed, then troops gained. Players still holding land when the
          game ends rank between the winner and the eliminated (
          <WikiLink to="rules/winning#ranking" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="play" title="Playing them">
        <ul>
          <li>
            Territories decide the winner, not kills, so expand fast and hold
            what you take.
          </li>
          <li>
            Keep your last turn in mind. The game ends after the last player of
            the last round, so everyone gets the same number of turns.
          </li>
        </ul>
      </WikiSection>
      <SeeAlso
        pages={['modes/overview', 'modes/conquest', 'strategy/basics']}
      />
    </>
  );
}

export default Rounds;
