import { useEffect, useState } from 'react';
import { Button } from 'react-bootstrap';
import { connector } from '../../connector';
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
  live: boolean;
}

function PanelPlayerDetails({
  player,
  name,
  live,
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
  const [picture, setPicture] = useState<string | null>(null);
  const fetchPicture = live && !player.isBot && !connector.isOffline();
  useEffect(() => {
    if (!fetchPicture) return;
    let stale = false;
    connector.getPlayerPictureInGame(player.id, (res) => {
      if (!stale && res.ok) setPicture(res.picture);
    });
    return () => {
      stale = true;
    };
  }, [fetchPicture, player.id]);
  return (
    <div className="d-flex flex-column gap-1 px-2 py-1">
      <div className="d-flex align-items-center gap-1">
        {picture && (
          <img
            src={picture}
            alt=""
            width={20}
            height={20}
            className="rounded flex-shrink-0"
          />
        )}
        <span className="text-truncate">{name}</span>
      </div>
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
