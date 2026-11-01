import { useCallback, useEffect, useState } from 'react';
import { connector } from '../connector';
import ConductButtons from './conduct/ConductButtons';
import type { FriendState } from './conduct/friendState';
import { friendStateOf } from './conduct/friendState';
import { formatError } from './formatError';

interface Props {
  userId: string;
  username: string;
  onReport: () => void;
}

function ProfileActions({ userId, username, onReport }: Props) {
  const [state, setState] = useState<FriendState | 'blocked' | null>(null);
  const [notice, setNotice] = useState('');

  const refresh = useCallback(() => {
    connector.listFriends((overview) => {
      setState(
        overview.blocked.some((f) => f.id === userId)
          ? 'blocked'
          : friendStateOf(overview, userId),
      );
    });
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (state === null) return null;

  function done(res: { ok: boolean; error?: string }) {
    setNotice(!res.ok && res.error ? formatError(res.error) : '');
    refresh();
  }

  return (
    <div className="d-flex flex-column align-items-center gap-1">
      <ConductButtons
        username={username}
        friendState={state === 'blocked' ? null : state}
        blocked={state === 'blocked'}
        onFriendAction={(action) => action(userId, done)}
        onReport={onReport}
        onToggleBlock={() =>
          state === 'blocked'
            ? connector.unblockUser(userId, done)
            : connector.blockUser(userId, done)
        }
      />
      {notice && <div className="small text-danger">{notice}</div>}
    </div>
  );
}

export default ProfileActions;
