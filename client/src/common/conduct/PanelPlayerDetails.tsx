import type { FriendsOverview, GameState } from '../../lib/types';
import type { PanelConduct } from './panelConduct';
import PlayerConductActions from './PlayerConductActions';

interface Props {
  player: GameState['players'][number];
  name: string;
  conduct: PanelConduct | null;
  friends?: FriendsOverview;
  blockedUserIds?: string[];
  onChange: () => void;
}

function PanelPlayerDetails({
  player,
  name,
  conduct,
  friends,
  blockedUserIds,
  onChange,
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
      {showActions && (
        <PlayerConductActions
          live={conduct.live}
          playerId={player.id}
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
