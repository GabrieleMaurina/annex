import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Container,
  Form,
  InputGroup,
  Spinner,
} from 'react-bootstrap';
import { Navigate, useNavigate } from 'react-router-dom';
import CountrySelect from '../../common/badges/CountrySelect';
import { formatError } from '../../common/formatError';
import ProfilePictureEditor from '../../common/inputs/ProfilePictureEditor';
import { connector } from '../../connector';
import { passwordProblem } from '../../lib/password';
import type { Account, AccountResult } from '../../lib/types';
import ProfileBio from '../social/ProfileBio';

interface Props {
  account: Account;
  onCountryChange: () => void;
}

function AccountPage({ account, onCountryChange }: Props) {
  const navigate = useNavigate();
  const [details, setDetails] = useState<AccountResult | null>(null);
  const [countryError, setCountryError] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    connector.getAccount(setDetails);
  }, []);

  function changeCountry(country: string) {
    setCountryError('');
    connector.setCountry(country, (res) => {
      if (!res.ok) {
        setCountryError(res.error);
        return;
      }
      connector.getAccount(setDetails);
      onCountryChange();
    });
  }

  function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError(true);
      setPasswordMessage('passwords do not match');
      return;
    }
    const problem = passwordProblem(newPassword);
    if (problem) {
      setPasswordError(true);
      setPasswordMessage(problem);
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordError(true);
      setPasswordMessage('new password must be different');
      return;
    }
    setBusy(true);
    connector.changePassword({ currentPassword, newPassword }, (res) => {
      setBusy(false);
      setPasswordError(!res.ok);
      setPasswordMessage(res.ok ? 'password changed' : res.error);
      if (res.ok) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    });
  }

  if (!details) {
    return (
      <Container fluid className="py-5 px-2 px-sm-4 text-center">
        <Spinner size="sm" className="me-2" />
        Loading...
      </Container>
    );
  }

  if (!details.ok) return <Navigate to="/" replace />;

  const { picture, pictureDangerous: dangerous, email, country, bio } = details;

  return (
    <Container fluid className="py-5 px-2 px-sm-4">
      <h1 className="text-center mb-3">Account</h1>
      <div className="d-flex justify-content-center mb-4">
        <Button
          size="sm"
          variant="info"
          onClick={() =>
            navigate(`/players/${encodeURIComponent(account.username)}`)
          }
        >
          View Profile
        </Button>
      </div>
      <div className="d-flex flex-column flex-lg-row justify-content-center align-items-center align-items-lg-start gap-5 py-lg-5">
        <div className="d-flex flex-column gap-3">
          <div>
            <div className="small text-muted">Username</div>
            <div className="fs-5">{account.username}</div>
          </div>
          <div>
            <div className="small text-muted">Email</div>
            <div className="fs-5">{email}</div>
          </div>
          <div className="d-flex flex-column gap-1">
            <div className="small text-muted">Country</div>
            <div style={{ width: '32ch' }}>
              <CountrySelect value={country} onChange={changeCountry} />
            </div>
            {countryError && (
              <Alert variant="danger" className="py-1 px-2 mb-0 small">
                {formatError(countryError)}
              </Alert>
            )}
          </div>
          <div className="d-flex flex-column gap-1">
            <div className="small text-muted">Profile text</div>
            <ProfileBio bio={bio} editable />
          </div>
        </div>

        <div className="d-flex flex-column align-items-start gap-2 px-lg-4">
          <div className="small text-muted">Profile picture</div>
          <ProfilePictureEditor
            picture={picture}
            dangerous={dangerous}
            size={200}
            onChanged={() => connector.getAccount(setDetails)}
          />
        </div>

        <div>
          <Form
            onSubmit={changePassword}
            className="d-flex flex-column gap-2"
            style={{ width: '24ch' }}
          >
            <div className="small text-muted">Change password</div>
            <Form.Control
              size="sm"
              type={reveal ? 'text' : 'password'}
              placeholder="Current password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <InputGroup size="sm">
              <Form.Control
                type={reveal ? 'text' : 'password'}
                placeholder="New password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <Button
                variant="secondary"
                tabIndex={-1}
                onClick={() => setReveal((v) => !v)}
              >
                {reveal ? 'Hide' : 'Show'}
              </Button>
            </InputGroup>
            <Form.Control
              size="sm"
              type={reveal ? 'text' : 'password'}
              placeholder="Confirm new password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {passwordMessage && (
              <Alert
                variant={passwordError ? 'danger' : 'success'}
                className="py-1 px-2 mb-0 small"
              >
                {formatError(passwordMessage)}
              </Alert>
            )}
            <Button type="submit" size="sm" disabled={busy}>
              Change password
            </Button>
          </Form>
        </div>
      </div>
    </Container>
  );
}

export default AccountPage;
