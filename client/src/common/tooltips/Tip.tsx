import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { useCallback, useEffect, useId, useState } from 'react';
import type { OverlayTriggerProps } from 'react-bootstrap';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';
import { clearActiveTip, closeAllTips, setActiveTip } from './activeTip';

type Placement = NonNullable<OverlayTriggerProps['placement']>;
type Trigger = OverlayTriggerProps['trigger'];

interface Props {
  text: ReactNode;
  placement?: Placement;
  style?: CSSProperties;
  trigger?: Trigger;
  popperConfig?: OverlayTriggerProps['popperConfig'];
  children: ReactElement;
}

function Tip({
  text,
  placement = 'auto',
  style,
  trigger,
  popperConfig,
  children,
}: Props) {
  const id = useId();
  const [show, setShow] = useState(false);

  const close = useCallback(() => setShow(false), []);

  useEffect(
    () => () => {
      clearActiveTip(close);
    },
    [close],
  );

  function toggle(next: boolean) {
    if (!next) {
      setShow(false);
      clearActiveTip(close);
      return;
    }
    if (document.body.classList.contains('dnd-dragging')) return;
    closeAllTips();
    setActiveTip(close);
    setShow(true);
  }

  return (
    <OverlayTrigger
      placement={placement}
      trigger={trigger}
      show={show}
      onToggle={toggle}
      popperConfig={popperConfig}
      delay={{ show: 0, hide: 0 }}
      overlay={
        <Tooltip id={id} style={{ whiteSpace: 'pre-line', ...style }}>
          {text}
        </Tooltip>
      }
    >
      {children}
    </OverlayTrigger>
  );
}

export default Tip;
