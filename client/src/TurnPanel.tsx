import { Button } from 'react-bootstrap';
import { contrastTextColor, withAlpha } from './palette';
import { socket } from './socket';
import type { Ack, GameState, TurnPhase } from './types';

interface Props {
  turnPhase: TurnPhase;
  currentPlayerName: string;
  color: string;
  isMyTurn: boolean;
  setGame: (game: GameState) => void;
}

function TurnPanel({
  turnPhase,
  currentPlayerName,
  color,
  isMyTurn,
  setGame,
}: Props) {
  function nextPhase() {
    socket.emit('game:nextPhase', (res: Ack) => {
      if (res.ok) setGame(res.game);
    });
  }

  return (
    <div
      className="position-fixed bottom-0 start-50 translate-middle-x m-3 p-2 px-3 border rounded d-flex align-items-center gap-2"
      style={{
        zIndex: 1,
        backgroundColor: withAlpha(color, 0.75),
        color: contrastTextColor(color),
      }}
    >
      <span>
        {isMyTurn ? 'Your' : `${currentPlayerName}'s`} turn:{' '}
        <span className="text-capitalize">{turnPhase}</span>
      </span>
      {isMyTurn && (
        <Button size="sm" onClick={nextPhase}>
          Next Phase
        </Button>
      )}
    </div>
  );
}

export default TurnPanel;
