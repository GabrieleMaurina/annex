import { useEffect, useState } from 'react';
import { Container } from 'react-bootstrap';
import { socket } from './socket';

function App() {
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  return (
    <Container className="py-5">
      <h1>client</h1>
      <p>{connected ? 'Connected' : 'Disconnected'}</p>
    </Container>
  );
}

export default App;
