import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Col,
  Container,
  Form,
  Row,
  Table,
} from 'react-bootstrap';
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
  const [name, setName] = useState(player.name);
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

  function commitName() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== player.name) {
      onNameChange(trimmed);
    } else {
      setName(player.name);
    }
  }

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
    <Container className="py-5">
      <h1 className="mb-4">Annex</h1>

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

      <Row className="mb-4">
        <Col md={4}>
          <Form.Group>
            <Form.Label>Player Name</Form.Label>
            <Form.Control
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitName}
            />
          </Form.Group>
        </Col>
      </Row>

      <Button className="mb-4" onClick={createGame}>
        Create Game
      </Button>

      <Table striped bordered hover>
        <thead>
          <tr>
            <th>Name</th>
            <th>Map</th>
            <th>Players</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {games.map((g) => (
            <tr key={g.name}>
              <td>{g.name}</td>
              <td>{g.mapName}</td>
              <td>
                {g.playerCount}/{g.slots}
              </td>
              <td>
                <Button
                  size="sm"
                  disabled={g.playerCount >= g.slots}
                  onClick={() => joinGame(g.name)}
                >
                  Join
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Container>
  );
}

export default Home;
