import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Join() {
  return (
    <>
      <WikiSection id="ways" title="Ways in">
        <ul>
          <li>Click a game in the Open games list.</li>
          <li>
            Press Quick Play (<WikiLink to="play/games-list#quick-play" />
            ).
          </li>
          <li>Open a link someone sent you.</li>
          <li>
            Press Watch on a player&apos;s profile to follow their game (
            <WikiLink to="play/spectating" />
            ).
          </li>
        </ul>
        <p>You can only be in one game at a time.</p>
      </WikiSection>
      <WikiSection id="seat" title="Seat or spectator">
        <p>
          If the game is in the lobby, has a free slot and you meet its
          requirements, you get a seat. Otherwise you join as a spectator.
          Joining never fails just because a game is full, running or over.
        </p>
        <WikiTable
          head={['Situation', 'Result']}
          rows={[
            ['Password set', 'You are asked for it once.'],
            ['Banned by the host', 'You cannot join.'],
            [
              'Reputation below the game minimum',
              'You cannot join or spectate.',
            ],
            ['Rank, games or account age too low', 'You can only spectate.'],
            [
              'A player you blocked, or who blocked you, is inside',
              'The game is unavailable to you.',
            ],
            [
              'Game already started',
              'You spectate. Only those who held a seat can play on.',
            ],
          ]}
        />
      </WikiSection>
      <WikiSection id="queue" title="The spectator queue">
        <p>
          Spectators wait in order. If a seated player disconnects from the
          lobby, the first connected spectator who meets the requirements takes
          the slot as a stand-in. When the original player returns before the
          start, they get the slot back and the stand-in returns to the front of
          the queue (<WikiLink to="play/leaving" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="before" title="Before you sit down">
        <ul>
          <li>Read the settings. Rules vary game to game.</li>
          <li>
            Check Elo penalties for leaving early (<WikiLink to="ranking/elo" />
            ).
          </li>
          <li>
            Pick your color by clicking your row, or leave as assigned (
            <WikiLink to="play/lobby" />
            ).
          </li>
        </ul>
      </WikiSection>
      <SeeAlso
        pages={['settings/session', 'ranking/reports', 'play/spectating']}
      />
    </>
  );
}

export default Join;
