import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiTable from '../../parts/WikiTable';

function Personalities() {
  return (
    <>
      <p>
        A personality decides what a bot cares about. Difficulty decides how
        well it carries that out (<WikiLink to="bots/difficulty" />
        ).
      </p>
      <WikiTable
        head={['Personality', 'Style']}
        rows={[
          [
            'Balanced',
            'A blend of Taker, Breaker, Killer and Vengeful. A solid default.',
          ],
          [
            'Taker',
            'Wants continents. Goes after the bonuses it can complete.',
          ],
          [
            'Breaker',
            "Wants to break other players' continents, denying their income.",
          ],
          [
            'Killer',
            'Hunts weak players to eliminate them, builds big stacks and goes after the leader.',
          ],
          [
            'Vengeful',
            'Holds grudges. Whoever attacks it becomes its priority target.',
          ],
          [
            'Defensive',
            'Guards its frontier first and expands carefully. Hard to dislodge, slow to win.',
          ],
          [
            'Erratic',
            'Rolls a random style at the start of the game: a random mix of priorities, or any style here except Defensive. Unpredictable.',
          ],
          [
            'Police',
            'Breaks continents aggressively and goes for the strongest players, keeping leaders in check.',
          ],
          [
            'Hoarder',
            'Piles troops into huge stacks and rarely spends them until it can crush something.',
          ],
          [
            'Opportunist',
            'Picks off weakly held territories, especially ones guarded by a single troop.',
          ],
          ['Random', 'Picks one for you. Revealed when the game ends.'],
        ]}
      />
      <p>
        In a duel, with only two players left, bots play to break the
        opponent&apos;s bonuses and build stacks, according to their personality
        and difficulty.
      </p>
      <SeeAlso pages={['bots/difficulty', 'bots/takeover', 'play/lobby']} />
    </>
  );
}

export default Personalities;
