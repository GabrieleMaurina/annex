import type { ReactElement, ReactNode } from 'react';
import { useId } from 'react';
import type { OverlayTriggerProps } from 'react-bootstrap';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';

type Placement = NonNullable<OverlayTriggerProps['placement']>;

interface Props {
  text: ReactNode;
  placement?: Placement;
  children: ReactElement;
}

function Tip({ text, placement = 'auto', children }: Props) {
  const id = useId();
  return (
    <OverlayTrigger
      placement={placement}
      delay={{ show: 0, hide: 0 }}
      overlay={
        <Tooltip id={id} style={{ whiteSpace: 'pre-line' }}>
          {text}
        </Tooltip>
      }
    >
      {children}
    </OverlayTrigger>
  );
}

export default Tip;
