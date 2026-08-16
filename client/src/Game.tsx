import { useEffect, useState } from 'react';
import { Alert, Button, Container, Spinner } from 'react-bootstrap';
import Chat from './Chat';
import GameMap from './GameMap';
import Lobby from './Lobby';
import { socket } from './socket';
import type { GameState, Player } from './types';

interface Props {
  player: Player;
  onNameChange: (name: string) => void;
  selfId: number | null;
  joinError: string;
  mapNames: string[];
  navigate: (path: string) => void;
}

function Game({
  player,
  onNameChange,
  selfId,
  joinError,
  mapNames,
  navigate,
}: Props) {
  const [game, setGame] = useState<GameState | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    function onState(state: GameState) {
      setGame(state);
    }
    socket.on('game:state', onState);
    return () => {
      socket.off('game:state', onState);
    };
  }, []);

  if (joinError) {
    return (
      <Container fluid className="py-5 px-4">
        <Alert variant="danger">{joinError}</Alert>
        <Button onClick={() => navigate('/')}>Back to Home</Button>
      </Container>
    );
  }

  if (!game) {
    return (
      <Container fluid className="py-5 px-4">
        <Spinner size="sm" className="me-2" />
        Loading...
      </Container>
    );
  }

  const nameById = new Map(
    [...game.players, ...game.spectators].map((p) => [p.id, p.name]),
  );
  const colorById = new Map(game.players.map((p) => [p.id, p.color]));

  return (
    <>
      {game.phase === 'playing' ? (
        <GameMap
          mapName={game.mapName}
          players={game.players}
          spectators={game.spectators}
          ownership={game.territories}
          setChatOpen={setChatOpen}
          navigate={navigate}
        />
      ) : (
        <Container fluid className="py-5 px-4">
          <Lobby
            game={game}
            setGame={setGame}
            player={player}
            onNameChange={onNameChange}
            selfId={selfId}
            mapNames={mapNames}
            navigate={navigate}
          />
        </Container>
      )}
      <Chat
        nameById={nameById}
        colorById={colorById}
        transparent={game.phase === 'playing'}
        open={chatOpen}
        setOpen={setChatOpen}
      />
    </>
  );
}

export default Game;
