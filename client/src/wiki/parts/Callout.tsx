import type { ReactNode } from 'react';
import { Alert } from 'react-bootstrap';

const KINDS = {
  tip: { variant: 'success', label: 'Tip' },
  note: { variant: 'info', label: 'Note' },
  warning: { variant: 'warning', label: 'Careful' },
} as const;

interface Props {
  kind?: keyof typeof KINDS;
  children: ReactNode;
}

function Callout({ kind = 'note', children }: Props) {
  const { variant, label } = KINDS[kind];
  return (
    <Alert variant={variant} role="note" className="py-2 px-3 small">
      <strong>{label}:</strong> {children}
    </Alert>
  );
}

export default Callout;
