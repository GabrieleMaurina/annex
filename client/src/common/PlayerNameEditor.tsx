import { useRef, useState } from 'react';
import { Form } from 'react-bootstrap';
import type { Player } from '../lib/types';

const MAX_NAME_LENGTH = 10;

interface Props {
  player: Player;
  onNameChange: (name: string) => void;
}

function PlayerNameEditor({ player, onNameChange }: Props) {
  const [name, setName] = useState(player.name);
  const [editing, setEditing] = useState(false);
  const skipBlurRef = useRef(false);

  function commit() {
    if (skipBlurRef.current) {
      skipBlurRef.current = false;
      return;
    }
    const trimmed = name.trim();
    if (
      trimmed &&
      trimmed.length <= MAX_NAME_LENGTH &&
      trimmed !== player.name
    ) {
      onNameChange(trimmed);
    } else {
      setName(player.name);
    }
    setEditing(false);
  }

  return (
    <div className="text-truncate">
      {editing ? (
        <Form.Control
          autoFocus
          size="sm"
          maxLength={MAX_NAME_LENGTH}
          style={{ width: 'auto' }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            } else if (e.key === 'Escape') {
              skipBlurRef.current = true;
              setName(player.name);
              setEditing(false);
            }
          }}
        />
      ) : (
        <span
          role="button"
          style={{ cursor: 'pointer' }}
          onClick={() => setEditing(true)}
        >
          {player.name}
        </span>
      )}
    </div>
  );
}

export default PlayerNameEditor;
