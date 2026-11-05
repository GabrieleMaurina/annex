import { Button } from 'react-bootstrap';
import type { FriendsOverview, GameState } from '../../lib/types';
import WhiteIcon from '../icons/WhiteIcon';
import Tip from '../tooltips/Tip';
import type { PanelConduct } from './panelConduct';
import PlayerConductActions from './PlayerConductActions';

interface Props {
  player: GameState['players'][number];
  name: string;
  conduct: PanelConduct | null;
  friends?: FriendsOverview;
  blockedUserIds?: string[];
  onChange: () => void;
  onCycleColor?: () => void;
}

function PanelPlayerDetails({
  player,
  name,
  conduct,
  friends,
  blockedUserIds,
  onChange,
  onCycleColor,
}: Props) {
  const userId = player.userId ?? null;
  const knownAccount = userId !== null || player.country !== null;
  const showActions =
    conduct !== null &&
    !player.isBot &&
    player.id !== conduct.viewerId &&
    (conduct.live ? conduct.masked || knownAccount : userId !== null);
  return (
    <div className="d-flex flex-column gap-1 px-2 py-1">
      <span className="text-truncate">{name}</span>
      {onCycleColor && (
        <div className="d-flex">
          <Tip text="Only you see this color">
            <Button
              size="sm"
              variant="secondary"
              className="d-inline-flex align-items-center gap-1"
              onClick={onCycleColor}
            >
              <WhiteIcon path="/icons/palette.svg" />
              Change color
            </Button>
          </Tip>
        </div>
      )}
      {showActions && (
        <PlayerConductActions
          live={conduct.live}
          playerId={player.id}
          name={name}
          userId={userId}
          gameId={conduct.gameId}
          allowFriend={conduct.allowFriend}
          allowReport={conduct.allowReport}
          allowBlock={conduct.allowBlock}
          httpBlock={conduct.httpBlock}
          friends={friends}
          blockedUserIds={blockedUserIds}
          onChange={onChange}
        />
      )}
    </div>
  );
}

export default PanelPlayerDetails;
