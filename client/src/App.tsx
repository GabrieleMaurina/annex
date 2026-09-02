import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Container } from 'react-bootstrap';
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import BurgerMenu from './common/BurgerMenu';
import { connector } from './connector';
import { registerGeneratedMap, type Territory } from './game/mapData';
import { applySavedGameSettings } from './lib/gameSetup';
import { applyServerSettings, setPlayerName } from './lib/player';
import type { Account, Ack, IdentifyResult } from './lib/types';
import AccountPage from './pages/Account';
import EmailConfirmation from './pages/EmailConfirmation';
import Friends from './pages/Friends';
import Game from './pages/Game';
import GameHistory from './pages/GameHistory';
import Home from './pages/Home';
import Login from './pages/Login';
import PasswordReset from './pages/PasswordReset';
import PlayerProfile from './pages/PlayerProfile';
import Players from './pages/Players';

const AUTH_PAGE_PREFIXES = {
  confirm: '/email_confirmation/',
  reset: '/password_reset/',
} as const;

type AuthPage = { kind: keyof typeof AUTH_PAGE_PREFIXES; code: string };

function authPageFromPath(pathname: string): AuthPage | null {
  for (const [kind, prefix] of Object.entries(AUTH_PAGE_PREFIXES)) {
    if (pathname.startsWith(prefix)) {
      try {
        return {
          kind: kind as keyof typeof AUTH_PAGE_PREFIXES,
          code: decodeURIComponent(pathname.slice(prefix.length)),
        };
      } catch {
        return null;
      }
    }
  }
  return null;
}

function roomFromPath(pathname: string): string {
  if (pathname === '/games/offline') return 'offline';
  const match = pathname.match(/^\/games\/live\/([^/]+)/);
  if (match) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return 'home';
    }
  }
  return 'home';
}

function gamePath(name: string): string {
  return `/games/live/${encodeURIComponent(name)}`;
}

