import { Button } from 'react-bootstrap';
import { useWhiteIcon } from '../common/icon';
import { contrastTextColor, withAlpha } from '../lib/palette';
import { socket } from '../lib/socket';
import type { Ack, GameState, TurnPhase } from '../lib/types';

interface Props {
  turnPhase: TurnPhase;
  currentPlayerName: string;
  color: string;
  isMyTurn: boolean;
  troopsToDeploy: number;
  canLeaveDeploy: boolean;
  setGame: (game: GameState) => void;
}

function TurnPanel({
  turnPhase,
  currentPlayerName,
  color,
  isMyTurn,
  troopsToDeploy,
  canLeaveDeploy,
  setGame,
}: Props) {
  const isDark = contrastTextColor(color) === '#ffffff';
  const whiteTankIcon = useWhiteIcon('/icons/tank.svg');

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
      <span>{isMyTurn ? 'You' : currentPlayerName}</span>
      <span className="text-capitalize fw-bold" style={{ fontSize: '1.4em' }}>
        {turnPhase}
      </span>
      {turnPhase === 'deploy' && (
        <span className="d-flex align-items-center gap-1">
          <img
            src={
              isDark ? (whiteTankIcon ?? '/icons/tank.svg') : '/icons/tank.svg'
            }
            width={14}
            height={14}
            alt="Troops to deploy"
            title="Troops to deploy"
          />
          {troopsToDeploy}
        </span>
      )}
      {isMyTurn && (turnPhase !== 'deploy' || canLeaveDeploy) && (
        <Button size="sm" onClick={nextPhase}>
          {turnPhase === 'fortify' ? 'End Turn' : 'Next Phase'}
        </Button>
      )}
    </div>
  );
}

export default TurnPanel;
