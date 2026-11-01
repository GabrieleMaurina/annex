import { useState } from 'react';
import { Button } from 'react-bootstrap';
import { connector } from '../../connector';
import type { FriendsOverview } from '../../lib/types';
import { formatError } from '../formatError';
import { isPlayerMuted, toggleMutePlayer } from '../mutedPlayers';
import Tip from '../tooltips/Tip';
import { useBlockedPlayer } from './blockedPlayers';
import type { ConductAck } from './ReportPlayerModal';
import ReportPlayerModal from './ReportPlayerModal';

type FriendState = 'none' | 'friends' | 'outgoing' | 'incoming';

interface Props {
  live: boolean;
  playerId: number;
  userId: string | null;
  gameId?: string;
  allowFriend: boolean;
  allowReport: boolean;
  allowBlock: boolean;
  httpBlock: boolean;
  friends?: FriendsOverview;
  blockedUserIds?: string[];
  onChange: () => void;
}

function friendStateOf(overview: FriendsOverview, userId: string): FriendState {
  if (overview.friends.some((f) => f.id === userId)) return 'friends';
  if (overview.outgoing.some((f) => f.id === userId)) return 'outgoing';
  if (overview.incoming.some((f) => f.id === userId)) return 'incoming';
  return 'none';
}

function PlayerConductActions({
  live,
  playerId,
  userId,
  gameId,
  allowFriend,
  allowReport,
  allowBlock,
  httpBlock,
  friends,
  blockedUserIds,
  onChange,
}: Props) {
  const liveBlocked = useBlockedPlayer(playerId);
  const [reportOpen, setReportOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const [notice, setNotice] = useState('');
  const blocked = httpBlock
    ? userId !== null && !!blockedUserIds?.includes(userId)
    : liveBlocked;
  const showFriend = allowFriend && userId !== null && !blocked;
  const showBlock = allowBlock && (!httpBlock || userId !== null);

  if (!showFriend && !allowReport && !showBlock) return null;

  const friendState =
    friends && userId !== null ? friendStateOf(friends, userId) : null;

  function friendDone(res: ConductAck) {
    if (!res.ok) setNotice(formatError(res.error));
    onChange();
  }

  function friendAction(action: typeof connector.sendFriendRequest) {
    if (userId === null) return;
    setNotice('');
    action(userId, friendDone);
  }

  function submitReport(reason: string, cb: (res: ConductAck) => void) {
    if (live) connector.reportPlayerInGame(playerId, reason, cb);
    else if (userId !== null)
      connector.reportPlayer({ userId, reason, gameId }, cb);
  }

  function toggleBlock() {
    setNotice('');
    const done = (res: ConductAck) => {
      if (!res.ok) {
        setNotice(formatError(res.error));
        return;
      }
      if (!blocked && live && !isPlayerMuted(playerId))
        toggleMutePlayer(playerId);
      onChange();
    };
    if (!httpBlock) {
      if (blocked) connector.unblockPlayerInGame(playerId, done);
      else connector.blockPlayerInGame(playerId, done);
    } else if (userId !== null) {
      if (blocked) connector.unblockUser(userId, done);
      else connector.blockUser(userId, done);
    }
  }

  return (
    <div className="d-flex flex-column gap-1">
      <div className="d-flex flex-wrap gap-1">
        {showFriend && friendState === 'none' && (
          <Button
            size="sm"
            onClick={() => friendAction(connector.sendFriendRequest)}
          >
            Add friend
          </Button>
        )}
        {showFriend && friendState === 'outgoing' && (
          <Tip text="Request sent">
            <Button
              size="sm"
              variant="warning"
              onClick={() => friendAction(connector.removeFriend)}
            >
              Cancel request
            </Button>
          </Tip>
        )}
        {showFriend && friendState === 'incoming' && (
          <Button
            size="sm"
            onClick={() => friendAction(connector.acceptFriendRequest)}
          >
            Accept request
          </Button>
        )}
        {showFriend && friendState === 'friends' && (
          <Tip text="Friends">
            <Button
              size="sm"
              variant="warning"
              onClick={() => friendAction(connector.removeFriend)}
            >
              Remove friend
            </Button>
          </Tip>
        )}
        {allowReport && (
          <Button
            size="sm"
            variant="danger"
            disabled={reported}
            onClick={() => setReportOpen(true)}
          >
            {reported ? 'Reported' : 'Report'}
          </Button>
        )}
        {showBlock && (
          <Button size="sm" variant="outline-danger" onClick={toggleBlock}>
            {blocked ? 'Unblock' : 'Block'}
          </Button>
        )}
      </div>
      {notice && <div className="small text-danger">{notice}</div>}
      <ReportPlayerModal
        show={reportOpen}
        includePicture={false}
        onHide={() => setReportOpen(false)}
        onSubmit={submitReport}
        onReported={() => setReported(true)}
      />
    </div>
  );
}

export default PlayerConductActions;
