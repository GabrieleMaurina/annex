import { useEffect, useState } from 'react';
import { Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { connector } from '../../connector';
import ButtonRows from '../../ui/buttons/ButtonRows';
import WhiteIcon from '../icons/WhiteIcon';
import Tip from '../tooltips/Tip';
import TipSpan from '../tooltips/TipSpan';
import type { FriendState } from './friendState';

const ICON_BUTTON =
  'd-inline-flex align-items-center justify-content-center gap-1';

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
    <ButtonRows>
      {showFriend && friendState === 'none' && (
        <Tip text={`Send a friend request to ${username}`}>
          <Button
            size="sm"
            variant="success"
            className={ICON_BUTTON}
            onClick={() => onFriendAction(connector.sendFriendRequest)}
          >
            <WhiteIcon path="/icons/friend-add.svg" />
            Add friend
          </Button>
        </Tip>
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
        <Tip text="Open a private conversation">
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
        </Tip>
      )}
      {userId !== null && !blocked && online && (
        <TipSpan className="d-grid" text="Spectate the game this player is in">
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
        </TipSpan>
      )}
      {onReport && (
        <TipSpan className="d-grid" text="Report this player for bad conduct">
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
        </TipSpan>
      )}
      {onToggleBlock && (
        <Tip
          text={
            blocked
              ? 'Stop blocking this player'
              : 'Block this player: you will never be put in the same game, they are removed from your friends, and their chat and emoji are hidden'
          }
        >
          <Button
            size="sm"
            variant="danger"
            className={ICON_BUTTON}
            onClick={onToggleBlock}
          >
            <WhiteIcon path="/icons/block.svg" />
            {blocked ? 'Unblock' : 'Block'}
          </Button>
        </Tip>
      )}
    </ButtonRows>
  );
}

export default ConductButtons;
