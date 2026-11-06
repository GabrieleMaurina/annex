import { useEffect, useState } from 'react';
import { Button } from 'react-bootstrap';
import { connector } from '../../connector';
import type { FriendsOverview, GameState } from '../../lib/types';
import { SECTION_CLASS } from '../../ui/containers/panelStyle';
import Flag from '../badges/Flag';
import RankIcon from '../badges/RankIcon';
import { useWhiteIcon } from '../icon';
import WhiteIcon from '../icons/WhiteIcon';
import Tip from '../tooltips/Tip';
import type { PanelConduct } from './panelConduct';
import PlayerConductActions from './PlayerConductActions';
import { fetchPlayerProfile } from './playerProfile';

const PICTURE_SIZE = 72;

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
  const [bio, setBio] = useState('');
  const whitePlayerIcon = useWhiteIcon('/icons/player.svg');
  const hasProfile = !player.isBot && (!live || !connector.isOffline());
  useEffect(() => {
    if (!hasProfile) return;
    let stale = false;
    if (live) {
      connector.getPlayerProfileInGame(player.id, (res) => {
        if (stale || !res.ok) return;
        setPicture(res.picture);
        setBio(res.bio);
      });
    } else if (userId !== null) {
      fetchPlayerProfile(userId, (storedPicture, storedBio) => {
        if (stale) return;
        setPicture(storedPicture);
        setBio(storedBio);
      });
    }
    return () => {
      stale = true;
    };
  }, [hasProfile, live, player.id, userId]);
  return (
    <div className={`${SECTION_CLASS} d-flex flex-column gap-2 p-2 m-1 mb-2`}>
      <div className="d-flex gap-2">
        {hasProfile &&
          (picture ? (
            <img
              src={picture}
              alt=""
              width={PICTURE_SIZE}
              height={PICTURE_SIZE}
              className="rounded border flex-shrink-0"
            />
          ) : (
            <img
              src={whitePlayerIcon ?? '/icons/player.svg'}
              alt=""
              width={PICTURE_SIZE}
              height={PICTURE_SIZE}
              className="rounded border bg-body-secondary p-3 flex-shrink-0"
            />
          ))}
        <div className="d-flex flex-column gap-1 overflow-hidden">
          <div className="d-flex align-items-center gap-1 fw-semibold">
            <RankIcon elo={player.elo} />
            <Flag country={player.country} height={18} />
            <span className="text-truncate">{name}</span>
          </div>
          {bio && (
            <div className="small text-body-secondary selectable text-break">
              {bio}
            </div>
          )}
        </div>
      </div>
      {(onCycleColor || showActions) && (
        <div className="d-flex flex-wrap gap-1">
          {onCycleColor && (
            <Tip text="Only changes the color on this device">
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
      )}
    </div>
  );
}

export default PanelPlayerDetails;
