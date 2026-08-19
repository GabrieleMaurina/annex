import { useRef, useState } from 'react';
import { Form } from 'react-bootstrap';
import PlayerNameEditor from '../common/PlayerNameEditor';
import type { GameSettingsInput, GameState, Player } from '../lib/types';

const MAX_GAME_NAME_LENGTH = 20;

interface Props {
  game: GameState;
  isHost: boolean;
  applySettings: (settings: GameSettingsInput) => void;
  player: Player;
  onNameChange: (name: string) => void;
}

function Header({ game, isHost, applySettings, player, onNameChange }: Props) {
  const [editingName, setEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mb-4">
      <div className="position-fixed top-0 end-0 m-3" style={{ zIndex: 1 }}>
        <PlayerNameEditor player={player} onNameChange={onNameChange} />
      </div>
      <div className="d-flex justify-content-center align-items-center gap-3">
        <img src="/favicon.svg" alt="" style={{ height: '3rem' }} />
        {isHost && editingName ? (
          <Form.Control
            ref={nameInputRef}
            autoFocus
            maxLength={MAX_GAME_NAME_LENGTH}
            className="w-auto"
            defaultValue={game.name}
            onBlur={() => {
              const value = nameInputRef.current!.value.trim();
              if (
                value &&
                value.length <= MAX_GAME_NAME_LENGTH &&
                value !== game.name
              )
                applySettings({ name: value });
              setEditingName(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
          />
        ) : (
          <h1
            className="mb-0"
            role={isHost ? 'button' : undefined}
            style={isHost ? { cursor: 'pointer' } : undefined}
            onClick={isHost ? () => setEditingName(true) : undefined}
          >
            {game.name}
          </h1>
        )}
        <img src="/favicon.svg" alt="" style={{ height: '3rem' }} />
      </div>
    </div>
  );
}

export default Header;
