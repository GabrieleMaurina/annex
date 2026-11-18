import type { CSSProperties } from 'react';
import { Badge, Button } from 'react-bootstrap';
import WhiteIcon from '../../common/icons/WhiteIcon';
import Tip from '../../common/tooltips/Tip';
import type { GameState } from '../../lib/types';

type Player = GameState['players'][number];

interface Props {
  player: Player | null;
  hostId: number | null;
  selfId: number | null;
  style?: CSSProperties;
  setReady: (ready: boolean) => void;
}

function ReadyCell({ player, hostId, selfId, style, setReady }: Props) {
  const showsReady = player && !player.isBot && player.id !== hostId;
  return (
    <td className="text-nowrap align-middle" style={style}>
      {showsReady ? (
        player.id === selfId ? (
          <span className="d-inline-block" onClick={(e) => e.stopPropagation()}>
            <Tip
              text={
                player.ready
                  ? 'You are ready. Click to cancel'
                  : 'Tell the host you are ready to play'
              }
            >
              <Button
                size="sm"
                variant={player.ready ? 'success' : 'secondary'}
                className="d-inline-flex align-items-center justify-content-center gap-1"
                onClick={() => setReady(!player.ready)}
              >
                <WhiteIcon path="/icons/check.svg" size={14} />
                Ready
              </Button>
            </Tip>
          </span>
        ) : (
          <Badge bg={player.ready ? 'success' : 'secondary'}>
            {player.ready ? 'Ready' : 'Not ready'}
          </Badge>
        )
      ) : null}
    </td>
  );
}

export default ReadyCell;
