import { useState } from 'react';
import { Button, Container, Modal } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { connector } from '../connector';
import type { Account, PlayerMapRow } from '../lib/types';
import MapBrowser from './MapBrowser';
import { mapImageUrl } from './mapUrl';

function Maps({ account }: { account: Account | null }) {
  const navigate = useNavigate();
  const [preview, setPreview] = useState<PlayerMapRow | null>(null);
  const [reported, setReported] = useState(false);

  function report() {
    if (!preview) return;
    connector.reportMap(preview.id, (res) => {
      if (res.ok || res.error === 'already reported') setReported(true);
    });
  }

  return (
    <Container fluid className="py-5 px-2 px-sm-4">
      <h1 className="text-center mb-3">Maps</h1>
      {account && (
        <div className="d-flex justify-content-center gap-2 mb-4">
          <Button onClick={() => navigate('/maps/editor')}>Create a map</Button>
          <Button onClick={() => navigate('/maps/mine')}>My maps</Button>
        </div>
      )}

      <MapBrowser
        account={account}
        mode="browse"
        onRowClick={(row) => {
          setPreview(row);
          setReported(false);
        }}
      />

      <Modal
        show={!!preview}
        onHide={() => setPreview(null)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>{preview?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {preview && (
            <>
              <img
                src={mapImageUrl(preview.id)}
                alt=""
                className="w-100 rounded border mb-3"
                style={{ objectFit: 'contain', maxHeight: '60vh' }}
              />
              <p className="mb-1">
                By <strong>{preview.authorName}</strong> ·{' '}
                {preview.territoryCount} territories · {preview.continentCount}{' '}
                continents · {preview.likeCount} likes
              </p>
              {preview.generation && (
                <p className="mb-1 text-muted small">
                  Generated: {preview.generation.type},{' '}
                  {preview.generation.fill} fill, {preview.generation.size} ·
                  seed {preview.generation.seed}
                </p>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          {account && !preview?.mine && (
            <Button
              variant="outline-danger"
              size="sm"
              disabled={reported}
              onClick={report}
            >
              {reported ? 'Reported' : 'Report'}
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPreview(null)}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

export default Maps;