function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [joinError, setJoinError] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [kickedMessage, setKickedMessage] = useState('');
  const [sessionTakenOver, setSessionTakenOver] = useState(false);
  const [mapNames, setMapNames] = useState<string[]>([]);
  const [selfId, setSelfId] = useState<number | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  const { pathname } = useLocation();
  const routerNavigate = useNavigate();
  const navigate = useCallback(
    (path: string) => routerNavigate(path),
    [routerNavigate],
  );

  const authPage = authPageFromPath(pathname);
  const onAuthPage = authPage !== null;
  const room = roomFromPath(pathname);
  const isOffline = room === 'offline';
  const inGame = !onAuthPage && room !== 'home';

  const refreshSession = useCallback(function load() {
    connector.session((res) => {
      if (!res.name) {
        setTimeout(load, 1000);
        return;
      }
      setAccount(res.account);
      setPlayerName(res.name);
      applyServerSettings(!!res.account, res.clientSettings, res.gameSettings);
      setSessionReady(true);
    });
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    connector.setMode(isOffline);
  }, [isOffline]);

  const renameRoom = useCallback(
    (newName: string) => {
      if (isOffline) return;
      window.history.replaceState(null, '', gamePath(newName));
    },
    [isOffline],
  );

  const attemptJoin = useCallback(
    (password?: string) => {
      connector.joinGame({ gameName: room, password }, (res: Ack) => {
        if (res.ok || res.error === 'already in a game') {
          setJoinError('');
          setNeedsPassword(false);
          connector.requestState();
          return;
        }
        if (res.error === 'invalid password') {
          setNeedsPassword(true);
          return;
        }
        if (res.error !== 'game not found') {
          setJoinError(res.error);
          return;
        }

        connector.createGame({ name: room }, (createRes: Ack) => {
          if (createRes.ok) {
            applySavedGameSettings();
            setJoinError('');
            connector.requestState();
            return;
          }
          if (createRes.error === 'already in a game') {
            setJoinError('');
            connector.requestState();
            return;
          }
          if (createRes.error !== 'game name already in use') {
            setJoinError(createRes.error);
            return;
          }

          connector.joinGame({ gameName: room, password }, (retryRes: Ack) => {
            if (retryRes.ok || retryRes.error === 'already in a game') {
              setJoinError('');
              connector.requestState();
            } else if (retryRes.error === 'invalid password') {
              setNeedsPassword(true);
            } else {
              setJoinError(retryRes.error);
            }
          });
        });
      });
    },
    [room],
  );

  useEffect(() => {
    if (!inGame) return;
    if (!isOffline && !sessionReady) return;

    function afterConnect() {
      connector.listMaps(setMapNames);
      setNeedsPassword(false);
      if (isOffline) {
        if (!connector.isConvertingOffline()) applySavedGameSettings();
        setJoinError('');
      }
      connector.identify({ room }, (res: IdentifyResult) => {
        setSelfId(res.id);
        if (isOffline) return;
        setPlayerName(res.name);
        if (res.gameName && res.gameName !== room) {
          navigate(gamePath(res.gameName));
          return;
        }
        attemptJoin();
      });
    }

    if (!isOffline) connector.open(room);
    connector.on('connect', afterConnect);
    if (connector.connected) afterConnect();
    return () => {
      connector.off('connect', afterConnect);
      if (!isOffline) connector.close();
    };
  }, [inGame, isOffline, sessionReady, room, attemptJoin, navigate]);

  useEffect(() => {
    function onMapGenerated(data: {
      name: string;
      displayName: string;
      territories: Territory[];
      bonuses: number[];
      imageSrc: string;
    }) {
      registerGeneratedMap(data.name, {
        displayName: data.displayName,
        territories: data.territories,
        bonuses: data.bonuses,
        imageSrc: data.imageSrc,
      });
    }
    connector.on('game:mapGenerated', onMapGenerated);
    return () => {
      connector.off('game:mapGenerated', onMapGenerated);
    };
  }, []);

  useEffect(() => {
    function onKicked(data: { gameName: string }) {
      setKickedMessage(`You were kicked from ${data.gameName}`);
      navigate('/');
    }
    connector.on('game:kicked', onKicked);
    return () => {
      connector.off('game:kicked', onKicked);
    };
  }, [navigate]);

  useEffect(() => {
    function onActor(payload: { selfId: number }) {
      setSelfId(payload.selfId);
    }
    connector.on('offline:actor', onActor);
    return () => {
      connector.off('offline:actor', onActor);
    };
  }, []);

  useEffect(() => {
    function onDisconnect(reason: string) {
      if (reason === 'io server disconnect') setSessionTakenOver(true);
    }
    connector.on('disconnect', onDisconnect);
    return () => {
      connector.off('disconnect', onDisconnect);
    };
  }, []);

  if (sessionTakenOver) {
    return (
      <Container className="py-5">
        <Alert variant="warning">
          This tab was disconnected: opened in another tab or window.
        </Alert>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </Container>
    );
  }

  if (authPage) {
    if (authPage.kind === 'confirm')
      return <EmailConfirmation code={authPage.code} navigate={navigate} />;
    return <PasswordReset code={authPage.code} navigate={navigate} />;
  }

  const gameElement = (
    <Game
      key={room}
      selfId={selfId}
      joinError={joinError}
      needsPassword={needsPassword}
      onSubmitPassword={attemptJoin}
      mapNames={mapNames}
      navigate={navigate}
      onRename={renameRoom}
    />
  );

  return (
    <>
      {!inGame && (
        <div
          className="position-fixed top-0 end-0 m-3"
          style={{ zIndex: 1030 }}
        >
          <BurgerMenu
            account={account}
            navigate={navigate}
            onSessionChange={refreshSession}
          />
        </div>
      )}
      <Routes>
        <Route
          path="/"
          element={
            <Home
              navigate={navigate}
              kickedMessage={kickedMessage}
              clearKickedMessage={() => setKickedMessage('')}
            />
          }
        />
        <Route
          path="/login"
          element={
            <Login
              account={account}
              onSessionChange={refreshSession}
              navigate={navigate}
            />
          }
        />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/friends" element={<Friends />} />
        <Route path="/players" element={<Players />} />
        <Route path="/players/:username" element={<PlayerProfile />} />
        <Route path="/games/history" element={<GameHistory />} />
        <Route path="/games/offline" element={gameElement} />
        <Route path="/games/live/:gameName" element={gameElement} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
