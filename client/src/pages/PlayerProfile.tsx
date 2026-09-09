import { useEffect, useState } from 'react';
import { Button, Container, Spinner, Table } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { formatError } from '../common/formatError';
import FriendshipButton from '../common/FriendshipButton';
import { useWhiteIcon } from '../common/icon';
import { PANEL_BG_CLASS } from '../common/panelStyle';
import { connector } from '../connector';
import {
  contrastTextColor,
  GAME_STATE_COLORS,
  playerColor,
} from '../lib/palette';
import { rankForElo } from '../lib/ranks';
import type {
  Account,
  GameHistoryRow,
  GamesPage,
  GameSummary,
  PlayerProfile,
} from '../lib/types';

const PAGE_SIZE = 20;

const LIVE_GAME_LABEL: Record<GameSummary['state'], string> = {
  lobby: 'Join',
  playing: 'Spectate',
  ended: 'View',
};

function GameRow({ row, onOpen }: { row: GameHistoryRow; onOpen: () => void }) {
  const whiteBotIcon = useWhiteIcon('/icons/bot.svg');
  const endedAt = new Date(row.endedAt);
  return (
    <tr role="button" style={{ cursor: 'pointer' }} onClick={onOpen}>
      <td>{endedAt.toLocaleDateString()}</td>
      <td>{endedAt.toLocaleTimeString()}</td>
      <td>{row.name}</td>
      <td>{row.mapName}</td>
      <td>{row.gameMode}</td>
      <td>
        <div className="d-flex flex-wrap gap-1">
          {row.players.map((p, i) => (
            <span
              key={i}
              className="badge d-inline-flex align-items-center gap-1"
              style={{
                backgroundColor: playerColor(p.color),
                color: contrastTextColor(playerColor(p.color)),
              }}
            >
              {p.name}
              {p.isBot && (
                <img
                  src={
                    contrastTextColor(playerColor(p.color)) === '#ffffff'
                      ? (whiteBotIcon ?? '/icons/bot.svg')
                      : '/icons/bot.svg'
                  }
                  width={12}
                  height={12}
                  alt="Bot"
                />
              )}
            </span>
          ))}
        </div>
      </td>
      <td>{row.winnerNames.join(', ')}</td>
      <td>{row.roundNumber}</td>
      <td>{row.yourRank === null ? '-' : row.yourRank + 1}</td>
    </tr>
  );
}

