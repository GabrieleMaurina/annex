import { containsProfanity } from 'engine';
import { useState } from 'react';
import { Alert, Button, Container, Form, InputGroup } from 'react-bootstrap';
import { guessCountry } from '../../common/badges/countries';
import CountrySelect from '../../common/badges/CountrySelect';
import { formatError } from '../../common/formatError';
import WhiteIcon from '../../common/icons/WhiteIcon';
import { connector } from '../../connector';
import { passwordProblem } from '../../lib/password';
import { getPlayerName } from '../../lib/player';
import type { Account } from '../../lib/types';
import { takeLoginReturnPath } from './loginReturn';

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
  const [country, setCountry] = useState(guessCountry);
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
      navigate(takeLoginReturnPath());
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
    const problem = passwordProblem(password);
    if (problem) {
      setError(problem);
      return;
    }
    if (!country) {
      setError('select your country');
      return;
    }
    setBusy(true);
    setError('');
    connector.register({ username, email, password, country }, (res) => {
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
              className="d-inline-flex align-items-center justify-content-center gap-1"
              variant="secondary"
              size="sm"
              onClick={handleLogout}
            >
              <WhiteIcon path="/icons/logout.svg" />
              Log out
            </Button>
            <Button
              className="d-inline-flex align-items-center justify-content-center gap-1"
              variant="outline-secondary"
              size="sm"
              onClick={() => navigate('/')}
            >
              <WhiteIcon path="/icons/step-back.svg" />
              Back to Annex
            </Button>
          </div>
        ) : mode === 'info' ? (
          <>
            <p className="mb-2 small">{info}</p>
            <Button
              className="d-inline-flex align-items-center justify-content-center gap-1"
              variant="outline-secondary"
              size="sm"
              onClick={() => goto('login')}
            >
              <WhiteIcon path="/icons/step-back.svg" />
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
                    className="d-inline-flex align-items-center justify-content-center gap-1"
                    variant="secondary"
                    tabIndex={-1}
                    onClick={() => setRevealPassword((v) => !v)}
                  >
                    <WhiteIcon
                      path={
                        revealPassword ? '/icons/eye-off.svg' : '/icons/eye.svg'
                      }
                    />
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
                {mode === 'register' && (
                  <CountrySelect value={country} onChange={setCountry} />
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
            <Button
              className="d-inline-flex align-items-center justify-content-center gap-1"
              type="submit"
              size="sm"
              disabled={busy}
            >
              <WhiteIcon
                path={
                  mode === 'login' ? '/icons/login.svg' : '/icons/check.svg'
                }
              />
              {submitLabel[mode]}
            </Button>

            {mode === 'login' && (
              <div className="d-flex flex-column gap-2">
                <Button
                  className="d-inline-flex align-items-center justify-content-center gap-1"
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => goto('register')}
                >
                  <WhiteIcon path="/icons/friend-add.svg" />
                  Create an account
                </Button>
                {loginFailed && (
                  <Button
                    className="d-inline-flex align-items-center justify-content-center gap-1"
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => goto('forgotPassword')}
                  >
                    <WhiteIcon path="/icons/help.svg" />
                    Forgot password?
                  </Button>
                )}
              </div>
            )}
            {mode !== 'login' && (
              <Button
                className="d-inline-flex align-items-center justify-content-center gap-1"
                variant="outline-secondary"
                size="sm"
                onClick={() => goto('login')}
              >
                <WhiteIcon path="/icons/step-back.svg" />
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
