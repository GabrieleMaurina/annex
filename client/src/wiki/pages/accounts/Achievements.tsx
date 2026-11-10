import Callout from '../../parts/Callout';
import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Achievements() {
  return (
    <>
      <p>
        Achievements are badges for milestones. They belong to accounts, are
        earned once, and appear on your profile. A toast announces each new one
        on any page.
      </p>
      <WikiSection id="online" title="Online games">
        <WikiTable
          head={['Badge', 'How to earn it']}
          rows={[
            ['First Online', 'Play your first online game.'],
            ['Online Victory', 'Win your first online game.'],
            ['Veteran', 'Play 10 online games.'],
            ['Champion', 'Win 10 online games.'],
            ['Cannon Fodder', 'Be eliminated in 10 online games.'],
            ['Comeback', 'Win after being left with 3 territories.'],
            ['Emperor', 'Receive 30 or more troops at the start of a turn.'],
            ['Conqueror', 'Conquer 100 territories in one game.'],
            ['Killer', 'Eliminate 3 players in one game.'],
            ['Blitzkrieg', 'Conquer 10 territories in one turn.'],
            ['Card Shark', 'Play a card set worth 20 or more troops.'],
            ['Nuclear', 'Launch a nuke.'],
            ['Admiral', 'Sink an enemy fleet.'],
            ['Diplomat', 'Win a game in which you formed an alliance.'],
            [
              'Underdog',
              'Win against a player rated 100 or more Elo above you.',
            ],
            ['Marathon', 'Play a game of 50 or more rounds.'],
          ]}
        />
      </WikiSection>
      <WikiSection id="offline" title="Offline games">
        <p>
          Only two can be earned offline: First Offline for playing an offline
          game and Offline Victory for winning one. In a game with several
          people on one device only the logged-in host seat earns them (
          <WikiLink to="play/offline" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="other" title="Elsewhere">
        <WikiTable
          head={['Badge', 'How to earn it']}
          rows={[
            ['Nerd', 'Complete all eleven tutorials.'],
            ['Cartographer', 'Publish a map.'],
            ['Popular', 'Get 10 likes on one of your maps.'],
          ]}
        />
      </WikiSection>
      <WikiSection id="rules" title="What counts">
        <ul>
          <li>
            A win means being the only winner of a game that was not a draw and
            not Team Deathmatch. A winner whose seat was covered by a bot at the
            end does not count.
          </li>
          <li>
            An online game counts as played once you took at least one of your
            own turns before a bot replaced you.
          </li>
        </ul>
        <Callout kind="note">
          The achievement list can grow over time. Everything here reflects the
          current set.
        </Callout>
      </WikiSection>
      <SeeAlso
        pages={['accounts/profiles', 'start/tutorials', 'maps/library']}
      />
    </>
  );
}

export default Achievements;
