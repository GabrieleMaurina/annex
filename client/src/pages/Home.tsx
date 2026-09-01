import { useEffect, useState } from 'react';
import { Alert, Button, Container, Table } from 'react-bootstrap';
import SettingsMenu from '../common/SettingsMenu';
import Tip from '../common/Tip';
import { useWhiteIcon } from '../common/icon';
import { connector } from '../connector';
import { contrastTextColor, playerColor } from '../lib/palette';
import { getPlayerName } from '../lib/player';
import type { GameSummary } from '../lib/types';

const MAX_GAME_NAME_LENGTH = 20;
const POLL_MS = 5000;

const GAME_STATE_COLORS: Record<GameSummary['state'], string> = {
  lobby: playerColor(2),
  playing: playerColor(3),
  ended: playerColor(0),
};

interface Props {
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

function gamePath(name: string): string {
  return `/games/live/${encodeURIComponent(name)}`;
}

function Home({ navigate, kickedMessage, clearKickedMessage }: Props) {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [resumeGame, setResumeGame] = useState<string | null>(null);
  const whiteGithubIcon = useWhiteIcon('/icons/github.svg');

  useEffect(() => {
    function refresh() {
      if (document.visibilityState !== 'visible') return;
      connector.listGames(setGames);
      connector.session((s) => setResumeGame(s.gameName ?? null));
    }
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  function createGame() {
    const base = `Game with ${getPlayerName() || 'Player'}`;
    const taken = new Set(games.map((g) => g.name));
    let attempt = 0;
    while (taken.has(suggestedGameName(base, attempt))) attempt += 1;
    navigate(gamePath(suggestedGameName(base, attempt)));
  }

  return (
    <Container fluid className="pt-5 pb-5 px-2 px-sm-4">
      <SettingsMenu shareUrl={window.location.origin} />
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
      <div className="d-flex flex-nowrap justify-content-center align-items-center gap-3 gap-sm-5 mb-4">
        <img
          src="/favicon.svg"
          alt=""
          style={{ height: 'clamp(2rem, 12vw, 4rem)', flexShrink: 0 }}
        />
        <Tip text="/ænˈeks/ (verb) : to take possession of an area of land or a country, usually by force or without permission">
          <h1
            className="mb-0 text-nowrap"
            style={{ fontSize: 'clamp(1.5rem, 9vw, 2.5rem)' }}
          >
            Annex
          </h1>
        </Tip>
        <img
          src="/favicon.svg"
          alt=""
          style={{ height: 'clamp(2rem, 12vw, 4rem)', flexShrink: 0 }}
        />
      </div>

      {kickedMessage && (
        <Alert variant="warning" dismissible onClose={clearKickedMessage}>
          {kickedMessage}
        </Alert>
      )}

      {resumeGame && (
        <div className="text-center mb-4">
          <Button
            variant="success"
            onClick={() => navigate(gamePath(resumeGame))}
          >
            Resume {resumeGame}
          </Button>
        </div>
      )}

      <div className="d-flex flex-column flex-sm-row align-items-center justify-content-center gap-2 mb-4">
        <Button onClick={createGame}>Create Online</Button>
        <Button variant="secondary" onClick={() => navigate('/games/offline')}>
          Create Offline
        </Button>
      </div>

      {games.length === 0 ? (
        <p className="text-center">No Games Available</p>
      ) : (
        <div className="table-responsive">
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
                    onClick={() => navigate(gamePath(g.name))}
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
        </div>
      )}
    </Container>
  );
}

export default Home;
