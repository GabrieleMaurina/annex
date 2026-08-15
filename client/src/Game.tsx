import { useEffect, useState } from 'react';
import { Alert, Button, Container } from 'react-bootstrap';
import GameMap from './GameMap';
import Lobby from './Lobby';
import { socket } from './socket';
import type { GameState, Player } from './types';

interface Props {
  gameName: string;
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
        Loading...
      </Container>
    );
  }

  if (game.phase === 'playing') {
    return <GameMap mapName={game.mapName} />;
  }

  return (
    <Container fluid className="py-5 px-4 position-relative">
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
  );
}

export default Game;
