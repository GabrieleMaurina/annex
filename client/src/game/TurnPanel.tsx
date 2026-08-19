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
  setGame: (game: GameState) => void;
}

function TurnPanel({
  turnPhase,
  currentPlayerName,
  color,
  isMyTurn,
  troopsToDeploy,
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
      <span>
        {isMyTurn ? 'Your' : `${currentPlayerName}'s`} turn:{' '}
        <span className="text-capitalize">{turnPhase}</span>
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
      {isMyTurn && turnPhase !== 'deploy' && (
        <Button size="sm" onClick={nextPhase}>
          {turnPhase === 'fortify' ? 'End Turn' : 'Next Phase'}
        </Button>
      )}
    </div>
  );
}

export default TurnPanel;
