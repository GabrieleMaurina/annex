import type { ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useToggleSound } from '../../lib/sounds';

interface Props {
  tip: ReactNode;
  children: ReactNode;
}

function Help({ tip, children }: Props) {
  const id = useId();
  const [pinned, setPinned] = useState(false);
  useToggleSound(pinned);
  const [hovering, setHovering] = useState(false);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!pinned) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (labelRef.current?.contains(target)) return;
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
          {tip}
        </Tooltip>
      }
    >
      <span
        ref={labelRef}
        role="button"
        tabIndex={0}
        aria-describedby={id}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onClick={(e) => {
          e.preventDefault();
          toggle();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          toggle();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') toggle();
        }}
        style={{ cursor: 'help' }}
      >
        {children}
      </span>
    </OverlayTrigger>
  );
}

export default Help;
