import { useState } from 'react';
import { Button, Container, Modal } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import Tip from '../common/Tip';
import { connector } from '../connector';
import type { Account, PlayerMapRow } from '../lib/types';
import MapBrowser from './MapBrowser';
import { mapImageUrl } from './mapUrl';

function MyMaps({ account }: { account: Account }) {
  const navigate = useNavigate();
  const [confirmRow, setConfirmRow] = useState<PlayerMapRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  function confirmDelete() {
    if (!confirmRow) return;
    setDeleting(true);
    connector.deletePlayerMap(confirmRow.id, (res) => {
      setDeleting(false);
      if (!res.ok) return;
      setConfirmRow(null);
      setReloadKey((k) => k + 1);
    });
  }

  return (
    <Container fluid className="py-5 px-2 px-sm-4">
      <h1 className="text-center mb-4">My maps</h1>

      <MapBrowser
        account={account}
        mode="mine"
        reloadKey={reloadKey}
        onRowClick={(row) =>
          row.dangerous ? undefined : navigate(`/maps/editor/${row.id}`)
        }
        footerRow={
          <Tip text="Create a map" placement="bottom">
            <Button
              size="sm"
              variant="success"
              onClick={() => navigate('/maps/editor')}
            >
              +
            </Button>
          </Tip>
        }
        rowActions={(row) => (
          <Tip text="Delete map">
            <Button
              variant="danger"
              className="d-inline-flex align-items-center justify-content-center"
              style={{ width: 24, height: 24, padding: 0 }}
              onClick={() => setConfirmRow(row)}
            >
              ✕
            </Button>
          </Tip>
        )}
      />

      <Modal show={!!confirmRow} onHide={() => setConfirmRow(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Delete map</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {confirmRow && (
            <div className="d-flex align-items-center gap-3 mb-3">
              <img
                src={mapImageUrl(confirmRow.id)}
                alt=""
                width={96}
                height={54}
                className="rounded border"
                style={{ objectFit: 'cover' }}
              />
              <strong>{confirmRow.name}</strong>
            </div>
          )}
          Are you sure you want to permanently delete this map?
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setConfirmRow(null)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button variant="danger" onClick={confirmDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

export default MyMaps;
