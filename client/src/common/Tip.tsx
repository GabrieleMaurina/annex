import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { useId } from 'react';
import type { OverlayTriggerProps } from 'react-bootstrap';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';

type Placement = NonNullable<OverlayTriggerProps['placement']>;

interface Props {
  text: ReactNode;
  placement?: Placement;
  style?: CSSProperties;
  children: ReactElement;
}

function Tip({ text, placement = 'auto', style, children }: Props) {
  const id = useId();
  return (
    <OverlayTrigger
      placement={placement}
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
