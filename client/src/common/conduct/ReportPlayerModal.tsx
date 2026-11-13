import type { ReportReason } from 'engine';
import { REPORT_REASONS } from 'engine';
import { useId, useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';
import { useToggleSound } from '../../lib/sounds';
import { titleCase } from '../../lobby/settings/gameSettings';
import { formatError } from '../formatError';
import WhiteIcon from '../icons/WhiteIcon';
import Tip from '../tooltips/Tip';

const PICTURE_REASON = 'offensive picture';
const TEXT_REASON = 'offensive text';

const REASON_DESCRIPTIONS: Record<ReportReason, string> = {
  collusion:
    'Secretly teaming up with another player, or playing several accounts in the same game',
  'stream sniping':
    "Watching another player's stream to see hidden information",
  'verbal abuse': 'Insults, harassment, hate speech or threats in chat',
  'fake botting':
    'Pretending to be idle or disconnected so others ignore them, then coming back to play',
  stalling:
    'Deliberately wasting time, using the full turn timer on purpose or dragging out a decided game',
  'offensive picture':
    'A profile picture that is sexual, violent, hateful or otherwise inappropriate',
  'offensive text':
    'A profile text that is sexual, violent, hateful or otherwise inappropriate',
};

export type ConductAck = { ok: true } | { ok: false; error: string };

interface Props {
  show: boolean;
  playerName: string;
  includePicture: boolean;
  includeText: boolean;
  initialReason?: string;
  onHide: () => void;
  onSubmit: (reason: string, cb: (res: ConductAck) => void) => void;
  onReported: () => void;
}

function ReportPlayerModal({
  show,
  playerName,
  includePicture,
  includeText,
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
    (value) =>
      (includePicture || value !== PICTURE_REASON) &&
      (includeText || value !== TEXT_REASON),
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
    <Modal
      show={show}
      onHide={close}
      centered
      dialogClassName="modal-fit mx-auto"
    >
      <Modal.Header closeButton className="gap-3">
        <Modal.Title>Report {playerName}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form className="d-flex flex-column align-items-start">
          {reasons.map((value) => (
            <Tip
              key={value}
              text={REASON_DESCRIPTIONS[value]}
              placement="right"
            >
              <div>
                <Form.Check
                  type="radio"
                  id={`${idPrefix}-${value.replaceAll(' ', '-')}`}
                  name={idPrefix}
                  label={titleCase(value)}
                  checked={selected === value}
                  onChange={() => setReason(value)}
                />
              </div>
            </Tip>
          ))}
        </Form>
        {error && <div className="small text-danger mt-2">{error}</div>}
      </Modal.Body>
      <Modal.Footer>
        <Button
          className="d-inline-flex align-items-center justify-content-center gap-1"
          variant="secondary"
          onClick={close}
        >
          <WhiteIcon path="/icons/close.svg" />
          Cancel
        </Button>
        <Button
          className="d-inline-flex align-items-center justify-content-center gap-1"
          variant="danger"
          disabled={!selected || sending}
          onClick={submit}
        >
          <WhiteIcon path="/icons/report.svg" />
          Report
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default ReportPlayerModal;
