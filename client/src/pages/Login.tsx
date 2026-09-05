import { containsProfanity } from 'engine';
import { useState } from 'react';
import { Alert, Button, Container, Form, InputGroup } from 'react-bootstrap';
import { formatError } from '../common/formatError';
import { connector } from '../connector';
import { getPlayerName } from '../lib/player';
import type { Account } from '../lib/types';

type Mode = 'login' | 'register' | 'forgotPassword' | 'info';

interface Props {
  account: Account | null;
  onSessionChange: () => void;
  navigate: (path: string) => void;
}

function Login({ account, onSessionChange, navigate }: Props) {
  const [mode, setMode] = useState<Mode>('login');
  const [info, setInfo] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [revealPassword, setRevealPassword] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loginFailed, setLoginFailed] = useState(false);

  function goto(next: Mode) {
    setError('');
    setInfo('');
    setMode(next);
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    connector.login({ email, password, stayLoggedIn }, (res) => {
      if (!res.ok) {
        setError(res.error);
        setBusy(false);
        setLoginFailed(true);
        return;
      }
      onSessionChange();
      navigate('/');
    });
  }

  function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[A-Za-z0-9]{3,10}$/.test(username)) {
      setError('username must be 3-10 letters or digits');
      return;
    }
    if (containsProfanity(username)) {
      setError('username contains profanity');
      return;
    }
    if (password !== confirmPassword) {
      setError('passwords do not match');
      return;
    }
    setBusy(true);
    setError('');
    connector.register({ username, email, password }, (res) => {
      setBusy(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setInfo('Check your email to confirm your account, then log in.');
      setMode('info');
    });
  }

  function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    connector.requestPasswordReset({ email }, () => {
      setBusy(false);
      setInfo(
        'If that email has an account, a password reset link has been sent to it.',
      );
      setMode('info');
    });
  }

  function handleLogout() {
    setError('');
    connector.logout((res) => {
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSessionChange();
    });
  }

  const submit: Record<Mode, (e: React.FormEvent) => void> = {
    login: handleLogin,
    register: handleRegister,
    forgotPassword: handleForgotPassword,
    info: (e) => e.preventDefault(),
  };

  const submitLabel: Record<Mode, string> = {
    login: 'Log in',
    register: 'Create account',
    forgotPassword: 'Send reset link',
    info: '',
  };

  const showUsername = mode === 'register';
  const showEmail =
    mode === 'login' || mode === 'register' || mode === 'forgotPassword';
  const showPassword = mode === 'login' || mode === 'register';

  const title: Record<Mode, string> = {
    login: 'Log in',
    register: 'Create account',
    forgotPassword: 'Reset password',
    info: 'Check your email',
  };

  return (
    <Container fluid className="py-5 px-2 px-sm-4">
      <h1 className="text-center mb-4">{account ? 'Account' : title[mode]}</h1>
      <div className="mx-auto" style={{ maxWidth: 360 }}>
        <div className="small mb-3 text-center">
          {account ? (
            <>
              Logged in as <strong>{account.username}</strong>
            </>
          ) : (
            <>
              Playing as <strong>{getPlayerName()}</strong>
            </>
          )}
        </div>

        {account ? (
          <div className="d-flex flex-column gap-2">
            {error && (
              <Alert variant="danger" className="py-1 px-2 mb-0 small">
                {formatError(error)}
              </Alert>
            )}
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={handleLogout}
            >
              Log out
            </Button>
            <Button
              variant="link"
              size="sm"
              className="p-0 text-decoration-none text-start"
              onClick={() => navigate('/')}
            >
              Back to Annex
            </Button>
          </div>
        ) : mode === 'info' ? (
          <>
            <p className="mb-2 small">{info}</p>
            <Button
              variant="link"
              size="sm"
              className="p-0 text-decoration-none"
              onClick={() => goto('login')}
            >
              Back to log in
            </Button>
          </>
        ) : (
          <Form onSubmit={submit[mode]} className="d-flex flex-column gap-2">
            {showUsername && (
              <Form.Control
                size="sm"
                placeholder="Username"
                autoComplete="username"
                maxLength={10}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            )}
            {showEmail && (
              <Form.Control
                size="sm"
                type="email"
                placeholder="Email"
                autoComplete="email"
                maxLength={50}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
            {showPassword && (
              <>
                <InputGroup size="sm">
                  <Form.Control
                    type={revealPassword ? 'text' : 'password'}
                    placeholder="Password"
                    autoComplete={
                      mode === 'login' ? 'current-password' : 'new-password'
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <Button
                    variant="outline-secondary"
                    tabIndex={-1}
                    onClick={() => setRevealPassword((v) => !v)}
                  >
                    {revealPassword ? 'Hide' : 'Show'}
                  </Button>
                </InputGroup>
                {mode === 'register' && (
                  <Form.Control
                    size="sm"
                    type={revealPassword ? 'text' : 'password'}
                    placeholder="Confirm password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                )}
              </>
            )}
            {mode === 'login' && (
              <Form.Check
                type="checkbox"
                id="stay-logged-in"
                className="small"
                label="Stay logged in"
                checked={stayLoggedIn}
                onChange={(e) => setStayLoggedIn(e.target.checked)}
              />
            )}
            {error && (
              <Alert variant="danger" className="py-1 px-2 mb-0 small">
                {formatError(error)}
              </Alert>
            )}
            <Button type="submit" size="sm" disabled={busy}>
              {submitLabel[mode]}
            </Button>

            {mode === 'login' && (
              <div className="d-flex flex-column">
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 text-decoration-none text-start"
                  onClick={() => goto('register')}
                >
                  Create an account
                </Button>
                {loginFailed && (
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 text-decoration-none text-start"
                    onClick={() => goto('forgotPassword')}
                  >
                    Forgot password?
                  </Button>
                )}
              </div>
            )}
            {mode !== 'login' && (
              <Button
                variant="link"
                size="sm"
                className="p-0 text-decoration-none text-start"
                onClick={() => goto('login')}
              >
                Back to log in
              </Button>
            )}
          </Form>
        )}
      </div>
    </Container>
  );
}

export default Login;
