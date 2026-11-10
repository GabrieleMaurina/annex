import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Difficulty() {
  return (
    <>
      <WikiSection id="what" title="What bots are">
        <p>
          A bot is a computer player in a seat like any other. It follows the
          same rules and uses the same actions as a human, with no hidden
          shortcuts. Each bot has a difficulty and a personality (
          <WikiLink to="bots/personalities" />
          ). Bots never earn Elo, and a game with only one account is not rated.
        </p>
      </WikiSection>
      <WikiSection id="levels" title="Difficulty levels">
        <WikiTable
          head={['Level', 'Behavior']}
          rows={[
            [
              'Idle',
              'Never acts. Its turns are skipped at once. Turn-boundary effects like starvation and countdowns still apply. A target dummy for practice.',
            ],
            [
              'Easy',
              'Short-sighted and noisy. Plans only a few steps, makes frequent mistakes and does not time its card sets.',
            ],
            [
              'Medium',
              'Plans further ahead, fortifies sensibly and can pursue two objectives at once.',
            ],
            [
              'Hard',
              'Plans deeply, pursues several objectives at once, adapts during its turn, chooses when to cash in cards, and goes for continents and strong positions on purpose. Under fog it remembers what it saw.',
            ],
            [
              'Random',
              'Picks a difficulty for you. The real one is revealed when the game ends.',
            ],
          ]}
        />
      </WikiSection>
      <WikiSection id="setup" title="Adding bots">
        <ul>
          <li>
            The host presses Add Bot in an empty lobby slot, then chooses its
            difficulty and personality in the row (<WikiLink to="play/lobby" />
            ).
          </li>
          <li>
            Online games need at least two humans. A lone human with bots plays
            offline instead (<WikiLink to="play/offline" />
            ).
          </li>
        </ul>
      </WikiSection>
      <WikiSection id="speed" title="Pace">
        <p>
          Bots pause between visible actions so you can follow what they do. The
          host can cycle their speed between slow, medium and fast in the
          players panel. In anonymous games speed stays slow, so bots do not
          stand out.
        </p>
      </WikiSection>
      <SeeAlso
        pages={['bots/personalities', 'bots/takeover', 'start/first-game']}
      />
    </>
  );
}

export default Difficulty;
