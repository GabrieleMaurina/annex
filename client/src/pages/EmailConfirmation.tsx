import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Container } from 'react-bootstrap';
import { formatError } from '../common/formatError';
import { connector } from '../connector';

interface Props {
  code: string;
  navigate: (path: string) => void;
}

function EmailConfirmation({ code, navigate }: Props) {
  const [status, setStatus] = useState<'pending' | 'ok' | 'error'>('pending');
  const [error, setError] = useState('');
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    connector.confirmEmail({ code }, (res) => {
      if (res.ok) {
        setStatus('ok');
      } else {
        setStatus('error');
        setError(res.error);
      }
    });
  }, [code]);

  return (
    <Container className="py-5 d-flex flex-column align-items-start gap-3">
      {status === 'pending' && <p className="mb-0">Confirming your email...</p>}
      {status === 'ok' && (
        <Alert variant="success" className="mb-0">
          Email confirmed. You can now log in.
        </Alert>
      )}
      {status === 'error' && (
        <Alert variant="danger" className="mb-0">
          {formatError(error)}
        </Alert>
      )}
      <Button onClick={() => navigate('/')}>Go to Annex</Button>
    </Container>
  );
}

export default EmailConfirmation;
