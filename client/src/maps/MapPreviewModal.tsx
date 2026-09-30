import { useState } from 'react';
import { Button, Modal } from 'react-bootstrap';
import { connector } from '../connector';
import type { Account, PlayerMapRow } from '../lib/types';
import { mapImageUrl } from './mapUrl';

function MapPreviewModal({
  account,
  preview,
  onHide,
}: {
  account: Account | null;
  preview: PlayerMapRow | null;
  onHide: () => void;
}) {
  const [reported, setReported] = useState(false);

  function report() {
    if (!preview) return;
    connector.reportMap(preview.id, (res) => {
      if (res.ok || res.error === 'already reported') setReported(true);
    });
  }

  return (
    <Modal
      show={!!preview}
      onHide={onHide}
      onExited={() => setReported(false)}
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
                Generated: {preview.generation.type}, {preview.generation.fill}{' '}
                fill, {preview.generation.size} · seed {preview.generation.seed}
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
        <Button variant="secondary" size="sm" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default MapPreviewModal;
