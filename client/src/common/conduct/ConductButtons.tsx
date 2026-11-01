import { Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { connector } from '../../connector';
import Tip from '../tooltips/Tip';
import type { FriendState } from './friendState';

interface Props {
  username: string;
  friendState: FriendState | null;
  blocked: boolean;
  reported?: boolean;
  onFriendAction: (action: typeof connector.sendFriendRequest) => void;
  onReport?: () => void;
  onToggleBlock?: () => void;
}

function ConductButtons({
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

  return (
    <div className="d-flex flex-wrap gap-1">
      {showFriend && friendState === 'none' && (
        <Button
          size="sm"
          variant="success"
          onClick={() => onFriendAction(connector.sendFriendRequest)}
        >
          Add friend
        </Button>
      )}
      {showFriend && friendState === 'outgoing' && (
        <Tip text="Request sent">
          <Button
            size="sm"
            variant="outline-secondary"
            onClick={() => onFriendAction(connector.removeFriend)}
          >
            Cancel request
          </Button>
        </Tip>
      )}
      {showFriend && friendState === 'incoming' && (
        <Tip text={`${username} sent you a friend request`}>
          <Button
            size="sm"
            variant="success"
            onClick={() => onFriendAction(connector.acceptFriendRequest)}
          >
            Accept request
          </Button>
        </Tip>
      )}
      {showFriend && friendState === 'friends' && (
        <Tip text="Friends">
          <Button
            size="sm"
            variant="outline-secondary"
            onClick={() => onFriendAction(connector.removeFriend)}
          >
            Remove friend
          </Button>
        </Tip>
      )}
      {showFriend && (
        <Button
          size="sm"
          onClick={() =>
            navigate(`/messages?to=${encodeURIComponent(username)}`)
          }
        >
          Send message
        </Button>
      )}
      {onReport && (
        <Button
          size="sm"
          variant="danger"
          disabled={reported}
          onClick={onReport}
        >
          {reported ? 'Reported' : 'Report'}
        </Button>
      )}
      {onToggleBlock && (
        <Button size="sm" variant="danger" onClick={onToggleBlock}>
          {blocked ? 'Unblock' : 'Block'}
        </Button>
      )}
    </div>
  );
}

export default ConductButtons;
