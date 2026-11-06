import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import { connector } from '../../connector';
import { useToggleSound } from '../../lib/sounds';
import { formatError } from '../formatError';
import ImageCropper from './ImageCropper';

interface Props {
  picture: string | null;
  dangerous: boolean;
  size: number;
  onChanged: () => void;
  children?: ReactNode;
}

function ProfilePictureEditor({
  picture,
  dangerous,
  size,
  onChanged,
  children,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  useToggleSound(file !== null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (picked) setFile(picked);
  }

  function uploadCrop(image: string) {
    setFile(null);
    setMessage('');
    connector.uploadPicture({ image }, (res) => {
      setError(!res.ok);
      setMessage(res.ok ? 'profile picture updated' : res.error);
      if (res.ok) onChanged();
    });
  }

  function removePicture() {
    setMessage('');
    connector.removePicture((res) => {
      setError(!res.ok);
      setMessage(res.ok ? 'profile picture removed' : res.error);
      if (res.ok) onChanged();
    });
  }

  return (
    <div className="d-flex flex-column align-items-start gap-2">
      <div className="position-relative flex-shrink-0">
        {picture ? (
          <img
            src={picture}
            alt="Profile"
            width={size}
            height={size}
            className="rounded d-block"
            role="button"
            onClick={() => fileInput.current?.click()}
          />
        ) : (
          <div
            className="rounded bg-secondary d-flex align-items-center justify-content-center text-white-50"
            role="button"
            style={{ width: size, height: size }}
            onClick={() => fileInput.current?.click()}
          >
            No picture
          </div>
        )}
        {children}
      </div>
      {dangerous && (
        <Alert variant="warning" className="py-1 px-2 mb-0 small">
          Your profile picture was hidden after multiple reports. Upload a new
          one to replace it.
        </Alert>
      )}
      {message && (
        <Alert
          variant={error ? 'danger' : 'success'}
          className="py-1 px-2 mb-0 small"
        >
          {formatError(message)}
        </Alert>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="d-none"
        onChange={pickFile}
      />
      <div className="d-flex flex-wrap gap-2">
        <Button size="sm" onClick={() => fileInput.current?.click()}>
          {picture ? 'Change picture' : 'Upload picture'}
        </Button>
        {(picture || dangerous) && (
          <Button size="sm" variant="secondary" onClick={removePicture}>
            Remove picture
          </Button>
        )}
      </div>
      {file && (
        <ImageCropper
          file={file}
          onCancel={() => setFile(null)}
          onCropped={uploadCrop}
        />
      )}
    </div>
  );
}

export default ProfilePictureEditor;
