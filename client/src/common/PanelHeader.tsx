interface Props {
  title: string;
  onClose: () => void;
}

function PanelHeader({ title, onClose }: Props) {
  return (
    <div
      className="fw-bold lh-1 mb-2 flex-shrink-0"
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
      {title}
    </div>
  );
}

export default PanelHeader;
