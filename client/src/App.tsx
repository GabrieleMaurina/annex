import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Container } from 'react-bootstrap';
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
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
import Games from './pages/Games';
import Home from './pages/Home';
import Login from './pages/Login';
import PasswordReset from './pages/PasswordReset';
import PlayerProfile from './pages/PlayerProfile';
import Players from './pages/Players';
import ReplayPage from './pages/ReplayPage';

function EmailConfirmationRoute({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const { code = '' } = useParams();
  return <EmailConfirmation code={code} navigate={navigate} />;
}

function PasswordResetRoute({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const { code = '' } = useParams();
  return <PasswordReset code={code} navigate={navigate} />;
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
  const [passwordError, setPasswordError] = useState(false);
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

  const room = roomFromPath(pathname);
  const isOffline = room === 'offline';
  const inGame = room !== 'home';

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
          setPasswordError(false);
          connector.requestState();
          return;
        }
        if (res.error === 'invalid password') {
          setNeedsPassword(true);
          setPasswordError(password !== undefined);
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
              setPasswordError(false);
              connector.requestState();
            } else if (retryRes.error === 'invalid password') {
              setNeedsPassword(true);
              setPasswordError(password !== undefined);
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
      setPasswordError(false);
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
      territories: Territory[];
      bonuses: number[];
      imageSrc: string;
    }) {
      registerGeneratedMap(data.name, {
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

  const gameElement = (
    <Game
      key={room}
      selfId={selfId}
      joinError={joinError}
      needsPassword={needsPassword}
      passwordError={passwordError}
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
        <Route
          path="/email_confirmation/:code"
          element={<EmailConfirmationRoute navigate={navigate} />}
        />
        <Route
          path="/password_reset/:code"
          element={<PasswordResetRoute navigate={navigate} />}
        />
        <Route
          path="/friends"
          element={
            !sessionReady ? null : account ? (
              <Friends account={account} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route path="/players" element={<Players />} />
        <Route
          path="/players/:username"
          element={<PlayerProfile account={account} />}
        />
        <Route path="/games/replay" element={<Games account={account} />} />
        <Route
          path="/games/replay/:id"
          element={<ReplayPage navigate={navigate} />}
        />
        <Route path="/games/offline" element={gameElement} />
        <Route path="/games/live/:gameName" element={gameElement} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
