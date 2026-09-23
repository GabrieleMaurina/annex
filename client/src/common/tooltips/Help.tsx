import type { ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';

interface Props {
  children: ReactNode;
}

function Help({ children }: Props) {
  const id = useId();
  const [pinned, setPinned] = useState(false);
  const [hovering, setHovering] = useState(false);
  const iconRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!pinned) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (iconRef.current?.contains(target)) return;
      if (target.closest?.('.tooltip')) return;
      setPinned(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setPinned(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [pinned]);

  function toggle() {
    setPinned((p) => !p);
  }

  return (
    <OverlayTrigger
      trigger={[]}
      show={pinned || hovering}
      placement="auto"
      overlay={
        <Tooltip id={id} className="help-tooltip">
          {children}
        </Tooltip>
      }
    >
      <span
        ref={iconRef}
        role="button"
        tabIndex={0}
        aria-label="Help"
        aria-describedby={id}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onClick={toggle}
        onContextMenu={(e) => {
          e.preventDefault();
          toggle();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') toggle();
        }}
        className="rounded-circle bg-secondary text-white d-inline-flex align-items-center justify-content-center fw-bold flex-shrink-0"
        style={{ width: 16, height: 16, fontSize: 11, cursor: 'help' }}
      >
        ?
      </span>
    </OverlayTrigger>
  );
}

export default Help;
