import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Container } from 'react-bootstrap';
import { connector } from './connector';
import { registerGeneratedMap, type Territory } from './game/mapData';
import { applySavedGameSettings } from './lib/gameSetup';
import { applyServerSettings, setPlayerName } from './lib/player';
import type { Account, AccountChange, Ack, IdentifyResult } from './lib/types';
import EmailConfirmation from './pages/EmailConfirmation';
import Game from './pages/Game';
import Home from './pages/Home';
import PasswordReset from './pages/PasswordReset';

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
  if (pathname === '/') return 'home';
  try {
    return decodeURIComponent(pathname.slice(1));
  } catch {
    return 'home';
  }
}

function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [path, setPath] = useState(window.location.pathname);
  const [joinError, setJoinError] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [kickedMessage, setKickedMessage] = useState('');
  const [sessionTakenOver, setSessionTakenOver] = useState(false);
  const [mapNames, setMapNames] = useState<string[]>([]);
  const [selfId, setSelfId] = useState<number | null>(null);

  const authPage = authPageFromPath(path);
  const onAuthPage = authPage !== null;

  useEffect(() => {
    connector.setMode(roomFromPath(window.location.pathname) === 'offline');
  }, []);

  const applyRoom = useCallback((pathname: string) => {
    connector.setMode(roomFromPath(pathname) === 'offline');
    setPath(pathname);
  }, []);

  useEffect(() => {
    function onPopState() {
      applyRoom(window.location.pathname);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [applyRoom]);

  const room = authPage ? 'home' : roomFromPath(path);
  const isOffline = room === 'offline';

  const navigate = useCallback(
    (newPath: string) => {
      window.history.pushState(null, '', newPath);
      applyRoom(newPath);
    },
    [applyRoom],
  );

  const renameRoom = useCallback(
    (newName: string) => {
      if (isOffline) return;
      window.history.replaceState(null, '', `/${encodeURIComponent(newName)}`);
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
    function afterConnect() {
      connector.listMaps((names: string[]) => {
        setMapNames(names);
      });
      connector.identify({ room }, (res: IdentifyResult) => {
        setSelfId(res.id);
        if (!onAuthPage && res.gameName && res.gameName !== room) {
          navigate(`/${encodeURIComponent(res.gameName)}`);
        }
        if (isOffline) return;
        setAccount(res.account);
        setPlayerName(res.name);
        applyServerSettings(
          !!res.account,
          res.clientSettings,
          res.gameSettings,
        );
      });
      setNeedsPassword(false);
      if (room === 'home') {
        setJoinError('');
        return;
      }
      if (isOffline) {
        applySavedGameSettings();
        setJoinError('');
        return;
      }

      attemptJoin();
    }
    if (connector.connected) afterConnect();
    if (!isOffline) connector.on('connect', afterConnect);
    return () => {
      connector.off('connect', afterConnect);
    };
  }, [room, isOffline, onAuthPage, attemptJoin, navigate]);

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
      if (reason === 'io server disconnect') {
        setSessionTakenOver(true);
        return;
      }
      if (connector.isOffline()) return;
      navigate('/');
    }
    connector.on('disconnect', onDisconnect);
    return () => {
      connector.off('disconnect', onDisconnect);
    };
  }, [navigate]);

  const handleAccountChange = useCallback<AccountChange>(
    (change) => {
      setAccount(change.account);
      applyServerSettings(
        !!change.account,
        change.clientSettings,
        change.gameSettings,
      );
      if (change.gameName != null) {
        const target = `/${encodeURIComponent(change.gameName)}`;
        if (window.location.pathname !== target) navigate(target);
      }
    },
    [navigate],
  );

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
    if (selfId === null)
      return (
        <Container className="py-5">
          <p className="mb-0">Loading...</p>
        </Container>
      );
    if (authPage.kind === 'confirm')
      return <EmailConfirmation code={authPage.code} navigate={navigate} />;
    return <PasswordReset code={authPage.code} navigate={navigate} />;
  }

  if (room === 'home') {
    return (
      <Home
        account={account}
        onAccountChange={handleAccountChange}
        navigate={navigate}
        kickedMessage={kickedMessage}
        clearKickedMessage={() => setKickedMessage('')}
      />
    );
  }

  return (
    <Game
      key={room}
      account={account}
      onAccountChange={handleAccountChange}
      selfId={selfId}
      joinError={joinError}
      needsPassword={needsPassword}
      onSubmitPassword={attemptJoin}
      mapNames={mapNames}
      navigate={navigate}
      onRename={renameRoom}
    />
  );
}

export default App;
