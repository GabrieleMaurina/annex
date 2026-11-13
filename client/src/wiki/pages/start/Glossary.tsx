import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiTable from '../../parts/WikiTable';

function Glossary() {
  return (
    <>
      <WikiTable
        head={['Term', 'Meaning', 'Page']}
        rows={[
          [
            'Territory',
            'A region of the map. It has an owner and troops.',
            <WikiLink key="a" to="rules/turns" />,
          ],
          [
            'Troops',
            'The units stationed on a territory. A territory always keeps at least one.',
            <WikiLink key="a" to="rules/deploy" />,
          ],
          [
            'Round',
            'One full cycle in which every remaining player takes a turn.',
            <WikiLink key="a" to="rules/turns" />,
          ],
          [
            'Turn',
            'One player acting: deploy, attack, fortify and any extra phases.',
            <WikiLink key="a" to="rules/turns" />,
          ],
          [
            'Phase',
            'A step of a turn, such as Deploy or Attack.',
            <WikiLink key="a" to="rules/turns" />,
          ],
          [
            'Deploy',
            'Place new troops on your territories.',
            <WikiLink key="a" to="rules/deploy" />,
          ],
          [
            'Blitz',
            'An all-out attack resolved in one click.',
            <WikiLink key="a" to="rules/attack" />,
          ],
          [
            'Manual attack',
            'One exchange of dice at a time.',
            <WikiLink key="a" to="rules/attack" />,
          ],
          [
            'Conquer',
            'Defeat the last defender and take the territory.',
            <WikiLink key="a" to="rules/attack" />,
          ],
          [
            'Fortify',
            'Move troops between your own territories.',
            <WikiLink key="a" to="rules/fortify" />,
          ],
          [
            'Card, set',
            'Earned by conquering. Three matching or mixed cards form a set worth troops.',
            <WikiLink key="a" to="rules/cards" />,
          ],
          [
            'Continent',
            'A group of territories that pays a bonus when you hold it all.',
            <WikiLink key="a" to="rules/continents" />,
          ],
          [
            'Capital',
            'A special territory that defends harder and decides some modes.',
            <WikiLink key="a" to="modes/capitals" />,
          ],
          [
            'Elimination',
            'Losing your last territory. You are out of the game.',
            <WikiLink key="a" to="rules/winning" />,
          ],
          [
            'Surrender',
            'Giving up your seat for good.',
            <WikiLink key="a" to="rules/winning" />,
          ],
          [
            'Draw',
            'A game that ends with no winner.',
            <WikiLink key="a" to="rules/winning" />,
          ],
          [
            'Fog of war',
            'Hiding everything outside your view.',
            <WikiLink key="a" to="advanced/fog" />,
          ],
          [
            'Sea, ship',
            'Neutral water that holds fleets which fight and carry troops.',
            <WikiLink key="a" to="advanced/navy" />,
          ],
          [
            'Alliance',
            'A private pact that shares vision and emojis.',
            <WikiLink key="a" to="advanced/alliances" />,
          ],
          [
            'Stack',
            'A large number of troops on one territory.',
            <WikiLink key="a" to="strategy/basics" />,
          ],
          [
            'Entrenchment',
            'Troops spent to give a territory an extra defence die, and an extra attack die if it lasts into your attack phase (a 1 turn entrenchment never does).',
            <WikiLink key="a" to="settings/combat#entrenchments" />,
          ],
          [
            'Portal',
            'A link that connects far apart territories as if they touched.',
            <WikiLink key="a" to="settings/hazards#portals" />,
          ],
          [
            'Radiation',
            'Territories nobody can enter, where troops are destroyed.',
            <WikiLink key="a" to="settings/hazards#radiation" />,
          ],
          [
            'Toxin',
            'Troops spent to wipe a territory and shut it off for a while.',
            <WikiLink key="a" to="settings/hazards#toxins" />,
          ],
          [
            'Nuke',
            'A weapon built over several turns that obliterates a territory.',
            <WikiLink key="a" to="settings/hazards#nukes" />,
          ],
          [
            'Starvation',
            'A penalty that removes troops from oversized stacks.',
            <WikiLink key="a" to="settings/hazards#starvation" />,
          ],
          [
            'Bounty',
            'Extra troops every turn for each player you eliminated.',
            <WikiLink key="a" to="settings/reinforcements#bounties" />,
          ],
          [
            'Supply hub',
            'A territory your troops must connect to when supply lines are on.',
            <WikiLink key="a" to="settings/reinforcements#supply-lines" />,
          ],
          [
            'Hill',
            'A territory that scores points in King of the Hill.',
            <WikiLink key="a" to="modes/scoring" />,
          ],
          [
            'Timed and directional links',
            'Links that open and close, or work one way.',
            <WikiLink key="a" to="maps/features" />,
          ],
          [
            'Switch',
            'A map object that flips a special link for a few troops.',
            <WikiLink key="a" to="maps/features#switches" />,
          ],
          [
            'Unlockable tile',
            'A locked slot you can open and conquer.',
            <WikiLink key="a" to="maps/features#unlockable" />,
          ],
          [
            'Host',
            'The player who created the game and controls its setup.',
            <WikiLink key="a" to="play/lobby" />,
          ],
          [
            'Lobby',
            'The waiting room before a game starts.',
            <WikiLink key="a" to="play/lobby" />,
          ],
          [
            'Spectator',
            'Someone watching without a seat.',
            <WikiLink key="a" to="play/spectating" />,
          ],
          [
            'Bot',
            'A computer player.',
            <WikiLink key="a" to="bots/difficulty" />,
          ],
          [
            'Guest',
            'A player without an account.',
            <WikiLink key="a" to="accounts/guests-and-accounts" />,
          ],
          [
            'Elo',
            'Your skill rating. It sets your rank.',
            <WikiLink key="a" to="ranking/elo" />,
          ],
          [
            'Reputation',
            'A score for good conduct, shown only on profiles.',
            <WikiLink key="a" to="ranking/reputation" />,
          ],
          [
            'Seed',
            'The number that makes a generated map repeatable.',
            <WikiLink key="a" to="maps/generated" />,
          ],
          [
            'Preset',
            'A saved lobby setup.',
            <WikiLink key="a" to="settings/overview" />,
          ],
          [
            'Replay',
            'A saved game you can step through.',
            <WikiLink key="a" to="history/replays" />,
          ],
          [
            'Luck',
            'How far your dice rolls beat or missed expectation.',
            <WikiLink key="a" to="history/results" />,
          ],
        ]}
      />
      <SeeAlso pages={['start/welcome', 'modes/overview']} />
    </>
  );
}

export default Glossary;
