import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Form } from 'react-bootstrap';
import { connector } from '../connector';
import { getPlayerName, setPlayerName } from '../lib/player';
import type { Account, AccountChange } from '../lib/types';
import { PANEL_BG_CLASS, PANEL_CLASS } from './panelStyle';

type Mode = 'login' | 'register' | 'forgotPassword' | 'forgotUsername' | 'info';

interface Props {
  account: Account | null;
  onAccountChange: AccountChange;
}

function AccountButton({ account, onAccountChange }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('login');
  const [info, setInfo] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loginFailed, setLoginFailed] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setMode('login');
    setInfo('');
    setUsername('');
    setEmail('');
    setPassword('');
    setError('');
    setBusy(false);
    setLoginFailed(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) close();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  function onPanelClick(e: React.MouseEvent) {
    if (!(e.target as HTMLElement).closest('input, button, a, textarea, label'))
      close();
  }

  function goto(next: Mode) {
    setError('');
    setInfo('');
    setMode(next);
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    connector.login({ username, password }, (res) => {
      if (!res.ok) {
        setError(res.error);
        setBusy(false);
        setLoginFailed(true);
        return;
      }
      setPlayerName(res.username);
      onAccountChange({
        account: { username: res.username },
        clientSettings: res.clientSettings,
        gameSettings: res.gameSettings,
        gameName: res.gameName,
      });
      close();
    });
  }

  function handleRegister(e: React.FormEvent) {
    e.preventDefault();
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

  function handleForgotUsername(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    connector.recoverUsername({ email }, () => {
      setBusy(false);
      setInfo(
        'If that email has an account, its username has been sent to it.',
      );
      setMode('info');
    });
  }

  function handleLogout() {
    connector.logout((res) => {
      setPlayerName(res.name);
      onAccountChange({
        account: null,
        clientSettings: res.clientSettings,
        gameSettings: res.gameSettings,
      });
      close();
    });
  }

  const submit: Record<Mode, (e: React.FormEvent) => void> = {
    login: handleLogin,
    register: handleRegister,
    forgotPassword: handleForgotPassword,
    forgotUsername: handleForgotUsername,
    info: (e) => e.preventDefault(),
  };

  const submitLabel: Record<Mode, string> = {
    login: 'Log in',
    register: 'Create account',
    forgotPassword: 'Send reset link',
    forgotUsername: 'Send username',
    info: '',
  };

  const showUsername = mode === 'login' || mode === 'register';
  const showEmail =
    mode === 'register' ||
    mode === 'forgotUsername' ||
    mode === 'forgotPassword';
  const showPassword = mode === 'login' || mode === 'register';

  return (
    <div className="position-relative text-end">
      {!open && (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          {account ? account.username : 'Log in'}
        </Button>
      )}

      {open && (
        <div
          ref={panelRef}
          onClick={onPanelClick}
          className={`${PANEL_BG_CLASS} ${PANEL_CLASS} position-absolute end-0 mt-2 text-start`}
          style={{ width: 240, zIndex: 10 }}
        >
          <div className="small mb-2">
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
            <Button
              variant="outline-secondary"
              size="sm"
              className="w-100"
              onClick={handleLogout}
            >
              Log out
            </Button>
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}
              {showPassword && (
                <Form.Control
                  size="sm"
                  type="password"
                  placeholder="Password"
                  autoComplete={
                    mode === 'login' ? 'current-password' : 'new-password'
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
              {error && (
                <Alert variant="danger" className="py-1 px-2 mb-0 small">
                  {error}
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
                    <>
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 text-decoration-none text-start"
                        onClick={() => goto('forgotPassword')}
                      >
                        Forgot password?
                      </Button>
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 text-decoration-none text-start"
                        onClick={() => goto('forgotUsername')}
                      >
                        Forgot username?
                      </Button>
                    </>
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
      )}
    </div>
  );
}

export default AccountButton;
