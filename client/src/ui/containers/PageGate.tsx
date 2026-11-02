import { useState } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const EDITOR_EARTH_PATH = /^(\/maps\/editor(?:\/[^/]+)?)\/earth$/;

function PageGate() {
  const page = useLocation().pathname.replace(EDITOR_EARTH_PATH, '$1');
  const navigationType = useNavigationType();
  const [gate, setGate] = useState({ page, opening: 0 });

  if (gate.page !== page) {
    setGate({
      page,
      opening: navigationType === 'REPLACE' ? gate.opening : gate.opening + 1,
    });
  }

  if (gate.opening === 0) return null;

  return (
    <div key={gate.opening} className="page-gate" aria-hidden>
      <div className="page-gate-door page-gate-left" />
      <div className="page-gate-door page-gate-right" />
    </div>
  );
}

export default PageGate;
