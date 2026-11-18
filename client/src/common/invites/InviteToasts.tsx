import { useEffect, useRef } from 'react';
import { Button, Toast, ToastContainer } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { connector } from '../../connector';
import { playSound } from '../../lib/sounds';
import type { IncomingInvite } from '../../lib/types';
import WhiteIcon from '../icons/WhiteIcon';
import {
  refreshInvites,
  rememberHostSetup,
  setInvitesEnabled,
  useInvites,
} from './invitesStore';

const ICON_BUTTON =
  'd-inline-flex align-items-center justify-content-center gap-1';

function gamePath(name: string): string {
  return `/games/live/${encodeURIComponent(name)}`;
}

function inviteText(invite: IncomingInvite): string {
  if (invite.kind === 'challenge')
    return `${invite.fromName} challenges you to a game`;
  return invite.newGame
    ? `${invite.fromName} invites you to a casual game`
    : `${invite.fromName} invites you to join their casual game`;
}

function InviteToasts({ enabled }: { enabled: boolean }) {
  const navigate = useNavigate();
  const { incoming, outgoing } = useInvites();
  const heard = useRef(new Set<string>());
  const handled = useRef(new Set<string>());

  useEffect(() => {
    setInvitesEnabled(enabled);
  }, [enabled]);

  useEffect(() => {
    for (const invite of incoming) {
      if (invite.accepted || heard.current.has(invite.id)) continue;
      heard.current.add(invite.id);
      playSound('bell');
    }
    for (const invite of incoming) {
      if (!invite.accepted || !invite.ready || handled.current.has(invite.id))
        continue;
      handled.current.add(invite.id);
      navigate(gamePath(invite.gameName));
    }
    for (const invite of outgoing) {
      if (!invite.accepted || !invite.newGame || handled.current.has(invite.id))
        continue;
      handled.current.add(invite.id);
      rememberHostSetup(invite.gameName, {
        casual: invite.kind === 'invite',
      });
      navigate(gamePath(invite.gameName));
    }
  }, [incoming, outgoing, navigate]);

  function respond(invite: IncomingInvite, accept: boolean) {
    connector.respondToInvite({ id: invite.id, accept }, refreshInvites);
  }

  return (
    <>
      <ToastContainer position="bottom-start" className="position-fixed p-3">
        {outgoing
          .filter((invite) => !invite.accepted)
          .map((invite) => (
            <Toast key={invite.id}>
              <Toast.Header closeButton={false}>
                <strong className="me-auto">
                  {invite.kind === 'challenge'
                    ? 'Challenge sent'
                    : 'Invitation sent'}
                </strong>
              </Toast.Header>
              <Toast.Body>
                <div className="mb-2">
                  Waiting for {invite.toName} to respond
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className={ICON_BUTTON}
                  onClick={() =>
                    connector.cancelInvite(invite.id, refreshInvites)
                  }
                >
                  <WhiteIcon path="/icons/close.svg" />
                  Cancel
                </Button>
              </Toast.Body>
            </Toast>
          ))}
      </ToastContainer>
      <ToastContainer position="top-end" className="position-fixed p-3">
        {incoming.map((invite) =>
          invite.accepted ? (
            <Toast key={invite.id}>
              <Toast.Body>Joining {invite.fromName}...</Toast.Body>
            </Toast>
          ) : (
            <Toast key={invite.id}>
              <Toast.Header closeButton={false}>
                <strong className="me-auto">
                  {invite.kind === 'challenge' ? 'Challenge' : 'Invitation'}
                </strong>
              </Toast.Header>
              <Toast.Body>
                <div className="mb-2">{inviteText(invite)}</div>
                <div className="d-flex gap-2">
                  <Button
                    size="sm"
                    variant="success"
                    className={ICON_BUTTON}
                    onClick={() => respond(invite, true)}
                  >
                    <WhiteIcon path="/icons/check.svg" />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className={ICON_BUTTON}
                    onClick={() => respond(invite, false)}
                  >
                    <WhiteIcon path="/icons/close.svg" />
                    Refuse
                  </Button>
                </div>
              </Toast.Body>
            </Toast>
          ),
        )}
      </ToastContainer>
    </>
  );
}

export default InviteToasts;
