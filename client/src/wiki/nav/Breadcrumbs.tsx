import { Fragment } from 'react';
import { Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { findSection } from '../tree';

interface Props {
  sectionId: string;
  pageTitle?: string;
}

function Breadcrumbs({ sectionId, pageTitle }: Props) {
  const navigate = useNavigate();
  const section = findSection(sectionId);
  const trail = [
    { label: 'Wiki', path: '/wiki' },
    ...(section ? [{ label: section.title, path: `/wiki/${section.id}` }] : []),
  ];
  return (
    <nav
      aria-label="Breadcrumb"
      className="d-flex flex-wrap align-items-center gap-2 mb-3 small"
    >
      {trail.map((step, i) => (
        <Fragment key={step.path}>
          {i > 0 && <span className="text-body-secondary">›</span>}
          <Button
            variant="secondary"
            size="sm"
            className="py-0"
            disabled={!pageTitle && i === trail.length - 1}
            onClick={() => navigate(step.path)}
          >
            {step.label}
          </Button>
        </Fragment>
      ))}
      {pageTitle && (
        <>
          <span className="text-body-secondary">›</span>
          <span className="fw-semibold" aria-current="page">
            {pageTitle}
          </span>
        </>
      )}
    </nav>
  );
}

export default Breadcrumbs;
