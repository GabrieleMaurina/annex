import type { ReactNode } from 'react';
import { Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { titleOf } from '../tree';

type Props =
  | { to: string; app?: never; children?: ReactNode }
  | { app: string; to?: never; children: ReactNode };

const CHIP_CLASS =
  'btn-chip rounded-pill py-0 px-2 mx-1 align-baseline text-nowrap';

function WikiLink({ to, app, children }: Props) {
  const navigate = useNavigate();
  if (app !== undefined) {
    return (
      <Button
        data-skip-search
        variant="outline-info"
        size="sm"
        className={CHIP_CLASS}
        onClick={() => navigate(app)}
      >
        {children} <span aria-hidden>↗</span>
      </Button>
    );
  }
  return (
    <Button
      data-skip-search
      variant="outline-primary"
      size="sm"
      className={CHIP_CLASS}
      onClick={() => navigate(`/wiki/${to}`)}
    >
      {children ?? titleOf(to.split('#')[0])} <span aria-hidden>›</span>
    </Button>
  );
}

export default WikiLink;
