import Callout from '../../parts/Callout';
import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';

function Reputation() {
  return (
    <>
      <WikiSection id="what" title="What reputation is">
        <p>
          Reputation measures how you behave, not how well you play. It is a
          whole number from -100 to 100, starts at 0, and belongs to accounts
          only. Guests have none. It is shown only on a player&apos;s profile,
          never in lobbies, games or results (
          <WikiLink to="accounts/profiles" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="gains" title="Earning it">
        <p>
          Finishing rated games without abandoning them raises your reputation a
          little, so it builds up through steady, fair play.
        </p>
      </WikiSection>
      <WikiSection id="losses" title="Losing it">
        <ul>
          <li>
            Abandoning games: disconnecting out of one, or surrendering early (
            <WikiLink to="play/leaving" />
            ).
          </li>
          <li>
            Confirmed reports for collusion, stream sniping, verbal abuse, fake
            botting, stalling, or an offensive picture or profile text (
            <WikiLink to="ranking/reports" />
            ).
          </li>
          <li>Publishing a map that the community marks as dangerous.</li>
          <li>Filing reports without good reason.</li>
        </ul>
        <p>
          Serious offenses cost more than minor ones, and one report alone never
          counts.
        </p>
      </WikiSection>
      <WikiSection id="recovery" title="Recovering">
        <p>
          While your reputation is below 0 it climbs back toward 0 on its own as
          days pass, whether you play or not. From 0 upward, only finishing
          games raises it.
        </p>
      </WikiSection>
      <WikiSection id="allowance" title="New account allowance">
        <p>
          New accounts get a temporary bonus during their first month when
          joining games that have a reputation requirement. It fades day by day
          and never changes the number on your profile. Your own profile shows
          it while it lasts and your reputation is 0 or above.
        </p>
      </WikiSection>
      <WikiSection id="use" title="What it unlocks">
        <ul>
          <li>
            Hosts can set a minimum reputation. Below it you cannot join or even
            spectate that game (
            <WikiLink to="settings/session#requirements" />
            ).
          </li>
          <li>
            If your reputation is low, games you host start with a limit you can
            still meet.
          </li>
        </ul>
        <Callout kind="tip">
          The surest way to rise is to finish your games and play fair.
        </Callout>
      </WikiSection>
      <SeeAlso
        pages={['ranking/reports', 'play/leaving', 'accounts/profiles']}
      />
    </>
  );
}

export default Reputation;
