import { useEffect, useState } from 'react';
import { Alert, Button, Container, Table } from 'react-bootstrap';
import PlayerNameEditor from '../common/PlayerNameEditor';
import SettingsMenu from '../common/SettingsMenu';
import Tip from '../common/Tip';
import { useWhiteIcon } from '../common/icon';
import { socket } from '../lib/socket';
import type { Ack, GameSummary, Player } from '../lib/types';

const MAX_GAME_NAME_LENGTH = 20;
const MAX_CREATE_ATTEMPTS = 20;

interface Props {
  player: Player;
  onNameChange: (name: string) => void;
  navigate: (path: string) => void;
  kickedMessage: string;
  clearKickedMessage: () => void;
}

function suggestedGameName(playerName: string, attempt: number): string {
  const base = `Game with ${playerName}`;
  if (attempt === 0) return base;
  const suffix = ` (${attempt})`;
  return base.length + suffix.length > MAX_GAME_NAME_LENGTH
    ? base.slice(0, MAX_GAME_NAME_LENGTH - suffix.length) + suffix
    : base + suffix;
}

function Home({
  player,
  onNameChange,
  navigate,
  kickedMessage,
  clearKickedMessage,
}: Props) {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [error, setError] = useState('');
  const whiteGithubIcon = useWhiteIcon('/icons/github.svg');

  useEffect(() => {
    function onGames(list: GameSummary[]) {
      setGames(list);
    }
    socket.on('home:games', onGames);
    return () => {
      socket.off('home:games', onGames);
    };
  }, []);

  function createGame(attempt = 0) {
    const name =
      attempt === 0 ? undefined : suggestedGameName(player.name, attempt);
    socket.emit('game:create', { name }, (res: Ack) => {
      if (res.ok) navigate(`/${encodeURIComponent(res.game.name)}`);
      else if (
        res.error === 'game name already in use' &&
        attempt < MAX_CREATE_ATTEMPTS
      )
        createGame(attempt + 1);
      else setError(res.error);
    });
  }

  function joinGame(gameName: string) {
    socket.emit('game:join', { gameName }, (res: Ack) => {
      if (res.ok) navigate(`/${encodeURIComponent(res.game.name)}`);
      else setError(res.error);
    });
  }

  return (
    <Container fluid className="pt-3 pb-5 px-4">
      <SettingsMenu shareUrl={window.location.origin} />
      <div className="position-fixed top-0 end-0 m-3" style={{ zIndex: 1 }}>
        <PlayerNameEditor player={player} onNameChange={onNameChange} />
      </div>
      <Tip text="View on GitHub">
        <Button
          variant="secondary"
          size="sm"
          href="https://github.com/GabrieleMaurina/annex"
          target="_blank"
          rel="noreferrer"
          className="position-fixed bottom-0 end-0 m-3"
        >
          <img
            src={whiteGithubIcon ?? '/icons/github.svg'}
            width={16}
            height={16}
            alt="GitHub"
          />
        </Button>
      </Tip>
      <div className="d-flex justify-content-center align-items-center gap-5 mb-4">
        <img src="/favicon.svg" alt="" style={{ height: '4rem' }} />
        <Tip text="/ænˈeks/ (verb) : to take possession of an area of land or a country, usually by force or without permission">
          <h1 className="mb-0">Annex</h1>
        </Tip>
        <img src="/favicon.svg" alt="" style={{ height: '4rem' }} />
      </div>

      {kickedMessage && (
        <Alert variant="warning" dismissible onClose={clearKickedMessage}>
          {kickedMessage}
        </Alert>
      )}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Button className="mb-4" onClick={() => createGame()}>
        Create Game
      </Button>

      <Table striped bordered hover>
        <thead>
          <tr>
            <th>Name</th>
            <th>Map</th>
            <th>Players</th>
            <th>Phase</th>
          </tr>
        </thead>
        <tbody>
          {games.map((g) => {
            const spectateOnly =
              g.state !== 'lobby' || g.playerCount >= g.slots;
            return (
              <tr
                key={g.name}
                onClick={() => joinGame(g.name)}
                className={spectateOnly ? 'text-muted' : undefined}
                style={{ cursor: 'pointer' }}
              >
                <td>{g.name}</td>
                <td>{g.mapName}</td>
                <td>
                  {g.playerCount}/{g.slots}
                  {g.spectatorCount > 0 && ` · ${g.spectatorCount} spectating`}
                </td>
                <td>
                  {g.state === 'lobby'
                    ? 'Lobby'
                    : g.state === 'playing'
                      ? 'Playing'
                      : 'Ended'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Container>
  );
}

export default Home;
