import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';

function Takeover() {
  return (
    <>
      <WikiSection id="when" title="When a bot takes over">
        <p>
          If you disconnect from a running game, close the tab or go to another
          page, a bot takes your seat immediately so the game keeps moving. It
          plays your territories, troops and cards, and it plays for you until
          you return.
        </p>
      </WikiSection>
      <WikiSection id="settings" title="Choosing the bot">
        <p>
          The host sets Disconnect Difficulty and Disconnect Personality in the
          Bots group. Random picks a fresh value at each takeover, and for
          difficulty it can pick Idle, which means your turns are simply skipped
          (<WikiLink to="bots/difficulty" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="return" title="Getting your seat back">
        <p>
          Open the game again with the same login or browser and control returns
          instantly. The takeover bot disappears. While you are away you can be
          surrendered automatically after more than two of your own turns (
          <WikiLink to="play/leaving" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="rating" title="Effect on rating">
        <ul>
          <li>
            Being disconnected at the end, or eliminated while disconnected
            after one of your turns started while away, counts as an abandon and
            costs Elo and reputation (
            <WikiLink to="ranking/elo#penalties" />
            ).
          </li>
          <li>
            A short refresh or drop that ends before your turn does not count.
          </li>
          <li>
            A winner whose seat was held by a takeover bot at the end does not
            earn win achievements.
          </li>
        </ul>
      </WikiSection>
      <WikiSection id="lobby" title="In the lobby">
        <p>
          Bots do not cover lobby seats. A spectator stands in instead, or the
          slot is freed (<WikiLink to="play/join" />
          ).
        </p>
      </WikiSection>
      <SeeAlso
        pages={['settings/players', 'ranking/reputation', 'play/leaving']}
      />
    </>
  );
}

export default Takeover;
