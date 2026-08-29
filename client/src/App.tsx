import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Container } from 'react-bootstrap';
import { connector } from './connector';
import { registerGeneratedMap, type Territory } from './game/mapData';
import { applySavedGameSettings } from './lib/gameSetup';
import { getPlayer, savePlayer } from './lib/player';
import type { Ack, Player } from './lib/types';
import Game from './pages/Game';
import Home from './pages/Home';

function roomFromPath(pathname: string): string {
  if (pathname === '/') return 'home';
  try {
    return decodeURIComponent(pathname.slice(1));
  } catch {
    return 'home';
  }
}

function App() {
  const [player, setPlayer] = useState<Player>(() => getPlayer());
  const [path, setPath] = useState(window.location.pathname);
  const [joinError, setJoinError] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [kickedMessage, setKickedMessage] = useState('');
  const [sessionTakenOver, setSessionTakenOver] = useState(false);
  const [mapNames, setMapNames] = useState<string[]>([]);
  const [selfId, setSelfId] = useState<number | null>(null);
  const playerRef = useRef(player);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    const pathname = window.location.pathname;
    connector.setMode(
      roomFromPath(pathname) === 'offline',
      playerRef.current.name,
    );
  }, []);

  const applyRoom = useCallback((pathname: string) => {
    connector.setMode(
      roomFromPath(pathname) === 'offline',
      playerRef.current.name,
    );
    setPath(pathname);
  }, []);

  useEffect(() => {
    function onPopState() {
      applyRoom(window.location.pathname);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [applyRoom]);

  const room = roomFromPath(path);
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
      connector.identify(
        {
          playerKey: playerRef.current.key,
          playerName: playerRef.current.name,
          room,
        },
        (res: { id: number; gameName: string | null }) => {
          setSelfId(res.id);
          if (res.gameName && res.gameName !== room) {
            navigate(`/${encodeURIComponent(res.gameName)}`);
          }
        },
      );
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
  }, [room, isOffline, attemptJoin, navigate]);

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

  function handleNameChange(name: string) {
    const updated = { ...player, name };
    setPlayer(updated);
    savePlayer(updated);
    connector.setName({ name });
  }

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

  if (room === 'home') {
    return (
      <Home
        player={player}
        onNameChange={handleNameChange}
        navigate={navigate}
        kickedMessage={kickedMessage}
        clearKickedMessage={() => setKickedMessage('')}
      />
    );
  }

  return (
    <Game
      key={room}
      player={player}
      onNameChange={handleNameChange}
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
