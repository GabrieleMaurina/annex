import { useCallback, useEffect, useState } from 'react';
import { Button } from 'react-bootstrap';
import { connector } from '../../connector';
import type { InviteKind } from '../../lib/types';
import ButtonRows from '../../ui/buttons/ButtonRows';
import { formatError } from '../formatError';
import WhiteIcon from '../icons/WhiteIcon';
import Tip from '../tooltips/Tip';
import { refreshInvites, useInvites } from './invitesStore';

const ICON_BUTTON =
  'd-inline-flex align-items-center justify-content-center gap-1';
const PRESENCE_POLL_MS = 5000;

interface Props {
  userId: string;
  username: string;
  isFriend: boolean;
}

function InviteButtons({ userId, username, isFriend }: Props) {
  const { outgoing } = useInvites();
  const [reachable, setReachable] = useState(false);
  const [notice, setNotice] = useState('');
  const pending = outgoing.filter(
    (entry) => entry.toUserId === userId && entry.newGame && !entry.accepted,
  );
  const challenge = pending.find((entry) => entry.kind === 'challenge');
  const friendly = pending.find((entry) => entry.kind === 'invite');

  const checkPresence = useCallback(() => {
    if (document.visibilityState === 'hidden') return;
    connector.isPlayerReachable(userId, setReachable);
  }, [userId]);

  useEffect(() => {
    checkPresence();
    const timer = setInterval(checkPresence, PRESENCE_POLL_MS);
    return () => clearInterval(timer);
  }, [checkPresence]);

  function send(kind: InviteKind) {
    setNotice('');
    connector.sendInvite({ userId, kind }, (res) => {
      if (res.ok) {
        refreshInvites();
        return;
      }
      setNotice(formatError(res.error));
      checkPresence();
    });
  }

  function cancel(id: string) {
    connector.cancelInvite(id, refreshInvites);
  }

  if (!reachable && pending.length === 0) return null;

  return (
    <ButtonRows>
      {challenge ? (
        <Tip text={`Challenge sent to ${username}. Click to cancel it`}>
          <Button
            size="sm"
            variant="secondary"
            className={ICON_BUTTON}
            onClick={() => cancel(challenge.id)}
          >
            <WhiteIcon path="/icons/close.svg" />
            Cancel challenge
          </Button>
        </Tip>
      ) : (
        <Tip text={`Challenge ${username} to a game`}>
          <Button
            size="sm"
            className={ICON_BUTTON}
            onClick={() => send('challenge')}
          >
            <WhiteIcon path="/icons/swords.svg" />
            Challenge
          </Button>
        </Tip>
      )}
      {isFriend &&
        (friendly ? (
          <Tip text={`Invitation sent to ${username}. Click to cancel it`}>
            <Button
              size="sm"
              variant="secondary"
              className={ICON_BUTTON}
              onClick={() => cancel(friendly.id)}
            >
              <WhiteIcon path="/icons/close.svg" />
              Cancel invite
            </Button>
          </Tip>
        ) : (
          <Tip text={`Invite ${username} to a casual game with no Elo changes`}>
            <Button
              size="sm"
              variant="success"
              className={ICON_BUTTON}
              onClick={() => send('invite')}
            >
              <WhiteIcon path="/icons/plus.svg" />
              Invite
            </Button>
          </Tip>
        ))}
      {notice && <div className="small text-danger">{notice}</div>}
    </ButtonRows>
  );
}

export default InviteButtons;
