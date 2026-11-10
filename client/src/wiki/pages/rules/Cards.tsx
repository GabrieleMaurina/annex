import Callout from '../../parts/Callout';
import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';

function Cards() {
  return (
    <>
      <WikiSection id="earning" title="Earning cards">
        <p>
          At the end of your turn you receive one random card if you conquered
          at least one territory owned by another player during it. Taking empty
          land, unlocking tiles or claiming a cleared toxin never earns a card.
          Eliminating a player gives you their whole hand.
        </p>
      </WikiSection>
      <WikiSection id="deck" title="The deck">
        <p>
          There is one card per territory plus two wild cards. Each territory
          card has a symbol: Soldier, Humvee or Tank, spread as evenly as the
          territory count allows. Your hand is private, and others only see how
          many cards you hold. Open it with T.
        </p>
      </WikiSection>
      <WikiSection id="sets" title="Playing a set">
        <p>
          A set is three cards of the same symbol, or one of each symbol. A wild
          card stands in for any symbol. Play sets during Deploy. A set gives:
        </p>
        <ul>
          <li>Troops to deploy, set by the Cards setting.</li>
          <li>
            2 extra troops placed directly on every territory pictured on the
            cards that you currently own.
          </li>
        </ul>
        <Callout kind="warning">
          With five or more cards you must play a set before you can leave
          Deploy. Capturing a player&apos;s hand can push you over five in the
          middle of an attack and send you straight back to Deploy.
        </Callout>
      </WikiSection>
      <WikiSection id="values" title="What a set is worth">
        <p>
          The host picks the Cards setting: a fixed value by symbols, a value
          that rises with every set played (shared or per player), or no cards
          at all. Every value and curve is listed in{' '}
          <WikiLink to="settings/reinforcements#cards" />.
        </p>
        <p>
          The panel always shows the value of the next set. Some actions are
          priced in cards: unlocking tiles and toxins cost a share of it (
          <WikiLink to="settings/hazards#toxins" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="timing" title="When to cash in">
        <p>
          Early sets are small and later ones large in the rising modes, so
          waiting can pay off, but a large hand is a target because eliminating
          you hands it to someone else.
        </p>
      </WikiSection>
      <SeeAlso
        pages={[
          'settings/reinforcements#cards',
          'rules/deploy',
          'rules/winning',
        ]}
      />
    </>
  );
}

export default Cards;
