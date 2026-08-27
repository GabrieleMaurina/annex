import Tip from '../../common/Tip';

export default function AlliancePopupButtons({
  confirmText,
  denyText,
  onConfirm,
  onDeny,
}: {
  confirmText: string;
  denyText: string;
  onConfirm: () => void;
  onDeny: () => void;
}) {
  return (
    <>
      <Tip text={confirmText} placement="bottom">
        <button
          type="button"
          className="border-0 bg-transparent d-inline-flex align-items-center justify-content-center lh-1"
          style={{ fontSize: 18, padding: '3px 6px', color: 'green' }}
          onClick={onConfirm}
        >
          ✔️
        </button>
      </Tip>
      <Tip text={denyText} placement="bottom">
        <button
          type="button"
          className="border-0 border-start bg-transparent d-inline-flex align-items-center justify-content-center lh-1"
          style={{ fontSize: 18, padding: '3px 6px', color: 'red' }}
          onClick={onDeny}
        >
          ❌
        </button>
      </Tip>
    </>
  );
}
