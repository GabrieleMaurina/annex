import Callout from '../../parts/Callout';
import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Overview() {
  return (
    <>
      <WikiSection id="where" title="Where settings live">
        <p>
          The host edits settings in the lobby. Everyone else sees them but
          cannot change them. During a game, press S to review them. Every
          setting has a help icon that explains it, and changed settings are
          highlighted. A badge counts how many differ from the defaults.
        </p>
        <WikiTable
          head={['Group', 'Contains', 'Page']}
          rows={[
            [
              'Setup',
              'Placement, initial troops, fortification, capitals, points',
              <WikiLink key="a" to="settings/setup" />,
            ],
            [
              'Combat',
              'Blitz, dice, ties, entrenchments',
              <WikiLink key="a" to="settings/combat" />,
            ],
            [
              'Reinforcements',
              'Income, continents, cards, bounties, supply lines',
              <WikiLink key="a" to="settings/reinforcements" />,
            ],
            [
              'Hazards',
              'Portals, radiation, nukes, toxins, starvation',
              <WikiLink key="a" to="settings/hazards" />,
            ],
            [
              'Players',
              'Fog of war, alliances, anonymous',
              <WikiLink key="a" to="settings/players" />,
            ],
            [
              'Bots',
              'What bots take over a leaving player',
              <WikiLink key="a" to="bots/takeover" />,
            ],
            [
              'Stalemate Prevention',
              'Round and time limits, draws',
              <WikiLink key="a" to="settings/stalemate" />,
            ],
            [
              'Session',
              'Timer, attack increment, seat requirements',
              <WikiLink key="a" to="settings/session" />,
            ],
          ]}
        />
        <p>
          Game Mode and Map sit above the groups (
          <WikiLink to="modes/overview" />, <WikiLink to="maps/overview" />
          ). Password and Visibility are covered in{' '}
          <WikiLink to="play/create" />.
        </p>
      </WikiSection>
      <WikiSection id="defaults" title="Defaults">
        <p>
          Reset sets every rule back to its default: Supremacy, Balanced blitz,
          3 attack dice, 2 defence dice, ties to the defender, Connected
          fortification, 3 initial troops, 1/3 troop per territory, 3 minimum
          troops, Constant cards, 1x continents, 2 minute turns, and every
          optional feature off.
        </p>
      </WikiSection>
      <WikiSection id="random" title="Randomize">
        <p>
          Randomize rolls a fresh rule set. It favors defaults and stays near
          them, and leaves Anonymous and the Bots, Stalemate Prevention and
          Session groups untouched. A good way to find new ways to play.
        </p>
      </WikiSection>
      <WikiSection id="presets" title="Presets">
        <p>
          Logged-in hosts have five preset slots. A preset stores every setting,
          the open slots, the bots and the map.
        </p>
        <ul>
          <li>
            Click a preset to apply it. Click an empty slot to save into it.
          </li>
          <li>
            Each slot menu offers overwrite, rename, export, import and delete.
            Drag a preset onto another slot to move it.
          </li>
          <li>
            Earth maps are saved as a recipe and rebuilt, so they may differ
            slightly after the map data is updated (<WikiLink to="maps/earth" />
            ).
          </li>
        </ul>
      </WikiSection>
      <WikiSection id="saved" title="Remembered setup">
        <p>
          Your last setup is saved on your account and used as the starting
          point for the next game you create, online or offline. Guests start
          from the defaults every time.
        </p>
      </WikiSection>
      <WikiSection id="conflicts" title="Conflicting settings">
        <p>
          Some switches exclude each other. The conflicting option is greyed out
          while the other is on and is never changed for you.
        </p>
        <ul>
          <li>Alliances and Team Deathmatch.</li>
          <li>
            Blitz Off needs a modest economy (see{' '}
            <WikiLink to="settings/combat#blitz" />
            ).
          </li>
          <li>Defence Dice cannot exceed Attack Dice.</li>
          <li>Entrenchments need Defence Dice below 10.</li>
          <li>
            Switches need timed or directional links, and unlockable tiles need
            a tile map without seas or links (<WikiLink to="maps/features" />
            ).
          </li>
        </ul>
        <Callout kind="note">
          Settings that do not apply to the chosen mode, or to an offline game,
          are hidden.
        </Callout>
      </WikiSection>
      <SeeAlso pages={['play/create', 'play/lobby', 'modes/overview']} />
    </>
  );
}

export default Overview;
