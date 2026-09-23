import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { useId } from 'react';
import type { OverlayTriggerProps } from 'react-bootstrap';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';

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
  return (
    <OverlayTrigger
      placement={placement}
      trigger={trigger}
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
