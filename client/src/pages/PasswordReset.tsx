import { useState } from 'react';
import { Alert, Button, Container, Form } from 'react-bootstrap';
import { formatError } from '../common/formatError';
import { connector } from '../connector';

interface Props {
  code: string;
  navigate: (path: string) => void;
}

function PasswordReset({ code, navigate }: Props) {
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'form' | 'ok'>('form');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    connector.resetPassword({ code, password }, (res) => {
      setBusy(false);
      if (res.ok) {
        setStatus('ok');
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Container className="py-5" style={{ maxWidth: 360 }}>
      {status === 'ok' ? (
        <Alert variant="success">Password updated. You can now log in.</Alert>
      ) : (
        <Form onSubmit={submit} className="d-flex flex-column gap-2">
          <h5>Choose a new password</h5>
          <Form.Control
            type="password"
            placeholder="New password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <Alert variant="danger" className="py-1 px-2 mb-0 small">
              {formatError(error)}
            </Alert>
          )}
          <Button type="submit" disabled={busy}>
            Update password
          </Button>
        </Form>
      )}
      <Button
        variant="link"
        className="px-0 mt-2"
        onClick={() => navigate('/')}
      >
        Go to Annex
      </Button>
    </Container>
  );
}

export default PasswordReset;
