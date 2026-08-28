import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Container } from 'react-bootstrap';
import { registerGeneratedMap, type Territory } from './game/mapData';
import {
  getGameSettings,
  getGameSlots,
  getPlayer,
  savePlayer,
} from './lib/player';
import { socket } from './lib/socket';
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
    function onPopState() {
      setPath(window.location.pathname);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const room = roomFromPath(path);

  function navigate(newPath: string) {
    window.history.pushState(null, '', newPath);
    setPath(newPath);
  }

  const renameRoom = useCallback((newName: string) => {
    window.history.replaceState(null, '', `/${encodeURIComponent(newName)}`);
  }, []);

  const attemptJoin = useCallback(
    (password?: string) => {
      socket.emit('game:join', { gameName: room, password }, (res: Ack) => {
        if (res.ok || res.error === 'already in a game') {
          setJoinError('');
          setNeedsPassword(false);
          socket.emit('game:requestState');
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

        socket.emit('game:create', { name: room }, (createRes: Ack) => {
          if (createRes.ok) {
            const savedSettings = getGameSettings();
            if (savedSettings)
              socket.emit('game:settings', savedSettings, () => {});
            const savedSlots = getGameSlots();
            if (savedSlots)
              socket.emit('game:settings', { slots: savedSlots }, () => {});
            setJoinError('');
            socket.emit('game:requestState');
            return;
          }
          if (createRes.error === 'already in a game') {
            setJoinError('');
            socket.emit('game:requestState');
            return;
          }
          if (createRes.error !== 'game name already in use') {
            setJoinError(createRes.error);
            return;
          }

          socket.emit(
            'game:join',
            { gameName: room, password },
            (retryRes: Ack) => {
              if (retryRes.ok || retryRes.error === 'already in a game') {
                setJoinError('');
                socket.emit('game:requestState');
              } else if (retryRes.error === 'invalid password') {
                setNeedsPassword(true);
              } else {
                setJoinError(retryRes.error);
              }
            },
          );
        });
      });
    },
    [room],
  );

  useEffect(() => {
    function afterConnect() {
      socket.emit('maps:list', (names: string[]) => {
        setMapNames(names);
      });
      socket.emit(
        'player:identify',
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

      attemptJoin();
    }
    if (socket.connected) afterConnect();
    socket.on('connect', afterConnect);
    return () => {
      socket.off('connect', afterConnect);
    };
  }, [room, attemptJoin]);

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
    socket.on('game:mapGenerated', onMapGenerated);
    return () => {
      socket.off('game:mapGenerated', onMapGenerated);
    };
  }, []);

  useEffect(() => {
    function onKicked(data: { gameName: string }) {
      setKickedMessage(`You were kicked from ${data.gameName}`);
      navigate('/');
    }
    socket.on('game:kicked', onKicked);
    return () => {
      socket.off('game:kicked', onKicked);
    };
  }, []);

  useEffect(() => {
    function onDisconnect(reason: string) {
      if (reason === 'io server disconnect') {
        setSessionTakenOver(true);
        return;
      }
      navigate('/');
    }
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  function handleNameChange(name: string) {
    const updated = { ...player, name };
    setPlayer(updated);
    savePlayer(updated);
    socket.emit('player:setName', { name });
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
