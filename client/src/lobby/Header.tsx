import { useRef, useState } from 'react';
import { Form } from 'react-bootstrap';
import { useTitleIconFit } from '../common/useTitleIconFit';
import type { GameSettingsInput, GameState } from '../lib/types';

const MAX_GAME_NAME_LENGTH = 20;

interface Props {
  game: GameState;
  isHost: boolean;
  applySettings: (settings: GameSettingsInput) => void;
}

function Header({ game, isHost, applySettings }: Props) {
  const [editingName, setEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const { containerRef, textRef, hideIcons } = useTitleIconFit(game.name);

  return (
    <div className="mb-4 mt-4 mt-sm-0">
      <div
        ref={containerRef}
        className="d-flex flex-nowrap justify-content-center align-items-center gap-3 gap-sm-5"
      >
        {!hideIcons && (
          <img
            src="/favicon.svg"
            alt=""
            className="title-icon"
            style={{ height: 'clamp(1.75rem, 10vw, 3rem)', flexShrink: 0 }}
          />
        )}
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
            ref={textRef}
            className="mb-0 text-truncate"
            role={isHost ? 'button' : undefined}
            style={{
              fontSize: 'clamp(1.25rem, 7vw, 2.5rem)',
              minWidth: 0,
              ...(isHost ? { cursor: 'pointer' } : {}),
            }}
            onClick={isHost ? () => setEditingName(true) : undefined}
          >
            {game.name}
          </h1>
        )}
        {!hideIcons && (
          <img
            src="/favicon.svg"
            alt=""
            className="title-icon"
            style={{ height: 'clamp(1.75rem, 10vw, 3rem)', flexShrink: 0 }}
          />
        )}
      </div>
    </div>
  );
}

export default Header;
