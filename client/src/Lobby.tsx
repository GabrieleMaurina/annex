import { useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, Form, Table } from 'react-bootstrap';
import PlayerNameEditor from './PlayerNameEditor';
import { socket } from './socket';
import type {
  Ack,
  CardsMode,
  DiceRandomness,
  GameMode,
  GameSettingsInput,
  GameState,
  Player,
  TurnDuration,
} from './types';

interface Props {
  game: GameState;
  setGame: (game: GameState) => void;
  player: Player;
  onNameChange: (name: string) => void;
  selfId: number | null;
  mapNames: string[];
  navigate: (path: string) => void;
}

const TURN_DURATIONS: TurnDuration[] = [60, 90, 120, 150, 180, 300];
const MIN_SLOTS = 2;
const MAX_SLOTS = 20;

function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return sec === 0 ? `${min} min` : `${min} min ${sec} sec`;
}

function Lobby({
  game,
  setGame,
  player,
  onNameChange,
  selfId,
  mapNames,
  navigate,
}: Props) {
  const [settingsError, setSettingsError] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const bannedIdsRef = useRef<number[]>([]);

  useEffect(() => {
    bannedIdsRef.current = game.bannedPlayers.map((p) => p.id);
  }, [game]);

  function applySettings(settings: GameSettingsInput) {
    socket.emit('game:settings', settings, (res: Ack) => {
      if (!res.ok) {
        setSettingsError(res.error);
        return;
      }
      setSettingsError('');
      setGame(res.game);
      if (settings.name !== undefined)
        navigate(`/${encodeURIComponent(res.game.name)}`);
    });
  }

  const isHost = game.hostId === selfId;

  function removeSlot(index: number) {
    const player = game.players[index];
    if (player) {
      bannedIdsRef.current = [...bannedIdsRef.current, player.id];
      applySettings({ bannedPlayerIds: bannedIdsRef.current });
    } else {
      applySettings({ slots: game.slots - 1 });
    }
  }

  function addSlot() {
    applySettings({ slots: game.slots + 1 });
  }

  function unbanPlayer(id: number) {
    bannedIdsRef.current = bannedIdsRef.current.filter(
      (bannedId) => bannedId !== id,
    );
    applySettings({ bannedPlayerIds: bannedIdsRef.current });
  }

  function startGame() {
    socket.emit('game:start', (res: Ack) => {
      if (!res.ok) {
        setSettingsError(res.error);
        return;
      }
      setSettingsError('');
      setGame(res.game);
    });
  }

  const slotRows = Array.from(
    { length: game.slots },
    (_, i) => game.players[i] ?? null,
  );

  return (
    <>
      <PlayerNameEditor player={player} onNameChange={onNameChange} />

      <div className="d-flex align-items-center mb-4">
        <div className="flex-fill"></div>
        <div className="d-flex align-items-center gap-3">
          <img src="/favicon.svg" alt="" style={{ height: '3rem' }} />
          <h1 className="mb-0">{game.name}</h1>
          <img src="/favicon.svg" alt="" style={{ height: '3rem' }} />
        </div>
        <div className="flex-fill d-flex justify-content-end">
          <Button variant="secondary" onClick={() => navigate('/')}>
            Leave Game
          </Button>
        </div>
      </div>

      {settingsError && (
        <Alert
          variant="danger"
          dismissible
          onClose={() => setSettingsError('')}
        >
          {settingsError}
        </Alert>
      )}

      <div style={{ maxWidth: 400 }}>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <Form.Label className="mb-0">Game Name</Form.Label>
          {isHost ? (
            <Form.Control
              ref={nameInputRef}
              className="w-auto"
              defaultValue={game.name}
              onBlur={() => {
                const value = nameInputRef.current!.value.trim();
                if (value && value !== game.name)
                  applySettings({ name: value });
              }}
            />
          ) : (
            <span>{game.name}</span>
          )}
        </div>

        <div className="d-flex justify-content-between align-items-center mb-2">
          <Form.Label className="mb-0">Game Mode</Form.Label>
          {isHost ? (
            <Form.Select
              className="w-auto"
              value={game.gameMode}
              onChange={(e) =>
                applySettings({ gameMode: e.target.value as GameMode })
              }
            >
              <option value="World Domination">World Domination</option>
              <option value="Capital Conquest">Capital Conquest</option>
              <option value="Team Deathmatch">Team Deathmatch</option>
            </Form.Select>
          ) : (
            <span>{game.gameMode}</span>
          )}
        </div>

        <div className="d-flex justify-content-between align-items-center mb-2">
          <Form.Label className="mb-0">Map</Form.Label>
          {isHost ? (
            <Form.Select
              className="w-auto"
              value={game.mapName}
              onChange={(e) => applySettings({ mapName: e.target.value })}
            >
              {mapNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Form.Select>
          ) : (
            <span>{game.mapName}</span>
          )}
        </div>

        <details className="mb-3">
          <summary>Settings</summary>
          <div className="mt-2">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <Form.Label className="mb-0">Dice Randomness</Form.Label>
              {isHost ? (
                <Form.Select
                  className="w-auto"
                  value={game.diceRandomness}
                  onChange={(e) =>
                    applySettings({
                      diceRandomness: e.target.value as DiceRandomness,
                    })
                  }
                >
                  <option value="Balanced">Balanced</option>
                  <option value="True">True</option>
                </Form.Select>
              ) : (
                <span>{game.diceRandomness}</span>
              )}
            </div>

            <div className="d-flex justify-content-between align-items-center mb-2">
              <Form.Label className="mb-0">Defence Dice</Form.Label>
              {isHost ? (
                <Form.Select
                  className="w-auto"
                  value={game.defenceDice}
                  onChange={(e) =>
                    applySettings({
                      defenceDice: Number(e.target.value) as 2 | 3,
                    })
                  }
                >
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </Form.Select>
              ) : (
                <span>{game.defenceDice}</span>
              )}
            </div>

            <div className="d-flex justify-content-between align-items-center mb-2">
              <Form.Label className="mb-0">Cards</Form.Label>
              {isHost ? (
                <Form.Select
                  className="w-auto"
                  value={game.cards}
                  onChange={(e) =>
                    applySettings({ cards: e.target.value as CardsMode })
                  }
                >
                  <option value="Fixed">Fixed</option>
                  <option value="Progressive">Progressive</option>
                  <option value="Exponential">Exponential</option>
                </Form.Select>
              ) : (
                <span>{game.cards}</span>
              )}
            </div>

            <div className="d-flex justify-content-between align-items-center mb-2">
              <Form.Label className="mb-0">Turn Duration</Form.Label>
              {isHost ? (
                <Form.Select
                  className="w-auto"
                  value={game.turnDuration}
                  onChange={(e) =>
                    applySettings({
                      turnDuration: Number(e.target.value) as TurnDuration,
                    })
                  }
                >
                  {TURN_DURATIONS.map((seconds) => (
                    <option key={seconds} value={seconds}>
                      {formatDuration(seconds)}
                    </option>
                  ))}
                </Form.Select>
              ) : (
                <span>{formatDuration(game.turnDuration)}</span>
              )}
            </div>
          </div>
        </details>
      </div>

      <Table striped bordered hover>
        <thead>
          <tr>
            <th style={{ width: '100%' }}>Player</th>
            {isHost && (
              <th style={{ width: '1%' }} className="text-nowrap"></th>
            )}
          </tr>
        </thead>
        <tbody>
          {slotRows.map((p, i) => (
            <tr key={i}>
              <td>
                {p ? (
                  <>
                    {p.name}
                    {p.id === game.hostId && (
                      <Badge bg="primary" className="ms-2">
                        Host
                      </Badge>
                    )}
                  </>
                ) : (
                  <span className="text-muted">Empty</span>
                )}
              </td>
              {isHost && (
                <td className="text-nowrap">
                  {p?.id !== selfId && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => removeSlot(i)}
                      disabled={!p && game.slots <= MIN_SLOTS}
                    >
                      ✕
                    </Button>
                  )}
                </td>
              )}
            </tr>
          ))}
          {isHost && (
            <tr>
              <td colSpan={2} className="text-center">
                <Button
                  size="sm"
                  variant="success"
                  onClick={addSlot}
                  disabled={game.slots >= MAX_SLOTS}
                >
                  +
                </Button>
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      {isHost && game.bannedPlayers.length > 0 && (
        <>
          <h5>Banned Players</h5>
          <Table striped bordered hover>
            <thead>
              <tr>
                <th>Player</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {game.bannedPlayers.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => unbanPlayer(p.id)}
                    >
                      Unban
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}

      {isHost && (
        <Button disabled={game.players.length < 2} onClick={startGame}>
          Start Game
        </Button>
      )}
    </>
  );
}

export default Lobby;
