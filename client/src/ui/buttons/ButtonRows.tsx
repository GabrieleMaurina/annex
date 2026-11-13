import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

function ButtonRows({ children }: Props) {
  return <div className="d-grid gap-2">{children}</div>;
}

export default ButtonRows;
