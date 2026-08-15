import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Col,
  Container,
  Form,
  Row,
  Table,
} from 'react-bootstrap';
import { socket } from './socket';
import type { Ack, GameSettingsInput, GameState } from './types';

interface Props {
  gameName: string;
  selfId: number | null;
  joinError: string;
  mapNames: string[];
  navigate: (path: string) => void;
}

function Game({ selfId, joinError, mapNames, navigate }: Props) {
  const [game, setGame] = useState<GameState | null>(null);
  const [settingsError, setSettingsError] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const slotsInputRef = useRef<HTMLInputElement>(null);
  const bannedIdsRef = useRef<number[]>([]);

  useEffect(() => {
    function onState(state: GameState) {
      setGame(state);
    }
    socket.on('game:state', onState);
    return () => {
      socket.off('game:state', onState);
    };
  }, []);

  useEffect(() => {
    if (game) bannedIdsRef.current = game.bannedPlayers.map((p) => p.id);
  }, [game]);

  function applySettings(settings: GameSettingsInput) {
    socket.emit('game:settings', settings, (res: Ack) => {
      if (!res.ok) {
        setSettingsError(res.error);
        return;
      }
      setSettingsError('');
      setGame(res.game);
      if (settings.name !== undefined)
        navigate(`/${encodeURIComponent(res.game.name)}`);
    });
  }

  if (joinError) {
    return (
      <Container className="py-5">
        <Alert variant="danger">{joinError}</Alert>
        <Button onClick={() => navigate('/')}>Back to Home</Button>
      </Container>
    );
  }

  if (!game) {
    return <Container className="py-5">Loading...</Container>;
  }

  const isHost = game.hostId === selfId;

  function kickPlayer(id: number) {
    bannedIdsRef.current = [...bannedIdsRef.current, id];
    applySettings({ bannedPlayerIds: bannedIdsRef.current });
  }

  function unbanPlayer(id: number) {
    bannedIdsRef.current = bannedIdsRef.current.filter(
      (bannedId) => bannedId !== id,
    );
    applySettings({ bannedPlayerIds: bannedIdsRef.current });
  }

  return (
    <Container className="py-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>{game.name}</h1>
        <Button variant="secondary" onClick={() => navigate('/')}>
          Leave Game
        </Button>
      </div>

      {settingsError && (
        <Alert
          variant="danger"
          dismissible
          onClose={() => setSettingsError('')}
        >
          {settingsError}
        </Alert>
      )}

      {isHost ? (
        <Row className="mb-4">
          <Col md={4}>
            <Form.Group className="mb-2">
              <Form.Label>Game Name</Form.Label>
              <Form.Control
                ref={nameInputRef}
                defaultValue={game.name}
                onBlur={() => {
                  const value = nameInputRef.current!.value.trim();
                  if (value && value !== game.name)
                    applySettings({ name: value });
                }}
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Map</Form.Label>
              <Form.Select
                defaultValue={game.mapName}
                onChange={(e) => applySettings({ mapName: e.target.value })}
              >
                {mapNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Slots</Form.Label>
              <Form.Control
                ref={slotsInputRef}
                type="number"
                min={1}
                max={20}
                defaultValue={game.slots}
                onBlur={() => {
                  const value = Number(slotsInputRef.current!.value);
                  if (value !== game.slots) applySettings({ slots: value });
                }}
              />
            </Form.Group>
          </Col>
        </Row>
      ) : (
        <p>
          Map: {game.mapName} · Slots: {game.slots}
        </p>
      )}

      <Table striped bordered hover>
        <thead>
          <tr>
            <th>Player</th>
            <th></th>
            {isHost && <th></th>}
          </tr>
        </thead>
        <tbody>
          {game.players.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>
                {p.id === game.hostId && <Badge bg="primary">Host</Badge>}
              </td>
              {isHost && (
                <td>
                  {p.id !== selfId && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => kickPlayer(p.id)}
                    >
                      Kick
                    </Button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </Table>

      {isHost && game.bannedPlayers.length > 0 && (
        <>
          <h5>Banned Players</h5>
          <Table striped bordered hover>
            <thead>
              <tr>
                <th>Player</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {game.bannedPlayers.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => unbanPlayer(p.id)}
                    >
                      Unban
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </Container>
  );
}

export default Game;
