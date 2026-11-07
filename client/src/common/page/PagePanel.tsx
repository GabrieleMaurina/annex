import type { ReactNode } from 'react';
import { Badge } from 'react-bootstrap';
import { PANEL_BG_CLASS } from '../../ui/containers/panelStyle';

interface Props {
  title?: string;
  count?: number;
  className?: string;
  children: ReactNode;
}

function PagePanel({ title, count, className = '', children }: Props) {
  return (
    <section
      className={`page-panel ${PANEL_BG_CLASS} border rounded-3 overflow-hidden ${className}`}
    >
      {title && (
        <header className="page-panel-head d-flex align-items-center gap-2 px-3 py-2">
          <h2 className="page-panel-title fs-4 mb-0">{title}</h2>
          {count !== undefined && (
            <Badge pill bg="primary" text="dark">
              {count}
            </Badge>
          )}
        </header>
      )}
      <div className="p-3">{children}</div>
    </section>
  );
}

export default PagePanel;
