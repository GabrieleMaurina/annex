import type { ReactNode } from 'react';

interface Props {
  twoColumns?: boolean;
  children: ReactNode;
}

function ButtonRows({ twoColumns, children }: Props) {
  return (
    <div
      className={`d-grid gap-2 ${twoColumns ? 'split-columns' : ''}`}
      data-split={twoColumns ? '' : undefined}
    >
      {children}
    </div>
  );
}

export default ButtonRows;
