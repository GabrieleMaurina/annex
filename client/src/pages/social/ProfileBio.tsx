import { containsProfanity } from 'engine';
import { useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { formatError } from '../../common/formatError';
import { connector } from '../../connector';

const MAX_LENGTH = 200;

interface Props {
  bio: string;
  editable: boolean;
}

function ProfileBio({ bio, editable }: Props) {
  const [text, setText] = useState(bio);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function save() {
    if (draft === null) return;
    const trimmed = draft.trim();
    if (containsProfanity(trimmed)) {
      setError('text contains profanity');
      return;
    }
    setSaving(true);
    connector.setBio(trimmed, (res) => {
      setSaving(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setText(trimmed);
      setDraft(null);
    });
  }

  if (draft !== null) {
    return (
      <Form
        className="d-flex flex-column gap-2 w-100"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div>
          <Form.Control
            size="sm"
            value={draft}
            maxLength={MAX_LENGTH}
            autoFocus
            isInvalid={!!error}
            onChange={(e) => {
              setDraft(e.target.value);
              setError('');
            }}
          />
          <Form.Control.Feedback type="invalid">
            {formatError(error)}
          </Form.Control.Feedback>
        </div>
        <div className="d-flex align-items-center gap-2">
          <span className="small text-muted me-auto">
            {draft.length}/{MAX_LENGTH}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={saving}
            onClick={() => setDraft(null)}
          >
            Cancel
          </Button>
          <Button size="sm" type="submit" disabled={saving}>
            Save
          </Button>
        </div>
      </Form>
    );
  }

  if (!text && !editable) return null;

  return (
    <div className="d-flex align-items-center gap-2">
      {text && (
        <span className="selectable text-break" style={{ maxWidth: 400 }}>
          {text}
        </span>
      )}
      {editable && (
        <Button
          size="sm"
          variant="secondary"
          className="flex-shrink-0"
          onClick={() => {
            setError('');
            setDraft(text);
          }}
        >
          {text ? 'Edit' : 'Add profile text'}
        </Button>
      )}
    </div>
  );
}

export default ProfileBio;
