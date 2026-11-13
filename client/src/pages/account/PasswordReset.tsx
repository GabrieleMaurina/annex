import { useState } from 'react';
import { Alert, Button, Container, Form } from 'react-bootstrap';
import { formatError } from '../../common/formatError';
import WhiteIcon from '../../common/icons/WhiteIcon';
import { connector } from '../../connector';
import { passwordProblem } from '../../lib/password';

interface Props {
  code: string;
  navigate: (path: string) => void;
}

function PasswordReset({ code, navigate }: Props) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'form' | 'ok'>('form');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('passwords do not match');
      return;
    }
    const problem = passwordProblem(password);
    if (problem) {
      setError(problem);
      return;
    }
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
          <Form.Control
            type="password"
            placeholder="Confirm password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {error && (
            <Alert variant="danger" className="py-1 px-2 mb-0 small">
              {formatError(error)}
            </Alert>
          )}
          <Button
            className="d-inline-flex align-items-center justify-content-center gap-1"
            type="submit"
            disabled={busy}
          >
            <WhiteIcon path="/icons/check.svg" />
            Update password
          </Button>
        </Form>
      )}
      <Button
        variant="outline-secondary"
        className="mt-2 d-inline-flex align-items-center justify-content-center gap-1"
        onClick={() => navigate('/')}
      >
        <WhiteIcon path="/icons/globe.svg" />
        Go to Annex
      </Button>
    </Container>
  );
}

export default PasswordReset;
