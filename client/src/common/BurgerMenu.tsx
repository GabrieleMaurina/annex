import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { Button } from 'react-bootstrap';
import { useLocation } from 'react-router-dom';
import { connector } from '../connector';
import { getPlayerName, subscribePlayerName } from '../lib/player';
import { rankForElo } from '../lib/ranks';
import type { Account } from '../lib/types';
import { useWhiteIcon } from './icon';
import { PANEL_BG_CLASS, PANEL_CLASS } from './panelStyle';

const LINKS: { label: string; path: string }[] = [
  { label: 'Home', path: '/' },
  { label: 'Games', path: '/games/replay' },
  { label: 'Players', path: '/players' },
  { label: 'Friends', path: '/friends' },
];

interface Props {
  navigate: (path: string) => void;
  account?: Account | null;
  onSessionChange?: () => void;
}

function BurgerMenu({ navigate, account, onSessionChange }: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const whiteMenuIcon = useWhiteIcon('/icons/menu.svg');
  const { pathname } = useLocation();
  const name = useSyncExternalStore(subscribePlayerName, getPlayerName);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) close();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  function go(path: string) {
    close();
    navigate(path);
  }

  function logOut() {
    connector.logout((res) => {
      close();
      if (res.ok) {
        onSessionChange?.();
        navigate('/');
      }
    });
  }

  const showAuth = account !== undefined;

  return (
    <div className="position-relative text-end">
      {!open && (
        <Button
          variant="secondary"
          size="sm"
          className="d-flex align-items-center justify-content-center"
          style={{ width: 28, height: 28, padding: 0 }}
          onClick={() => setOpen(true)}
        >
          <img
            src={whiteMenuIcon ?? '/icons/menu.svg'}
            width={16}
            height={16}
            alt="Menu"
          />
        </Button>
      )}

      {open && (
        <div
          ref={panelRef}
          className={`${PANEL_BG_CLASS} ${PANEL_CLASS} position-absolute end-0 mt-2 d-flex flex-column gap-2`}
          style={{ width: 200, zIndex: 10 }}
        >
          {name && (
            <div className="text-center fw-semibold text-truncate d-flex align-items-center justify-content-center gap-1">
              {account && (
                <img
                  src={`/ranks/${rankForElo(account.elo).image}.svg`}
                  width={20}
                  height={20}
                  alt={rankForElo(account.elo).name}
                />
              )}
              {name}
            </div>
          )}
          {LINKS.map((link) => (
            <Button
              key={link.path}
              variant="secondary"
              size="sm"
              disabled={pathname === link.path}
              onClick={() => go(link.path)}
            >
              {link.label}
            </Button>
          ))}
          {showAuth &&
            (account ? (
              <Button variant="secondary" size="sm" onClick={logOut}>
                Log out
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                disabled={pathname === '/login'}
                onClick={() => go('/login')}
              >
                Log in
              </Button>
            ))}
        </div>
      )}
    </div>
  );
}

export default BurgerMenu;
