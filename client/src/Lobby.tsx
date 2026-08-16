import { useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, Form, Table } from 'react-bootstrap';
import PlayerNameEditor from './PlayerNameEditor';
import { contrastTextColor, playerColor } from './palette';
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
const MAX_GAME_NAME_LENGTH = 20;

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
  const [editingName, setEditingName] = useState(false);
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
  const isTeamDeathmatch = game.gameMode === 'Team Deathmatch';
  const maxTeams = Math.max(1, game.players.length - 1);

  function banId(id: number) {
    bannedIdsRef.current = [...bannedIdsRef.current, id];
    applySettings({ bannedPlayerIds: bannedIdsRef.current });
  }

  function removeSlot(index: number) {
    const player = game.players[index];
    if (player) {
      banId(player.id);
    } else {
      applySettings({ slots: game.slots - 1 });
    }
  }

  function setPlayerTeam(playerId: number, team: number) {
    applySettings({ playerTeam: { playerId, team } });
  }

  function cycleColor() {
    socket.emit('game:cycleColor', (res: Ack) => {
      if (res.ok) setGame(res.game);
    });
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
      <div className="d-flex align-items-center mb-4">
        <div
          className="flex-grow-1"
          style={{ flexBasis: 0, minWidth: 0 }}
        ></div>
        <div className="d-flex align-items-center gap-3">
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
        <div
          className="d-flex justify-content-end flex-grow-1"
          style={{ flexBasis: 0, minWidth: 0 }}
        >
          <PlayerNameEditor player={player} onNameChange={onNameChange} />
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

      <div className="d-flex justify-content-between align-items-start mb-4">
        <div style={{ maxWidth: 400 }}>
          <div className="d-flex justify-content-between align-items-center gap-3 mb-2">
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

          <div className="d-flex justify-content-between align-items-center gap-3 mb-2">
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
              <div className="d-flex justify-content-between align-items-center gap-3 mb-2">
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

              <div className="d-flex justify-content-between align-items-center gap-3 mb-2">
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

              <div className="d-flex justify-content-between align-items-center gap-3 mb-2">
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

              <div className="d-flex justify-content-between align-items-center gap-3 mb-2">
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

        <div className="d-flex flex-column gap-2">
          {isHost && (
            <Button disabled={game.players.length < 2} onClick={startGame}>
              Start Game
            </Button>
          )}
          <Button variant="secondary" onClick={() => navigate('/')}>
            Leave Game
          </Button>
        </div>
      </div>

      <Table striped borderless hover>
        <thead>
          <tr>
            <th style={{ width: '100%' }}>Player</th>
            {isTeamDeathmatch && <th className="text-nowrap">Team</th>}
            {isHost && (
              <th style={{ width: '1%' }} className="text-nowrap"></th>
            )}
          </tr>
        </thead>
        <tbody>
          {slotRows.map((p, i) => {
            const rowStyle = p
              ? {
                  backgroundColor: playerColor(p.color),
                  color: contrastTextColor(playerColor(p.color)),
                  cursor: p.id === selfId ? 'pointer' : 'default',
                }
              : undefined;
            return (
              <tr
                key={i}
                onClick={p && p.id === selfId ? cycleColor : undefined}
              >
                <td className="align-middle" style={rowStyle}>
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
                {isTeamDeathmatch && (
                  <td
                    className="align-middle"
                    style={rowStyle}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {p ? (
                      isHost ? (
                        <Form.Select
                          size="sm"
                          value={p.team}
                          onChange={(e) =>
                            setPlayerTeam(p.id, Number(e.target.value))
                          }
                        >
                          {Array.from({ length: maxTeams }, (_, t) => t).map(
                            (team) => (
                              <option key={team} value={team}>
                                {team + 1}
                              </option>
                            ),
                          )}
                        </Form.Select>
                      ) : (
                        p.team + 1
                      )
                    ) : null}
                  </td>
                )}
                {isHost && (
                  <td className="text-nowrap align-middle" style={rowStyle}>
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
            );
          })}
          {isHost && (
            <tr>
              <td
                colSpan={1 + (isTeamDeathmatch ? 1 : 0) + 1}
                className="text-center align-middle"
              >
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

      {game.spectators.length > 0 && (
        <>
          <h5>Spectators</h5>
          <Table striped borderless hover>
            <thead>
              <tr>
                <th style={{ width: '100%' }}>Spectator</th>
                {isHost && (
                  <th style={{ width: '1%' }} className="text-nowrap"></th>
                )}
              </tr>
            </thead>
            <tbody>
              {game.spectators.map((s) => (
                <tr key={s.id}>
                  <td className="align-middle">{s.name}</td>
                  {isHost && (
                    <td className="text-nowrap align-middle">
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => banId(s.id)}
                      >
                        ✕
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}

      {isHost && game.bannedPlayers.length > 0 && (
        <>
          <h5>Banned Players</h5>
          <Table striped borderless hover>
            <thead>
              <tr>
                <th>Player</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {game.bannedPlayers.map((p) => (
                <tr key={p.id}>
                  <td className="align-middle">{p.name}</td>
                  <td className="align-middle">
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
    </>
  );
}

export default Lobby;
