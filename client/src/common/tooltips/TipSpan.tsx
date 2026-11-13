import type { ComponentProps, ReactNode } from 'react';
import Tip from './Tip';

interface Props {
  text: ReactNode;
  placement?: ComponentProps<typeof Tip>['placement'];
  className?: string;
  children: ReactNode;
}

function TipSpan({
  text,
  placement,
  className = 'd-inline-block',
  children,
}: Props) {
  return (
    <Tip text={text} placement={placement}>
      <span className={className}>{children}</span>
    </Tip>
  );
}

export default TipSpan;
