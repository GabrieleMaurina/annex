import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Chat() {
  return (
    <>
      <WikiSection id="chat" title="Game chat">
        <p>
          Press C or use the chat button to open chat in a lobby, a game or an
          end screen. Everyone in the game reads it, players and spectators
          alike. Enter sends. Profanity is filtered. It is recorded in the
          replay (<WikiLink to="history/replays" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="emoji" title="Emoji">
        <p>
          Seated players can send quick emojis from the players panel, the lobby
          roster or the results table: click a player, or the Everyone row, then
          pick one.
        </p>
        <WikiTable
          head={['Emoji', 'Use']}
          rows={[
            [
              '👍 👎 ❤️ 🙂 🙁 😲 ❓ 🙏 🎉',
              'Reactions. Send to one player or everyone.',
            ],
            [
              '⚔️',
              'A threat. It must target one player, and in a game you can also name a territory.',
            ],
          ]}
        />
        <ul>
          <li>
            Spectators can read emojis sent to everyone but cannot send any.
          </li>
          <li>Bots cannot be targeted directly, only included in Everyone.</li>
          <li>
            With alliances on, or in Team Deathmatch, direct emojis go only to
            allies or teammates (<WikiLink to="advanced/alliances" />
            ).
          </li>
        </ul>
      </WikiSection>
      <WikiSection id="mute" title="Muting">
        <p>
          Blocking a player mutes their chat and emojis for you, in anonymous
          games too. Muted players are marked in lists. Replays still record
          everything.
        </p>
      </WikiSection>
      <WikiSection id="conduct" title="Behave">
        <p>
          Verbal abuse and stalling can be reported and cost reputation (
          <WikiLink to="ranking/reports" />
          ).
        </p>
      </WikiSection>
      <SeeAlso
        pages={['social/messages', 'ranking/reports', 'tools/shortcuts']}
      />
    </>
  );
}

export default Chat;
