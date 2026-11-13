import { useState } from 'react';
import { Button, Container } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import WhiteIcon from '../common/icons/WhiteIcon';
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
          <Button
            variant="success"
            className="d-inline-flex align-items-center justify-content-center gap-1"
            onClick={() => navigate('/maps/editor')}
          >
            <WhiteIcon path="/icons/plus.svg" />
            Create a map
          </Button>
          <Button
            variant="secondary"
            className="d-inline-flex align-items-center justify-content-center gap-1"
            onClick={() => navigate('/maps/mine')}
          >
            <WhiteIcon path="/icons/map.svg" />
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
