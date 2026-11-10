import Callout from '../../parts/Callout';
import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Winning() {
  return (
    <>
      <WikiSection id="win" title="Winning">
        <p>
          The game mode defines the goal (<WikiLink to="modes/overview" />
          ). Regardless of mode, if everyone else has been eliminated or has
          surrendered, the last player standing wins at once. The exceptions are
          Player Kills and Troop Kills, which then pick the winner by their
          counters.
        </p>
      </WikiSection>
      <WikiSection id="elimination" title="Elimination">
        <p>
          You are eliminated when you lose your last territory, by an attack,
          radiation or a nuke. Your ships vanish with you and the attacker takes
          your cards. Holding ships never keeps you alive. You can keep
          watching.
        </p>
      </WikiSection>
      <WikiSection id="surrender" title="Surrender">
        <p>
          Surrender in the players panel gives up your seat permanently. Your
          territories stay on the board and you are skipped in turn order, but
          you remain a player in the results. You can keep watching.
          Surrendering early costs Elo and reputation (
          <WikiLink to="ranking/elo#penalties" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="early" title="Early win">
        <p>
          If you are the last human left because everyone else surrendered, not
          because you beat them, the game does not end. Your win is locked in:
          nothing that happens afterward can lower it. You may keep playing for
          fun or press the button to end the game.
        </p>
        <Callout kind="note">
          Disconnected players do not count as gone. After more than two of
          their own turns away online they are surrendered automatically.
        </Callout>
      </WikiSection>
      <WikiSection id="draws" title="Draws">
        <WikiTable
          head={['Draw', 'When']}
          rows={[
            [
              'Stalemate',
              'The game reaches Max Rounds or Max Duration, or in Capitals mode no capital changes owner for the Capital Standoff number of rounds.',
            ],
            [
              'Agreed draw',
              'From the Draw Offer Round on, every remaining human toggles the Draw button at the same time. Bots never vote.',
            ],
            [
              'Abort',
              'During round 1 of an online game, every remaining human proposes an abort. It leaves no trace: no Elo, no reputation, no history.',
            ],
          ]}
        />
        <p>
          In a stalemate or agreed draw the remaining players all draw, while
          eliminated, surrendered and disconnected players still lose (
          <WikiLink to="settings/stalemate" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="ranking" title="Final ranking">
        <p>
          Winners rank first. Usually the rest rank in reverse order of when
          they died, so the longest survivor is second. When the game ends while
          others still hold land, those players rank above the dead by
          territories, players killed, troops killed and troops gained. Points
          modes rank by points, Player Kills and Troop Kills by their counter,
          and team games rank teams the same way. In a draw, the drawn players
          rank first. The ranking drives Elo (<WikiLink to="ranking/elo" />
          ).
        </p>
      </WikiSection>
      <SeeAlso pages={['play/leaving', 'history/results', 'modes/overview']} />
    </>
  );
}

export default Winning;
