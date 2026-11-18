import { useEffect, useState } from 'react';
import { Button, Modal } from 'react-bootstrap';
import { connector } from '../../connector';
import { useToggleSound } from '../../lib/sounds';
import type { Friend } from '../../lib/types';
import Flag from '../badges/Flag';
import { formatError } from '../formatError';
import WhiteIcon from '../icons/WhiteIcon';
import Tip from '../tooltips/Tip';
import { refreshInvites, useInvites } from './invitesStore';

const ICON_BUTTON =
  'd-inline-flex align-items-center justify-content-center gap-1';
const FRIENDS_POLL_MS = 5000;

function InviteFriendsButton() {
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [notice, setNotice] = useState('');
  const { outgoing } = useInvites();
  useToggleSound(open);

  useEffect(() => {
    if (!open) return;
    function load() {
      if (document.visibilityState !== 'hidden')
        connector.listInvitableFriends(setFriends);
    }
    load();
    const timer = setInterval(load, FRIENDS_POLL_MS);
    return () => clearInterval(timer);
  }, [open]);

  function invite(friend: Friend) {
    setNotice('');
    connector.sendInvite(
      { userId: friend.id, kind: 'invite', lobby: true },
      (res) => {
        if (!res.ok) setNotice(formatError(res.error));
        refreshInvites();
      },
    );
  }

  return (
    <>
      <Tip text="Invite your online friends to join this casual game">
        <Button className={ICON_BUTTON} onClick={() => setOpen(true)}>
          <WhiteIcon path="/icons/plus.svg" />
          Invite friends
        </Button>
      </Tip>
      <Modal
        show={open}
        onHide={() => setOpen(false)}
        centered
        dialogClassName="modal-fit mx-auto"
      >
        <Modal.Header closeButton className="gap-3">
          <Modal.Title>Invite friends</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {friends === null && <div className="text-muted">Loading...</div>}
          {friends?.length === 0 && (
            <div className="text-muted">
              No friends are available right now.
            </div>
          )}
          {friends?.map((friend) => {
            const pending = outgoing.find(
              (entry) =>
                entry.toUserId === friend.id &&
                !entry.newGame &&
                !entry.accepted,
            );
            return (
              <div
                key={friend.id}
                className="d-flex align-items-center justify-content-between gap-4 mb-2"
              >
                <span className="d-flex align-items-center gap-2">
                  <Flag country={friend.country} />
                  {friend.username}
                </span>
                {pending ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className={ICON_BUTTON}
                    onClick={() =>
                      connector.cancelInvite(pending.id, refreshInvites)
                    }
                  >
                    <WhiteIcon path="/icons/close.svg" />
                    Cancel invite
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="success"
                    className={ICON_BUTTON}
                    onClick={() => invite(friend)}
                  >
                    <WhiteIcon path="/icons/plus.svg" />
                    Invite
                  </Button>
                )}
              </div>
            );
          })}
          {notice && <div className="small text-danger mt-2">{notice}</div>}
        </Modal.Body>
      </Modal>
    </>
  );
}

export default InviteFriendsButton;