function PlayerProfilePage({ account }: { account: Account | null }) {
  const { username } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<PlayerProfile | null | undefined>(
    undefined,
  );
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<GamesPage | null>(null);
  const [liveGame, setLiveGame] = useState<GameSummary | null>(null);
  const [reportMenu, setReportMenu] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [reportMessage, setReportMessage] = useState('');

  useEffect(() => {
    if (!username) return;
    connector.getPlayerProfile(username, setProfile);
  }, [username]);

  useEffect(() => {
    if (!reportMenu) return;
    function close() {
      setReportMenu(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('mousedown', close);
    document.addEventListener('scroll', close, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('scroll', close, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
    };
  }, [reportMenu]);

  useEffect(() => {
    if (!profile) return;
    let stale = false;
    connector.listGames(
      { page: 1, pageSize: 1, playerIds: [profile.id] },
      (r) => {
        if (!stale) setLiveGame(r.games[0] ?? null);
      },
    );
    return () => {
      stale = true;
    };
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    let stale = false;
    connector.listGameHistory(
      {
        page,
        pageSize: PAGE_SIZE,
        playerIds: [profile.id],
        rankUserId: profile.id,
        sort: 'newest',
        sortDir: 'desc',
      },
      (r) => {
        if (!stale) setResult(r);
      },
    );
    return () => {
      stale = true;
    };
  }, [profile, page]);

  if (profile === undefined) {
    return (
      <Container fluid className="py-5 px-2 px-sm-4 text-center">
        <Spinner size="sm" className="me-2" />
        Loading...
      </Container>
    );
  }

  if (profile === null) {
    return (
      <Container fluid className="py-5 px-2 px-sm-4">
        <h1 className="text-center mb-4">{username}</h1>
        <p className="text-center text-muted">Player not found.</p>
      </Container>
    );
  }

  const canManageFriend =
    !!account &&
    account.username.toLowerCase() !== profile.username.toLowerCase();
  const canReport = canManageFriend && !!profile.picture;
  const profileId = profile.id;

  const rank = rankForElo(profile.elo);
  const liveGameState: GameSummary['state'] | undefined =
    liveGame &&
    liveGame.state === 'lobby' &&
    liveGame.playerCount >= liveGame.slots
      ? 'playing'
      : liveGame?.state;
  const liveGameColor = liveGameState ? GAME_STATE_COLORS[liveGameState] : '';
  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / PAGE_SIZE))
    : 1;
  const rows = result?.games ?? [];
  const nothing = result !== null && rows.length === 0;

  return (
    <Container fluid className="py-5 px-2 px-sm-4">
      <h1 className="text-center mb-2">{profile.username}</h1>

      <div className="d-flex flex-column align-items-center gap-1 mb-4">
        {profile.picture ? (
          <img
            src={profile.picture}
            alt={profile.username}
            width={120}
            height={120}
            className="rounded"
            onContextMenu={
              canReport
                ? (e) => {
                    e.preventDefault();
                    setReportMessage('');
                    setReportMenu({ x: e.clientX, y: e.clientY });
                  }
                : undefined
            }
          />
        ) : (
          <div
            className="rounded bg-secondary d-flex align-items-center justify-content-center text-white-50"
            style={{ width: 120, height: 120 }}
          >
            No picture
          </div>
        )}
        {reportMessage && (
          <span className="small text-muted">{formatError(reportMessage)}</span>
        )}
      </div>

      {reportMenu && (
        <div
          className={`${PANEL_BG_CLASS} border rounded shadow position-fixed p-1`}
          style={{
            left: reportMenu.x,
            top: reportMenu.y,
            transform: `translate(${
              reportMenu.x > window.innerWidth - 160 ? '-100%' : '0'
            }, ${reportMenu.y > window.innerHeight - 80 ? '-100%' : '0'})`,
            zIndex: 1080,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Button
            size="sm"
            variant="outline-danger"
            onClick={() => {
              setReportMenu(null);
              connector.reportPicture(profileId, (res) =>
                setReportMessage(res.ok ? 'report submitted' : res.error),
              );
            }}
          >
            Report picture
          </Button>
        </div>
      )}

      <div className="d-flex flex-wrap justify-content-evenly gap-5 mb-4 w-100">
        <div className="d-flex align-items-center gap-2">
          <img src={`/ranks/${rank.image}.svg`} width={40} height={40} alt="" />
          <span className="fs-5">{rank.name}</span>
        </div>
        <div className="text-center">
          <div className="small text-muted">Elo</div>
          <div className="fs-5">{profile.elo}</div>
        </div>
        <div className="text-center">
          <div className="small text-muted">Percentile</div>
          <div className="fs-5">{profile.percentile}%</div>
        </div>
        <div className="text-center">
          <div className="small text-muted">Total games</div>
          <div className="fs-5">{profile.gamesPlayed}</div>
        </div>
        <div className="text-center">
          <div className="small text-muted">Wins</div>
          <div className="fs-5">{profile.wins}</div>
        </div>
        <div className="text-center">
          <div className="small text-muted">Average placing</div>
          <div className="fs-5">
            {profile.averagePlacing === null
              ? '-'
              : profile.averagePlacing.toFixed(2)}
          </div>
        </div>
        <div className="text-center">
          <div className="small text-muted">Member since</div>
          <div className="fs-5">
            {new Date(profile.createdAt).toLocaleDateString()}
          </div>
        </div>
        {canManageFriend && (
          <div className="d-flex flex-column align-items-center gap-2">
            <FriendshipButton userId={profile.id} username={profile.username} />
            <Button
              size="sm"
              variant="outline-primary"
              onClick={() =>
                navigate(`/messages?to=${encodeURIComponent(profile.username)}`)
              }
            >
              Send message
            </Button>
          </div>
        )}
      </div>

      {liveGame && liveGameState && (
        <div className="d-flex justify-content-center mb-4">
          <button
            type="button"
            className="btn"
            style={{
              backgroundColor: liveGameColor,
              borderColor: liveGameColor,
              color: contrastTextColor(liveGameColor),
            }}
            onClick={() =>
              navigate(`/games/live/${encodeURIComponent(liveGame.name)}`)
            }
          >
            {LIVE_GAME_LABEL[liveGameState]}: {liveGame.name}
          </button>
        </div>
      )}

      {result === null ? (
        <div className="text-center">
          <Spinner size="sm" className="me-2" />
          Loading...
        </div>
      ) : nothing ? (
        <p className="text-center text-muted">No games yet.</p>
      ) : (
        <>
          <div className="table-responsive">
            <Table striped hover className="align-middle">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Game</th>
                  <th>Map</th>
                  <th>Mode</th>
                  <th>Players</th>
                  <th>Winner</th>
                  <th>Rounds</th>
                  <th>Position</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <GameRow
                    key={row.id}
                    row={row}
                    onOpen={() => navigate(`/games/replay/${row.id}`)}
                  />
                ))}
              </tbody>
            </Table>
          </div>

          <div className="d-flex justify-content-center align-items-center gap-3 mt-3">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            <span className="small text-muted">
              Page {page} of {totalPages} ({result.total} games)
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </Container>
  );
}

export default PlayerProfilePage;
