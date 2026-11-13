import Callout from '../../parts/Callout';
import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Attack() {
  return (
    <>
      <WikiSection id="basics" title="Starting an attack">
        <p>
          In the Attack phase, select one of your territories with at least two
          troops, then a neighboring enemy territory. One troop always stays
          behind. Neighbors also include portals, links across water or void,
          and seas bridged by ships (<WikiLink to="maps/features" />,{' '}
          <WikiLink to="advanced/navy" />
          ). You may attack as many times as you want.
        </p>
      </WikiSection>
      <WikiSection id="dice" title="How dice work">
        <ol>
          <li>
            The attacker rolls one die per troop sent, up to Attack Dice (3 by
            default).
          </li>
          <li>
            The defender rolls one die per troop, up to Defence Dice (2 by
            default).
          </li>
          <li>
            Dice are sorted and paired highest with highest, next with next, and
            so on. Unpaired dice do nothing.
          </li>
          <li>
            In each pair the higher die wins and the loser loses one troop. A
            tie goes to the defender unless the host changed Dice Ties.
          </li>
        </ol>
        <p>
          Capitals and entrenched territories defend with one extra die, up to
          10. An entrenched territory also attacks with one extra die, up to 10,
          if its entrenchment is still active when you attack. Dice have 6 sides
          by default; Attack Sides and Defence Sides let the host give each side
          bigger or smaller dice. All of these numbers are settings (
          <WikiLink to="settings/combat" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="types" title="Manual attack and blitz">
        <WikiTable
          head={['Type', 'What happens']}
          rows={[
            [
              'Manual',
              'One exchange of dice per click. You choose how many troops to commit, from 1 up to Attack Dice. Best when you want to stop early.',
            ],
            [
              'Blitz',
              'Fights on its own until one side is out of troops. The panel shows your chances beforehand.',
            ],
          ]}
        />
        <p>
          How a blitz resolves is the Blitz setting: Balanced, True, Fair or
          Off. Off removes blitzing, so every battle is manual (
          <WikiLink to="settings/combat#blitz" />
          ). A failed blitz leaves your attacking territory with one troop.
        </p>
        <Callout kind="tip">
          Right-click a target to blitz it with everything and move all your
          troops in. Middle-click does the same but moves in as few as allowed.
        </Callout>
      </WikiSection>
      <WikiSection id="conquest" title="Conquering">
        <p>
          When the last defender falls the territory is yours. You must move
          troops in: at least as many as you attacked with (up to the attack
          dice), and at most all but one. Territory with no owner is taken
          without a fight.
        </p>
        <ul>
          <li>
            If you took a territory from another player this turn, you earn a
            card when your turn ends. Empty land never counts.
          </li>
          <li>
            Taking a player&apos;s last territory eliminates them, and you take
            their cards (<WikiLink to="rules/winning" />
            ).
          </li>
          <li>
            Capturing a capital can refund the troops it cost (
            <WikiLink to="modes/capitals" />
            ).
          </li>
        </ul>
      </WikiSection>
      <WikiSection id="allies" title="Allies">
        <p>
          An alliance shares vision and emojis only. Allies can still attack
          each other (<WikiLink to="advanced/alliances" />
          ).
        </p>
      </WikiSection>
      <SeeAlso pages={['rules/fortify', 'rules/cards', 'settings/combat']} />
    </>
  );
}

export default Attack;
