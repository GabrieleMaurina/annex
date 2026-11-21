import SeeAlso from '../../parts/SeeAlso';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Zombies() {
  return (
    <>
      <WikiSection id="goal" title="The goal">
        <p>
          A zombie horde joins the game as an extra player. It is not on your
          side: it fights everyone. You cannot remove it for good while anyone
          else is still alive, because it comes back. Eliminate every other
          player, then capture every zombie territory to win. If the zombies
          outlast everyone, they win.
        </p>
      </WikiSection>
      <WikiSection id="setup" title="Setup">
        <p>
          Choosing the mode puts the zombies in the first lobby slot. They take
          an open slot, or add one when the lobby is full, always play green,
          and cannot be removed or recolored. The host can only change their
          difficulty. With Random placement they start with a share of the map.
          With any other placement they own nothing while territories and troops
          are placed, then rise at the end of the first round exactly like a
          horde that was wiped out. The zombies play last in every round, after
          all other players.
        </p>
      </WikiSection>
      <WikiSection id="growth" title="How they grow">
        <p>
          Zombies get no bonus troops for territories, continents or capitals,
          and never hold cards. On their first turn they infect one territory of
          every player holding at least two, which keeps its troops and changes
          owner, then add 60% troops there, then attack as usual.
        </p>
        <WikiTable
          head={['Zombie share of all troops', 'Reinforcement each turn']}
          rows={[
            [
              'Under 40%',
              '60% more troops on every territory, then 75%, 90%, 105% and so on up to 150%, then it starts over at 60%.',
            ],
            ['40% to 50%', '3 troops on every territory.'],
            ['50% to 55%', '2 troops on every territory.'],
            ['55% or more', '1 troop on every territory.'],
          ]}
        />
        <p>All zombie territories are reinforced at the same moment.</p>
      </WikiSection>
      <WikiSection id="infections" title="Infections">
        <p>
          From round 8, while the zombies hold under 40% of all troops, they can
          infect one more territory on a turn. The fewer territories they hold,
          the likelier it is. No player is infected twice before everyone has
          been infected once. A horde with no territory left infects at once and
          rises again.
        </p>
      </WikiSection>
      <WikiSection id="attacks" title="How they attack">
        <p>
          A zombie territory only attacks a neighbor holding at most half of its
          own troops. It always picks the biggest such territory first, and
          chooses at random between equals. The biggest zombie stack goes first,
          and the horde keeps attacking after every conquest until nothing is
          left to attack. A stack just under half of a zombie stack is the most
          dangerous place to be.
        </p>
        <p>
          Every conquered territory also gains half of the defenders it held,
          rounded up, so a chain of single troops barely shrinks the stack.
          After a conquest the zombies move in all their troops but what the
          difficulty leaves behind:
        </p>
        <WikiTable
          head={['Difficulty', 'Left behind']}
          rows={[
            ['Hard', '1 troop.'],
            ['Medium', 'A quarter of the stack.'],
            ['Easy', 'Half of the stack.'],
          ]}
        />
        <p>
          When their attacks are over, the zombies even out their troops over
          all their connected territories.
        </p>
      </WikiSection>
      <WikiSection id="dice" title="Dice">
        <p>
          Zombies are weak fighters. They roll one attack die fewer than normal,
          and when you attack them, ties go to you whatever Dice Ties says.
        </p>
      </WikiSection>
      <SeeAlso pages={['modes/overview', 'settings/setup']} />
    </>
  );
}

export default Zombies;
