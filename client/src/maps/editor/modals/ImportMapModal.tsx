import { Modal } from 'react-bootstrap';
import type { Account } from '../../../lib/types';
import MapBrowser from '../../MapBrowser';

interface Props {
  show: boolean;
  onHide: () => void;
  account: Account | null;
  onPick: (mapId: string) => void;
}

function ImportMapModal({ show, onHide, account, onPick }: Props) {
  return (
    <Modal show={show} onHide={onHide} size="xl">
      <Modal.Header closeButton>
        <Modal.Title>Import a map</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <MapBrowser
          account={account}
          mode="pick"
          onRowClick={(row) => onPick(row.id)}
        />
      </Modal.Body>
    </Modal>
  );
}

export default ImportMapModal;
