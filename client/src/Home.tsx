import { useEffect, useState } from 'react';
import { Alert, Button, Container, Table } from 'react-bootstrap';
import PlayerNameEditor from './PlayerNameEditor';
import { socket } from './socket';
import type { Ack, GameSummary, Player } from './types';

interface Props {
  player: Player;
  onNameChange: (name: string) => void;
  navigate: (path: string) => void;
  kickedMessage: string;
  clearKickedMessage: () => void;
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

  useEffect(() => {
    function onGames(list: GameSummary[]) {
      setGames(list);
    }
    socket.on('home:games', onGames);
    return () => {
      socket.off('home:games', onGames);
    };
  }, []);

  function createGame() {
    socket.emit('game:create', (res: Ack) => {
      if (res.ok) navigate(`/${encodeURIComponent(res.game.name)}`);
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
    <Container fluid className="py-5 px-4">
      <div className="d-flex align-items-center mb-4">
        <div
          className="flex-grow-1"
          style={{ flexBasis: 0, minWidth: 0 }}
        ></div>
        <div className="d-flex align-items-center gap-5">
          <img src="/favicon.svg" alt="" style={{ height: '4rem' }} />
          <h1 className="mb-0">Annex</h1>
          <img src="/favicon.svg" alt="" style={{ height: '4rem' }} />
        </div>
        <div
          className="d-flex justify-content-end flex-grow-1"
          style={{ flexBasis: 0, minWidth: 0 }}
        >
          <PlayerNameEditor player={player} onNameChange={onNameChange} />
        </div>
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

      <Button className="mb-4" onClick={createGame}>
        Create Game
      </Button>

      <Table striped bordered hover>
        <thead>
          <tr>
            <th>Name</th>
            <th>Map</th>
            <th>Players</th>
          </tr>
        </thead>
        <tbody>
          {games.map((g) => {
            const spectateOnly =
              g.phase === 'playing' || g.playerCount >= g.slots;
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
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Container>
  );
}

export default Home;
