import { useState } from 'react';
import { Button, Container } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import PagePanel from '../common/page/PagePanel';
import type { Account, PlayerMapRow } from '../lib/types';
import MapBrowser from './MapBrowser';
import MapPreviewModal from './MapPreviewModal';

function Maps({
  account,
  serverUnreachable,
}: {
  account: Account | null;
  serverUnreachable: boolean;
}) {
  const navigate = useNavigate();
  const [preview, setPreview] = useState<PlayerMapRow | null>(null);

  return (
    <Container fluid className="py-5 px-2 px-sm-4">
      <h1 className="text-center mb-3">Maps</h1>
      {(account || serverUnreachable) && (
        <div className="d-flex justify-content-center gap-2 mb-4">
          <Button variant="success" onClick={() => navigate('/maps/editor')}>
            Create a map
          </Button>
          <Button variant="secondary" onClick={() => navigate('/maps/mine')}>
            My maps
          </Button>
        </div>
      )}

      <PagePanel>
        <MapBrowser account={account} mode="browse" onRowClick={setPreview} />
      </PagePanel>

      <MapPreviewModal
        account={account}
        preview={preview}
        onHide={() => setPreview(null)}
      />
    </Container>
  );
}

export default Maps;
