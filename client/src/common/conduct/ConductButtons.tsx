import { useEffect, useState } from 'react';
import { Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { connector } from '../../connector';
import WhiteIcon from '../icons/WhiteIcon';
import Tip from '../tooltips/Tip';
import type { FriendState } from './friendState';

const ICON_BUTTON = 'd-inline-flex align-items-center gap-1';

interface Props {
  userId: string | null;
  username: string;
  friendState: FriendState | null;
  blocked: boolean;
  reported?: boolean;
  onFriendAction: (action: typeof connector.sendFriendRequest) => void;
  onReport?: () => void;
  onToggleBlock?: () => void;
}

function ConductButtons({
  userId,
  username,
  friendState,
  blocked,
  reported = false,
  onFriendAction,
  onReport,
  onToggleBlock,
}: Props) {
  const navigate = useNavigate();
  const showFriend = friendState !== null;
  const [watching, setWatching] = useState(false);
  const [presence, setPresence] = useState<{
    userId: string;
    online: boolean;
  } | null>(null);
  const online = presence?.userId === userId && presence.online;

  useEffect(() => {
    if (userId === null || blocked) return;
    let stale = false;
    connector.isPlayerOnline(userId, (value) => {
      if (!stale) setPresence({ userId, online: value });
    });
    return () => {
      stale = true;
    };
  }, [userId, blocked]);

  function watch(id: string) {
    setWatching(true);
    connector.watchGame(id, (gameName) => {
      setWatching(false);
      navigate(
        gameName
          ? `/games/live/${encodeURIComponent(gameName)}`
          : `/players/${encodeURIComponent(username)}`,
      );
    });
  }

  return (
    <div className="d-flex flex-wrap gap-1">
      {showFriend && friendState === 'none' && (
        <Button
          size="sm"
          variant="success"
          className={ICON_BUTTON}
          onClick={() => onFriendAction(connector.sendFriendRequest)}
        >
          <WhiteIcon path="/icons/friend-add.svg" />
          Add friend
        </Button>
      )}
      {showFriend && friendState === 'outgoing' && (
        <Tip text="Request sent">
          <Button
            size="sm"
            variant="secondary"
            className={ICON_BUTTON}
            onClick={() => onFriendAction(connector.removeFriend)}
          >
            <WhiteIcon path="/icons/friend-remove.svg" />
            Cancel request
          </Button>
        </Tip>
      )}
      {showFriend && friendState === 'incoming' && (
        <Tip text={`${username} sent you a friend request`}>
          <Button
            size="sm"
            variant="success"
            className={ICON_BUTTON}
            onClick={() => onFriendAction(connector.acceptFriendRequest)}
          >
            <WhiteIcon path="/icons/friend-accept.svg" />
            Accept request
          </Button>
        </Tip>
      )}
      {showFriend && friendState === 'friends' && (
        <Tip text="Friends">
          <Button
            size="sm"
            variant="secondary"
            className={ICON_BUTTON}
            onClick={() => onFriendAction(connector.removeFriend)}
          >
            <WhiteIcon path="/icons/friend-remove.svg" />
            Remove friend
          </Button>
        </Tip>
      )}
      {showFriend && (
        <Button
          size="sm"
          className={ICON_BUTTON}
          onClick={() =>
            navigate(`/messages?to=${encodeURIComponent(username)}`)
          }
        >
          <WhiteIcon path="/icons/message.svg" />
          Send message
        </Button>
      )}
      {userId !== null && !blocked && online && (
        <Button
          size="sm"
          variant="info"
          className={ICON_BUTTON}
          disabled={watching}
          onClick={() => watch(userId)}
        >
          <WhiteIcon path="/icons/binoculars.svg" />
          Watch
        </Button>
      )}
      {onReport && (
        <Button
          size="sm"
          variant="danger"
          className={ICON_BUTTON}
          disabled={reported}
          onClick={onReport}
        >
          <WhiteIcon path="/icons/report.svg" />
          {reported ? 'Reported' : 'Report'}
        </Button>
      )}
      {onToggleBlock && (
        <Button
          size="sm"
          variant="danger"
          className={ICON_BUTTON}
          onClick={onToggleBlock}
        >
          <WhiteIcon path="/icons/block.svg" />
          {blocked ? 'Unblock' : 'Block'}
        </Button>
      )}
    </div>
  );
}

export default ConductButtons;
