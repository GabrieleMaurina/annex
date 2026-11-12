import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { DragState } from './dragDrop';

function DragGhost<T>({
  drag,
  render,
}: {
  drag: DragState<T> | null;
  render: (item: T) => ReactNode;
}) {
  if (!drag) return null;
  return createPortal(
    <div
      className="pe-none"
      style={{
        position: 'fixed',
        left: drag.x,
        top: drag.y,
        transform: 'translate(-50%, -50%) scale(1.08)',
        zIndex: 2000,
        filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4))',
      }}
    >
      {render(drag.item)}
    </div>,
    document.body,
  );
}

export default DragGhost;
