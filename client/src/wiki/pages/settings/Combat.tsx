import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Combat() {
  return (
    <>
      <WikiSection id="blitz" title="Blitz">
        <p>How an all-out attack resolves a battle instantly.</p>
        <WikiTable
          head={['Value', 'Effect']}
          rows={[
            [
              'Balanced (default)',
              'Outcomes are smoothed. A much bigger army is not guaranteed a clean win, so the underdog keeps a fighting chance.',
            ],
            [
              'True',
              'The exact odds of fighting it out exchange by exchange. A much stronger army almost always wins.',
            ],
            [
              'Fair',
              'No dice. The result is fixed from troop counts and dice settings, equal to the average of a True blitz, so the same attack always costs the same.',
            ],
            [
              'Off',
              'No blitz anywhere, on land or at sea. Every battle is fought by hand.',
            ],
          ]}
        />
        <p>
          Off is only allowed when Round Troops is off, Cards is Constant or
          Off, Troops per Territory is below 1, and Initial Troops and Min
          Troops are at most 10. Otherwise battles would take far too many
          clicks.
        </p>
      </WikiSection>
      <WikiSection id="dice" title="Dice">
        <WikiTable
          head={['Setting', 'Meaning']}
          rows={[
            [
              'Attack Dice',
              'Most dice an attacker rolls per exchange, one per attacking troop or ship. Also the most troops a manual attack can send. 1 to 10, default 3. It cannot be set below Defence Dice.',
            ],
            [
              'Defence Dice',
              'Most dice a defender rolls, capped by its own troops. 1 to 10, default 2, never above Attack Dice. Capitals and entrenched territories roll one extra, up to 10.',
            ],
            [
              'Dice Ties',
              'Who wins equal dice, on land and at sea: Defence (attacker loses a troop, default), Attack (defender loses a troop) or Tie (nobody loses).',
            ],
          ]}
        />
        <p>
          See <WikiLink to="rules/attack" /> for how dice are paired.
        </p>
      </WikiSection>
      <WikiSection id="entrenchments" title="Entrenchments">
        <p>
          Adds a phase after fortifying where you spend troops straight off a
          territory to dig it in. One troop buys one turn of entrenchment, and
          an entrenched territory defends with one extra die, up to 10.
        </p>
        <ul>
          <li>It decreases by 1 at the start of your next turn.</li>
          <li>It is lost if the territory is conquered.</li>
          <li>Capitals cannot be entrenched.</li>
          <li>Only available when Defence Dice is below 10.</li>
        </ul>
      </WikiSection>
      <SeeAlso
        pages={['settings/reinforcements', 'settings/hazards', 'rules/attack']}
      />
    </>
  );
}

export default Combat;
