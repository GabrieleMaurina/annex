import Callout from '../../parts/Callout';
import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function SecretGoals() {
  return (
    <>
      <p>
        At the start, every player is secretly given one goal. Completing it
        wins the game on the spot. Your goal is shown only to you: hover the
        target icon in the players panel header to read it. Nobody else can see
        it, and it never changes.
      </p>
      <WikiSection id="mission" title="Mission">
        <p>
          Each player draws one of three kinds of mission, then a specific one.
        </p>
        <WikiTable
          head={['Kind', 'Objective']}
          rows={[
            [
              'Territories',
              'Control half of the map with at least 2 troops on every one of those territories, or three quarters of the map with no troop minimum.',
            ],
            [
              'Continents',
              'Fully own a given set of 2 to 4 continents that together cover at least a quarter of the map. Left out if the map has no such set.',
            ],
            ['Assassinate', 'Eliminate one specific other player.'],
          ]}
        />
      </WikiSection>
      <WikiSection id="assassin" title="Assassin">
        <p>
          Everyone gets the Assassinate mission, each with a different target.
          Kill your target to win. If someone else eliminates your target first,
          your goal becomes controlling three quarters of the map.
        </p>
      </WikiSection>
      <WikiSection id="tips" title="Playing them">
        <ul>
          <li>
            Targets are a ring: nobody targets themselves and no two players
            share a target.
          </li>
          <li>
            You do not know who hunts you. Watch who gets close to your
            territory.
          </li>
          <li>
            Fog of war makes both modes much more tense (
            <WikiLink to="advanced/fog" />
            ).
          </li>
        </ul>
        <Callout kind="note">
          Nobody can see another player&apos;s goal until the game is over.
        </Callout>
      </WikiSection>
      <SeeAlso pages={['modes/overview', 'rules/winning', 'modes/scoring']} />
    </>
  );
}

export default SecretGoals;
