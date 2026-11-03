import { useState } from 'react';
import { connector } from '../../connector';
import type { FriendsOverview } from '../../lib/types';
import { formatError } from '../formatError';
import { isPlayerMuted, toggleMutePlayer } from '../mutedPlayers';
import { useBlockedPlayer } from './blockedPlayers';
import ConductButtons from './ConductButtons';
import { friendStateOf } from './friendState';
import type { ConductAck } from './ReportPlayerModal';
import ReportPlayerModal from './ReportPlayerModal';

interface Props {
  live: boolean;
  playerId: number;
  name: string;
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

function PlayerConductActions({
  live,
  playerId,
  name,
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
      <ConductButtons
        userId={userId}
        username={name}
        friendState={showFriend ? friendState : null}
        blocked={blocked}
        reported={reported}
        onFriendAction={friendAction}
        onReport={allowReport ? () => setReportOpen(true) : undefined}
        onToggleBlock={showBlock ? toggleBlock : undefined}
      />
      {notice && <div className="small text-danger">{notice}</div>}
      <ReportPlayerModal
        show={reportOpen}
        playerName={name}
        includePicture={false}
        onHide={() => setReportOpen(false)}
        onSubmit={submitReport}
        onReported={() => setReported(true)}
      />
    </div>
  );
}

export default PlayerConductActions;
