import Callout from '../../parts/Callout';
import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Turns() {
  return (
    <>
      <WikiSection id="order" title="Turn order">
        <p>
          When the host starts the game, the order of play is shuffled (in Team
          Deathmatch it alternates between teams). Players then act one after
          another. One pass through everybody is a <strong>round</strong>, and
          the round counter goes up each time the first player is reached again.
          Eliminated and surrendered players are skipped. In round 1, players
          who move late get a small troop bonus to make up for it, and the first
          three get none. It comes with your first turn&apos;s income, joins
          your starting troops with Custom placement, and goes on your first
          capital in Capitals mode.
        </p>
      </WikiSection>
      <WikiSection id="phases" title="Phases of a turn">
        <WikiTable
          head={['Phase', 'When', 'You can']}
          rows={[
            [
              <WikiLink key="a" to="rules/deploy">
                Deploy
              </WikiLink>,
              'Always',
              'Place new troops, play card sets, buy ships.',
            ],
            [
              <WikiLink key="a" to="advanced/navy">
                Sail
              </WikiLink>,
              'Maps with seas, if you own ships',
              'Move your fleets between seas.',
            ],
            [
              <WikiLink key="a" to="rules/attack">
                Attack
              </WikiLink>,
              'Always',
              'Attack as often as you like, or not at all.',
            ],
            [
              <WikiLink key="a" to="rules/fortify">
                Fortify
              </WikiLink>,
              'Always',
              'Move troops between your territories.',
            ],
            [
              <WikiLink key="a" to="settings/combat#entrenchments">
                Entrench
              </WikiLink>,
              'Entrenchments on',
              'Spend troops to harden a territory.',
            ],
            [
              <WikiLink key="a" to="settings/hazards#toxins">
                Toxins
              </WikiLink>,
              'Toxins on',
              'Spend troops to release a toxin.',
            ],
          ]}
        />
        <p>
          Press Tab or the next-phase button to move on. A phase with nothing to
          do is skipped automatically. Finishing the last phase ends your turn.
        </p>
        <Callout kind="note">
          After Deploy ends you usually cannot return to it. The exception is
          capturing enough cards to reach five, which sends you back to Deploy
          to play a set (<WikiLink to="rules/cards" />
          ).
        </Callout>
      </WikiSection>
      <WikiSection id="timer" title="The turn timer">
        <p>
          Each turn has a time limit, set by the host (30 seconds to 5 minutes,
          2 minutes by default). When time runs out the game finishes the turn
          for you: leftover troops land on random territories, a pending troop
          move is completed automatically, and play passes on. During setup,
          picks are quick: 10 seconds for each territory claim or troop
          placement, and 60 seconds for a capital or a Single placement pick.
        </p>
        <ul>
          <li>
            <WikiLink to="settings/session#attack-increment">
              Attack increment
            </WikiLink>{' '}
            adds time every time you conquer, up to a 3 minute cap.
          </li>
          <li>
            Eliminating a player who leaves you with five or more cards tops
            your remaining time up to half a turn.
          </li>
          <li>The host can pause an online game once, for up to 60 seconds.</li>
        </ul>
      </WikiSection>
      <WikiSection id="before" title="Before the first turn">
        <p>
          A setup phase hands out territories and troops first (
          <WikiLink to="rules/setup" />
          ). Game end conditions are in <WikiLink to="rules/winning" />.
        </p>
      </WikiSection>
      <SeeAlso
        pages={['start/game-screen', 'settings/session', 'rules/deploy']}
      />
    </>
  );
}

export default Turns;
