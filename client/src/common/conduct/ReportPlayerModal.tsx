import { REPORT_REASONS } from 'engine';
import { useId, useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';
import { useToggleSound } from '../../lib/sounds';
import { titleCase } from '../../lobby/settings/gameSettings';
import { formatError } from '../formatError';

const PICTURE_REASON = 'offensive picture';

export type ConductAck = { ok: true } | { ok: false; error: string };

interface Props {
  show: boolean;
  includePicture: boolean;
  initialReason?: string;
  onHide: () => void;
  onSubmit: (reason: string, cb: (res: ConductAck) => void) => void;
  onReported: () => void;
}

function ReportPlayerModal({
  show,
  includePicture,
  initialReason,
  onHide,
  onSubmit,
  onReported,
}: Props) {
  const idPrefix = useId();
  const [reason, setReason] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  useToggleSound(show);
  const reasons = REPORT_REASONS.filter(
    (value) => includePicture || value !== PICTURE_REASON,
  );
  const selected =
    reason ??
    (initialReason && reasons.some((value) => value === initialReason)
      ? initialReason
      : null);

  function close() {
    setReason(null);
    setError('');
    onHide();
  }

  function submit() {
    if (!selected) return;
    setSending(true);
    setError('');
    onSubmit(selected, (res) => {
      setSending(false);
      if (!res.ok) {
        setError(formatError(res.error));
        return;
      }
      setReason(null);
      onReported();
      onHide();
    });
  }

  return (
    <Modal show={show} onHide={close} centered>
      <Modal.Header closeButton>
        <Modal.Title>Report player</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          {reasons.map((value) => (
            <Form.Check
              key={value}
              type="radio"
              id={`${idPrefix}-${value.replaceAll(' ', '-')}`}
              name={idPrefix}
              label={titleCase(value)}
              checked={selected === value}
              onChange={() => setReason(value)}
            />
          ))}
        </Form>
        {error && <div className="small text-danger mt-2">{error}</div>}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={close}>
          Cancel
        </Button>
        <Button
          variant="danger"
          disabled={!selected || sending}
          onClick={submit}
        >
          Report
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default ReportPlayerModal;
