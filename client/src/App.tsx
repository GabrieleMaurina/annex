import { useEffect, useRef, useState } from 'react';
import Game from './Game';
import Home from './Home';
import { getPlayer, savePlayer } from './player';
import { socket } from './socket';
import type { Ack, Player } from './types';

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
        if (!res.ok && res.error !== 'already in a game') {
          setJoinError(res.error);
        } else {
          setJoinError('');
        }
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
    function onMaps(names: string[]) {
      setMapNames(names);
    }
    socket.on('maps:list', onMaps);
    return () => {
      socket.off('maps:list', onMaps);
    };
  }, []);

  function handleNameChange(name: string) {
    const updated = { ...player, name };
    setPlayer(updated);
    savePlayer(updated);
    socket.emit('player:setName', { name });
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
      gameName={room}
      selfId={selfId}
      joinError={joinError}
      mapNames={mapNames}
      navigate={navigate}
    />
  );
}

export default App;
