import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { Badge, Button } from 'react-bootstrap';
import { useLocation } from 'react-router-dom';
import { connector } from '../../connector';
import { isTypingTarget } from '../../game/GameMap/helpers';
import {
  getMessagesSnapshot,
  setMessagesEnabled,
  subscribeMessages,
  totalUnread,
} from '../../lib/messages';
import { getPlayerName, subscribePlayerName } from '../../lib/player';
import { useToggleSound } from '../../lib/sounds';
import type { Account } from '../../lib/types';
import { setLoginReturnPath } from '../../pages/account/loginReturn';
import { PANEL_BG_CLASS, PANEL_CLASS } from '../../ui/containers/panelStyle';
import Flag from '../badges/Flag';
import RankIcon from '../badges/RankIcon';
import { useWhiteIcon } from '../icon';
import WhiteIcon from '../icons/WhiteIcon';
import Tip from '../tooltips/Tip';
import TipSpan from '../tooltips/TipSpan';
import { setShortcutsOpen } from './shortcuts/shortcutsOpen';

const LINKS: { label: string; path: string; icon: string }[] = [
  { label: 'Home', path: '/', icon: 'globe' },
  { label: 'Games', path: '/games/replay', icon: 'logs' },
  { label: 'Maps', path: '/maps', icon: 'map' },
  { label: 'Players', path: '/players', icon: 'player' },
  { label: 'Friends', path: '/friends', icon: 'team' },
  { label: 'Messages', path: '/messages', icon: 'message' },
  { label: 'Tutorials', path: '/tutorials', icon: 'book' },
  { label: 'Wiki', path: '/wiki', icon: 'target' },
];

const LOGGED_IN_ONLY = ['/friends', '/messages'];

interface Props {
  navigate: (path: string) => void;
  account?: Account | null;
  onSessionChange?: () => void;
  hideLogout?: boolean;
}

function BurgerMenu({ navigate, account, onSessionChange, hideLogout }: Props) {
  const [open, setOpen] = useState(false);
  useToggleSound(open);
  const panelRef = useRef<HTMLDivElement>(null);
  const whiteMenuIcon = useWhiteIcon('/icons/menu.svg');
  const { pathname } = useLocation();
  const name = useSyncExternalStore(subscribePlayerName, getPlayerName);
  const messages = useSyncExternalStore(subscribeMessages, getMessagesSnapshot);
  const unread = totalUnread(messages);

  useEffect(() => {
    setMessagesEnabled(!!account);
  }, [account]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target))
        return;
      if (e.key.toLowerCase() === 'm') setOpen((prev) => !prev);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

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
  const links = account
    ? LINKS
    : LINKS.filter((link) => !LOGGED_IN_ONLY.includes(link.path));

  return (
    <div className="position-relative text-end">
      {!open && (
        <Tip text="Open the menu" placement="left">
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
        </Tip>
      )}
      {!open && unread > 0 && (
        <Badge
          bg="danger"
          className="position-absolute top-0 end-0 translate-middle"
          style={{ zIndex: 11 }}
        >
          {unread}
        </Badge>
      )}

      {open && (
        <div
          ref={panelRef}
          className={`${PANEL_BG_CLASS} ${PANEL_CLASS} position-absolute end-0 mt-2 d-flex flex-column gap-2 overflow-y-auto overflow-x-hidden no-scrollbar`}
          style={{ width: 200, zIndex: 10, maxHeight: 'calc(100dvh - 72px)' }}
        >
          {name &&
            (account ? (
              <TipSpan className="d-grid flex-shrink-0" text="Your account">
                <Button
                  variant="secondary"
                  size="sm"
                  className="fw-semibold text-truncate d-flex align-items-center justify-content-center gap-1"
                  disabled={pathname === '/account'}
                  onClick={() => go('/account')}
                >
                  <RankIcon elo={account.elo} />
                  <Flag country={account.country} />
                  {name}
                </Button>
              </TipSpan>
            ) : (
              <div className="flex-shrink-0 text-center fw-semibold text-truncate">
                {name}
              </div>
            ))}
          {links.map((link) => (
            <Button
              key={link.path}
              variant="secondary"
              size="sm"
              className="d-flex align-items-center justify-content-center gap-1"
              disabled={pathname === link.path}
              onClick={() => go(link.path)}
            >
              <WhiteIcon path={`/icons/${link.icon}.svg`} />
              {link.label}
              {link.path === '/messages' && unread > 0 && (
                <Badge bg="danger" className="ms-2">
                  {unread}
                </Badge>
              )}
            </Button>
          ))}
          <Button
            variant="secondary"
            size="sm"
            className="d-flex align-items-center justify-content-center gap-1"
            onClick={() => {
              close();
              setShortcutsOpen(true);
            }}
          >
            <WhiteIcon path="/icons/gear.svg" />
            Shortcuts
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="d-flex align-items-center justify-content-center gap-1"
            disabled={pathname === '/about'}
            onClick={() => go('/about')}
          >
            <WhiteIcon path="/icons/bonus.svg" />
            About
          </Button>
          {showAuth &&
            (account ? (
              !hideLogout && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="d-flex align-items-center justify-content-center gap-1"
                  onClick={logOut}
                >
                  <WhiteIcon path="/icons/logout.svg" />
                  Log out
                </Button>
              )
            ) : (
              <Button
                variant="secondary"
                size="sm"
                className="d-flex align-items-center justify-content-center gap-1"
                disabled={pathname === '/login'}
                onClick={() => {
                  const path = window.location.pathname;
                  setLoginReturnPath(
                    /^\/(email_confirmation|password_reset)\//.test(path)
                      ? '/'
                      : path + window.location.search,
                  );
                  go('/login');
                }}
              >
                <WhiteIcon path="/icons/login.svg" />
                Log in
              </Button>
            ))}
        </div>
      )}
    </div>
  );
}

export default BurgerMenu;
