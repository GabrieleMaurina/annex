import { useCallback, useEffect, useState } from 'react';
import { Button } from 'react-bootstrap';
import { connector } from '../connector';
import { formatError } from './formatError';

type FriendState = 'none' | 'friends' | 'outgoing' | 'incoming';

interface Props {
  userId: string;
  username: string;
}

function FriendshipButton({ userId, username }: Props) {
  const [state, setState] = useState<FriendState | null>(null);
  const [notice, setNotice] = useState('');

  const refresh = useCallback(() => {
    connector.listFriends((overview) => {
      if (overview.friends.some((f) => f.id === userId)) setState('friends');
      else if (overview.outgoing.some((f) => f.id === userId))
        setState('outgoing');
      else if (overview.incoming.some((f) => f.id === userId))
        setState('incoming');
      else setState('none');
    });
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (state === null) return null;

  function done(res: { ok: boolean; error?: string }) {
    if (!res.ok && res.error) setNotice(formatError(res.error));
    refresh();
  }

  return (
    <div className="d-flex flex-column align-items-center gap-1">
      {state === 'none' && (
        <Button
          size="sm"
          onClick={() => connector.sendFriendRequest(userId, done)}
        >
          Add friend
        </Button>
      )}
      {state === 'outgoing' && (
        <>
          <span className="small text-muted">Friend request sent</span>
          <Button
            size="sm"
            variant="outline-secondary"
            onClick={() => connector.removeFriend(userId, done)}
          >
            Cancel request
          </Button>
        </>
      )}
      {state === 'incoming' && (
        <>
          <span className="small text-muted">
            {username} sent you a friend request
          </span>
          <Button
            size="sm"
            onClick={() => connector.acceptFriendRequest(userId, done)}
          >
            Accept request
          </Button>
        </>
      )}
      {state === 'friends' && (
        <>
          <span className="small text-muted">Friends</span>
          <Button
            size="sm"
            variant="outline-secondary"
            onClick={() => connector.removeFriend(userId, done)}
          >
            Remove friend
          </Button>
        </>
      )}
      {notice && <div className="small text-danger">{notice}</div>}
    </div>
  );
}

export default FriendshipButton;
