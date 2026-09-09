import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Container,
  Form,
  InputGroup,
  Spinner,
} from 'react-bootstrap';
import { Navigate } from 'react-router-dom';
import { formatError } from '../common/formatError';
import ImageCropper from '../common/ImageCropper';
import { connector } from '../connector';
import { passwordProblem } from '../lib/password';
import type { Account, AccountResult } from '../lib/types';

interface Props {
  account: Account;
}

function AccountPage({ account }: Props) {
  const [details, setDetails] = useState<AccountResult | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pictureMessage, setPictureMessage] = useState('');
  const [pictureError, setPictureError] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

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

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (picked) setFile(picked);
  }

  function uploadCrop(image: string) {
    setFile(null);
    setPictureMessage('');
    connector.uploadPicture({ image }, (res) => {
      setPictureError(!res.ok);
      setPictureMessage(res.ok ? 'profile picture updated' : res.error);
      if (res.ok) connector.getAccount(setDetails);
    });
  }

  function removePicture() {
    setPictureMessage('');
    connector.removePicture((res) => {
      setPictureError(!res.ok);
      setPictureMessage(res.ok ? 'profile picture removed' : res.error);
      if (res.ok) connector.getAccount(setDetails);
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

  const { picture, pictureDangerous: dangerous, email } = details;

  return (
    <Container fluid className="py-5 px-2 px-sm-4">
      <h1 className="text-center mb-4">Account</h1>
      <div className="d-flex flex-column gap-5">
        <div className="d-flex flex-column gap-3">
          <div>
            <div className="small text-muted">Username</div>
            <div className="fs-5">{account.username}</div>
          </div>
          <div>
            <div className="small text-muted">Email</div>
            <div className="fs-5">{email}</div>
          </div>
        </div>

        <div className="d-flex flex-column align-items-start gap-2">
          <div className="small text-muted">Profile picture</div>
          {picture ? (
            <img
              src={picture}
              alt="Profile"
              width={200}
              height={200}
              className="rounded"
              style={{ cursor: 'pointer' }}
              onClick={() => fileInput.current?.click()}
            />
          ) : (
            <div
              className="rounded bg-secondary d-flex align-items-center justify-content-center text-white-50"
              style={{ width: 200, height: 200, cursor: 'pointer' }}
              onClick={() => fileInput.current?.click()}
            >
              No picture
            </div>
          )}
          {dangerous && (
            <Alert variant="warning" className="py-1 px-2 mb-0 small">
              Your profile picture was hidden after multiple reports. Upload a
              new one to replace it.
            </Alert>
          )}
          {pictureMessage && (
            <Alert
              variant={pictureError ? 'danger' : 'success'}
              className="py-1 px-2 mb-0 small"
            >
              {formatError(pictureMessage)}
            </Alert>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="d-none"
            onChange={pickFile}
          />
          <div className="d-flex gap-2">
            <Button size="sm" onClick={() => fileInput.current?.click()}>
              {picture ? 'Change picture' : 'Upload picture'}
            </Button>
            {(picture || dangerous) && (
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={removePicture}
              >
                Remove picture
              </Button>
            )}
          </div>
        </div>

        <div>
          <Form
            onSubmit={changePassword}
            className="d-flex flex-column gap-2"
            style={{ maxWidth: '24ch' }}
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
                variant="outline-secondary"
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

      {file && (
        <ImageCropper
          file={file}
          onCancel={() => setFile(null)}
          onCropped={uploadCrop}
        />
      )}
    </Container>
  );
}

export default AccountPage;
