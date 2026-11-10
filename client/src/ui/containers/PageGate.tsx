import { useState } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { WIKI_PATH } from './wikiPath';

const EDITOR_EARTH_PATH = /^(\/maps\/editor(?:\/[^/]+)?)\/earth$/;

export function Gate({ silent, local }: { silent?: boolean; local?: boolean }) {
  return (
    <div
      className={local ? 'page-gate page-gate-local' : 'page-gate'}
      aria-hidden
      data-no-gate-sound={silent || undefined}
    >
      <div className="page-gate-door page-gate-left" />
      <div className="page-gate-door page-gate-right" />
    </div>
  );
}

function PageGate() {
  const page = useLocation()
    .pathname.replace(EDITOR_EARTH_PATH, '$1')
    .replace(WIKI_PATH, '/wiki');
  const navigationType = useNavigationType();
  const [gate, setGate] = useState({ page, opening: 0 });

  if (gate.page !== page) {
    setGate({
      page,
      opening: navigationType === 'REPLACE' ? gate.opening : gate.opening + 1,
    });
  }

  if (gate.opening === 0) return null;

  return <Gate key={gate.opening} />;
}

export default PageGate;
