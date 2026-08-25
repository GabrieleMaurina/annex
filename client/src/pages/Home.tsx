import { useEffect, useState } from 'react';
import { Alert, Button, Container, Form, Table } from 'react-bootstrap';
import PlayerNameEditor from '../common/PlayerNameEditor';
import SettingsMenu from '../common/SettingsMenu';
import Tip from '../common/Tip';
import { useWhiteIcon } from '../common/icon';
import { contrastTextColor, playerColor } from '../lib/palette';
import {
  getGameName,
  getGameSettings,
  getGameSlots,
  saveGameName,
} from '../lib/player';
import { socket } from '../lib/socket';
import type { Ack, GameSummary, Player } from '../lib/types';

const MAX_GAME_NAME_LENGTH = 20;
const MAX_CREATE_ATTEMPTS = 20;

const GAME_STATE_COLORS: Record<GameSummary['state'], string> = {
  lobby: playerColor(2),
  playing: playerColor(3),
  ended: playerColor(0),
};

interface Props {
  player: Player;
  onNameChange: (name: string) => void;
  navigate: (path: string) => void;
  kickedMessage: string;
  clearKickedMessage: () => void;
}

function suggestedGameName(base: string, attempt: number): string {
  if (attempt === 0) return base;
  const suffix = ` (${attempt})`;
  return base.length + suffix.length > MAX_GAME_NAME_LENGTH
    ? base.slice(0, MAX_GAME_NAME_LENGTH - suffix.length) + suffix
    : base + suffix;
}

function Home({
  player,
  onNameChange,
  navigate,
  kickedMessage,
  clearKickedMessage,
}: Props) {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [error, setError] = useState('');
  const [passwordPrompt, setPasswordPrompt] = useState<{
    gameName: string;
    password: string;
  } | null>(null);
  const whiteGithubIcon = useWhiteIcon('/icons/github.svg');

  useEffect(() => {
    function onGames(list: GameSummary[]) {
      setGames(list);
    }
    socket.on('home:games', onGames);
    return () => {
      socket.off('home:games', onGames);
    };
  }, []);

  function createGame(attempt = 0) {
    const baseName = getGameName() || `Game with ${player.name}`;
    const name = suggestedGameName(baseName, attempt);
    socket.emit('game:create', { name }, (res: Ack) => {
      if (res.ok) {
        saveGameName(baseName);
        const savedSettings = getGameSettings();
        if (savedSettings)
          socket.emit('game:settings', savedSettings, () => {});
        const savedSlots = getGameSlots();
        if (savedSlots)
          socket.emit('game:settings', { slots: savedSlots }, () => {});
        navigate(`/${encodeURIComponent(res.game.name)}`);
      } else if (
        res.error === 'game name already in use' &&
        attempt < MAX_CREATE_ATTEMPTS
      )
        createGame(attempt + 1);
      else setError(res.error);
    });
  }

  function joinGame(gameName: string, password?: string) {
    socket.emit('game:join', { gameName, password }, (res: Ack) => {
      if (res.ok) {
        setPasswordPrompt(null);
        navigate(`/${encodeURIComponent(res.game.name)}`);
      } else if (res.error === 'invalid password') {
        setPasswordPrompt({ gameName, password: '' });
      } else {
        setPasswordPrompt(null);
        setError(res.error);
      }
    });
  }

  return (
    <Container fluid className="pt-3 pb-5 px-4">
      <SettingsMenu shareUrl={window.location.origin} />
      <div className="position-fixed top-0 end-0 m-3" style={{ zIndex: 1 }}>
        <PlayerNameEditor player={player} onNameChange={onNameChange} />
      </div>
      <Tip text="View on GitHub">
        <Button
          variant="secondary"
          size="sm"
          href="https://github.com/GabrieleMaurina/annex"
          target="_blank"
          rel="noreferrer"
          className="position-fixed bottom-0 end-0 m-3"
        >
          <img
            src={whiteGithubIcon ?? '/icons/github.svg'}
            width={16}
            height={16}
            alt="GitHub"
          />
        </Button>
      </Tip>
      <div className="d-flex justify-content-center align-items-center gap-5 mb-4">
        <img src="/favicon.svg" alt="" style={{ height: '4rem' }} />
        <Tip text="/ænˈeks/ (verb) : to take possession of an area of land or a country, usually by force or without permission">
          <h1 className="mb-0">Annex</h1>
        </Tip>
        <img src="/favicon.svg" alt="" style={{ height: '4rem' }} />
      </div>

      {kickedMessage && (
        <Alert variant="warning" dismissible onClose={clearKickedMessage}>
          {kickedMessage}
        </Alert>
      )}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {passwordPrompt && (
        <Alert
          variant="secondary"
          dismissible
          onClose={() => setPasswordPrompt(null)}
        >
          <Form
            className="d-flex align-items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              joinGame(passwordPrompt.gameName, passwordPrompt.password);
            }}
          >
            <span>Password for {passwordPrompt.gameName}:</span>
            <Form.Control
              type="password"
              autoFocus
              className="w-auto"
              value={passwordPrompt.password}
              onChange={(e) =>
                setPasswordPrompt({
                  ...passwordPrompt,
                  password: e.target.value,
                })
              }
            />
            <Button type="submit" size="sm">
              Join
            </Button>
          </Form>
        </Alert>
      )}

      <Button className="mb-4" onClick={() => createGame()}>
        Create Game
      </Button>

      {games.length === 0 ? (
        <p className="text-center">No Games Available</p>
      ) : (
        <Table striped hover borderless>
          <thead>
            <tr>
              <th>Name</th>
              <th>Map</th>
              <th>Host</th>
              <th>Players</th>
              <th>Phase</th>
            </tr>
          </thead>
          <tbody>
            {games.map((g) => {
              const isFullLobby =
                g.state === 'lobby' && g.playerCount >= g.slots;
              const bg = isFullLobby
                ? GAME_STATE_COLORS.playing
                : GAME_STATE_COLORS[g.state];
              const rowStyle = {
                backgroundColor: bg,
                color: contrastTextColor(bg),
              };
              return (
                <tr
                  key={g.name}
                  role="button"
                  onClick={() =>
                    g.hasPassword
                      ? setPasswordPrompt({ gameName: g.name, password: '' })
                      : joinGame(g.name)
                  }
                  style={{ cursor: 'pointer' }}
                >
                  <td style={rowStyle}>
                    {g.name}
                    {g.hasPassword && ' \u{1F512}'}
                  </td>
                  <td style={rowStyle}>{g.mapName}</td>
                  <td style={rowStyle}>{g.hostName}</td>
                  <td style={rowStyle}>
                    {g.playerCount}/{g.slots}
                    {g.spectatorCount > 0 &&
                      ` · ${g.spectatorCount} spectating`}
                  </td>
                  <td style={rowStyle}>
                    {g.state === 'lobby'
                      ? 'Lobby'
                      : g.state === 'playing'
                        ? 'Playing'
                        : 'Ended'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Container>
  );
}

export default Home;
