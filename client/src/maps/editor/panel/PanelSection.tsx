import type { ReactNode } from 'react';
import { playSound } from '../../../lib/sounds';

interface Props {
  title: string;
  summary?: ReactNode;
  open: boolean;
  setOpen: (open: boolean) => void;
  children: ReactNode;
}

function PanelSection({ title, summary, open, setOpen, children }: Props) {
  return (
    <details
      className="mb-2"
      open={open}
      onToggle={(e) => {
        if (e.currentTarget.open === open) return;
        playSound('click');
        setOpen(e.currentTarget.open);
      }}
    >
      <summary className="collapsible-summary">
        {title}
        {summary && <span className="ms-auto d-flex">{summary}</span>}
      </summary>
      {children}
    </details>
  );
}

export default PanelSection;
