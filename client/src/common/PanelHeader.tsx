import type { ReactNode } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  right?: ReactNode;
}

function PanelHeader({ title, onClose, right }: Props) {
  return (
    <div
      className="fw-bold lh-1 mb-2 flex-shrink-0 d-flex justify-content-between gap-3"
      role="button"
      tabIndex={0}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.stopPropagation();
          onClose();
        }
      }}
      style={{ cursor: 'pointer' }}
    >
      <span>{title}</span>
      {right}
    </div>
  );
}

export default PanelHeader;
