import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Container } from 'react-bootstrap';
import Game from './pages/Game';
import Home from './pages/Home';
import { getPlayer, savePlayer } from './lib/player';
import { socket } from './lib/socket';
import type { Ack, Player } from './lib/types';

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
        (res: { id: number }) => {
          setSelfId(res.id);
        },
      );
      if (room === 'home') {
        setJoinError('');
        return;
      }

      socket.emit('game:join', { gameName: room }, (res: Ack) => {
        if (res.ok || res.error === 'already in a game') {
          setJoinError('');
          return;
        }
        if (res.error !== 'game not found') {
          setJoinError(res.error);
          return;
        }

        socket.emit('game:create', { name: room }, (createRes: Ack) => {
          if (createRes.ok || createRes.error === 'already in a game') {
            setJoinError('');
            return;
          }
          if (createRes.error !== 'game name already in use') {
            setJoinError(createRes.error);
            return;
          }

          socket.emit('game:join', { gameName: room }, (retryRes: Ack) => {
            if (retryRes.ok || retryRes.error === 'already in a game') {
              setJoinError('');
            } else {
              setJoinError(retryRes.error);
            }
          });
        });
      });
    }
    if (socket.connected) afterConnect();
    socket.on('connect', afterConnect);
    return () => {
      socket.off('connect', afterConnect);
    };
  }, [room]);

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
      mapNames={mapNames}
      navigate={navigate}
    />
  );
}

export default App;
