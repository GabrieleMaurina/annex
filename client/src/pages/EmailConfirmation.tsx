import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Container } from 'react-bootstrap';
import { connector } from '../connector';
import { setPlayerName } from '../lib/player';
import type { AccountChange } from '../lib/types';

interface Props {
  code: string;
  navigate: (path: string) => void;
  onAccountChange: AccountChange;
}

function EmailConfirmation({ code, navigate, onAccountChange }: Props) {
  const [status, setStatus] = useState<'pending' | 'ok' | 'error'>('pending');
  const [error, setError] = useState('');
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    connector.confirmEmail({ code }, (res) => {
      if (res.ok) {
        setPlayerName(res.username);
        onAccountChange({
          account: { username: res.username },
          clientSettings: res.clientSettings,
          gameSettings: res.gameSettings,
          gameName: res.gameName,
        });
        setStatus('ok');
      } else {
        setStatus('error');
        setError(res.error);
      }
    });
  }, [code, onAccountChange]);

  return (
    <Container className="py-5 d-flex flex-column align-items-start gap-3">
      {status === 'pending' && <p className="mb-0">Confirming your email...</p>}
      {status === 'ok' && (
        <Alert variant="success" className="mb-0">
          Email confirmed. You are now logged in.
        </Alert>
      )}
      {status === 'error' && (
        <Alert variant="danger" className="mb-0">
          {error}
        </Alert>
      )}
      <Button onClick={() => navigate('/')}>Go to Annex</Button>
    </Container>
  );
}

export default EmailConfirmation;
