import { Modal } from 'react-bootstrap';

interface Props {
  title: string;
  imageSrc: string;
  details?: string;
  onHide: () => void;
}

function MapImageModal({ title, imageSrc, details, onHide }: Props) {
  return (
    <Modal show onHide={onHide} fullscreen>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="d-flex flex-column align-items-center gap-2">
        <img
          src={imageSrc}
          alt=""
          className="w-100 rounded border object-fit-contain"
          style={{ maxHeight: '80vh' }}
        />
        {details && <div className="text-body-secondary">{details}</div>}
      </Modal.Body>
    </Modal>
  );
}

export default MapImageModal;
