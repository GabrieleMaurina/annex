interface Props {
  position: { x: number; y: number } | null;
  labels: string[];
  offset: number;
}

export default function TerritoryTooltip({ position, labels, offset }: Props) {
  if (!position || labels.length === 0) return null;
  return (
    <div
      className="position-absolute px-2 py-1 rounded text-white small"
      style={{
        left: position.x,
        top: position.y - offset - 8,
        transform: 'translate(-50%, -100%)',
        background: 'rgba(0, 0, 0, 0.85)',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        zIndex: 3,
      }}
    >
      {labels.join(' · ')}
    </div>
  );
}
