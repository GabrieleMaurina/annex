import Callout from '../../parts/Callout';
import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Setup() {
  return (
    <>
      <WikiSection id="start" title="Starting the game">
        <p>
          The host starts the game from the lobby. It needs a map, at least two
          players and, online, at least two humans. Team Deathmatch also needs
          two teams (<WikiLink to="modes/teams" />
          ). Turn order is then randomized, alternating between teams in Team
          Deathmatch.
        </p>
      </WikiSection>
      <WikiSection id="placement" title="Placement">
        <p>
          The Placement setting decides how the map is divided at the start.
        </p>
        <WikiTable
          head={['Placement', 'Territories', 'Starting troops']}
          rows={[
            ['Random', 'Dealt randomly', 'Spread randomly'],
            ['Semi', 'Dealt randomly', 'Players take turns placing them'],
            [
              'Custom',
              'Players take turns claiming one at a time',
              'Players take turns placing them',
            ],
            [
              'Single',
              'Each player claims one territory',
              'All on that territory. The rest start empty.',
            ],
          ]}
        />
        <ul>
          <li>
            With Custom, if there are fewer territories than players, those who
            never get one are eliminated.
          </li>
          <li>
            With Single, every other territory starts empty and can be taken
            without losses. Empty conquests never earn a card.
          </li>
          <li>
            With fog of war, Single picks are blind: choosing a territory
            someone owns is rejected and you pick again.
          </li>
        </ul>
      </WikiSection>
      <WikiSection id="troops" title="Starting troops">
        <p>
          Each player gets Initial Troops for every territory they own, at least
          one on each (3 by default). With Single placement it is the troop
          count of the one territory you claim.
        </p>
      </WikiSection>
      <WikiSection id="capitals" title="Capitals">
        <p>
          In Capitals games every player first places their capitals, taking
          turns around the table. Each capital gets 3 extra troops (
          <WikiLink to="modes/capitals" />
          ). Fog of war starts once capitals are placed.
        </p>
        <Callout kind="tip">
          Choose a capital with few borders. It is the hardest territory to
          defend if surrounded.
        </Callout>
      </WikiSection>
      <SeeAlso pages={['settings/setup', 'rules/turns', 'rules/deploy']} />
    </>
  );
}

export default Setup;
