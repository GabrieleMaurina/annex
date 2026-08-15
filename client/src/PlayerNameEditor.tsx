import { useState } from 'react';
import { Form } from 'react-bootstrap';
import type { Player } from './types';

interface Props {
  player: Player;
  onNameChange: (name: string) => void;
}

function PlayerNameEditor({ player, onNameChange }: Props) {
  const [name, setName] = useState(player.name);
  const [editing, setEditing] = useState(false);

  function commit() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== player.name) {
      onNameChange(trimmed);
    } else {
      setName(player.name);
    }
    setEditing(false);
  }

  return (
    <div className="position-absolute top-0 end-0 m-4">
      {editing ? (
        <Form.Control
          autoFocus
          size="sm"
          style={{ width: 'auto' }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
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
