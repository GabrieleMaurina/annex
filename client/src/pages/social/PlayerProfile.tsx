import { newAccountAllowance } from 'engine';
import { useEffect, useState } from 'react';
import { Button, Container, Spinner, Table } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import Flag from '../../common/badges/Flag';
import RankIcon from '../../common/badges/RankIcon';
import CareerChart from '../../common/charts/CareerChart';
import ReportPlayerModal from '../../common/conduct/ReportPlayerModal';
import { formatError } from '../../common/formatError';
import { useWhiteIcon } from '../../common/icon';
import ProfilePictureEditor from '../../common/inputs/ProfilePictureEditor';
import SharePageButton from '../../common/menus/SharePageButton';
import ProfileActions from '../../common/ProfileActions';
import Tip from '../../common/tooltips/Tip';
import { connector } from '../../connector';
import { contrastTextColor, playerColor } from '../../lib/palette';
import { rankForElo } from '../../lib/ranks';
import { useToggleSound } from '../../lib/sounds';
import type {
  Account,
  GameHistoryRow,
  GamesPage,
  PlayerHistoryPoint,
  PlayerMapRow,
  PlayerProfile,
} from '../../lib/types';
import { titleCase } from '../../lobby/settings/gameSettings';
import MapBrowser from '../../maps/MapBrowser';
import MapPreviewModal from '../../maps/MapPreviewModal';
import { PANEL_BG_CLASS, PANEL_CLASS } from '../../ui/containers/panelStyle';
import Achievements from './Achievements';
import ProfileBio from './ProfileBio';

const PAGE_SIZE = 20;

function GameRow({ row, onOpen }: { row: GameHistoryRow; onOpen: () => void }) {
  const whiteBotIcon = useWhiteIcon('/icons/bot.svg');
  const endedAt = new Date(row.endedAt);
  return (
    <tr role="button" onClick={onOpen}>
      <td>{endedAt.toLocaleDateString()}</td>
      <td>{endedAt.toLocaleTimeString()}</td>
      <td>{row.name}</td>
      <td>{row.mapName}</td>
      <td>{titleCase(row.gameMode)}</td>
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
      <td>{row.draw ? 'Draw' : row.winnerNames.join(', ')}</td>
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
  const [openedAt] = useState(() => Date.now());
  const [result, setResult] = useState<GamesPage | null>(null);
  const [mapTotal, setMapTotal] = useState<number | null>(null);
  const [history, setHistory] = useState<PlayerHistoryPoint[]>([]);
  const [reportMenu, setReportMenu] = useState<{
    x: number;
    y: number;
    reason: string;
    label: string;
  } | null>(null);
  useToggleSound(reportMenu !== null);
  const [reportMessage, setReportMessage] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<string>();
  const [mapPreview, setMapPreview] = useState<PlayerMapRow | null>(null);

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
    connector.listPlayerMaps(
      { page: 1, pageSize: 1, sort: 'newest', authorId: profile.id },
      (r) => {
        if (!stale) setMapTotal(r.total);
      },
    );
    return () => {
      stale = true;
    };
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    let stale = false;
    connector.getPlayerHistory(profile.username, (points) => {
      if (!stale) setHistory(points);
    });
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

  const canManageFriend = !!account && account.id !== profile.id;
  const isOwnProfile = !!account && !canManageFriend;
  const allowance = isOwnProfile
    ? newAccountAllowance(profile.createdAt, openedAt)
    : 0;
  const canReportPicture = canManageFriend && !!profile.picture;
  const canReportText = canManageFriend && !!profile.bio;
  const profileId = profile.id;
  const profileUsername = profile.username;

  function reloadProfile() {
    connector.getPlayerProfile(profileUsername, setProfile);
  }

  function openReportMenu(e: React.MouseEvent, reason: string, label: string) {
    e.preventDefault();
    setReportMessage('');
    setReportMenu({ x: e.clientX, y: e.clientY, reason, label });
  }

  const onlineDot = (
    <Tip text={profile.online ? 'Online' : 'Offline'}>
      <span
        role="img"
        aria-label={profile.online ? 'Online' : 'Offline'}
        className={`position-absolute bottom-0 end-0 m-1 rounded-circle border border-2 border-white ${profile.online ? 'bg-success' : 'bg-secondary'}`}
        style={{ width: 16, height: 16 }}
      />
    </Tip>
  );

  function openReport(reason?: string) {
    setReportMessage('');
    setReportReason(reason);
    setReportOpen(true);
  }

  const rank = rankForElo(profile.elo);
  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / PAGE_SIZE))
    : 1;
  const rows = result?.games ?? [];

  const winRate =
    profile.gamesPlayed === 0
      ? '-'
      : `${Math.round((profile.wins / profile.gamesPlayed) * 100)}%`;
  const careerStats: { label: string; value: string }[] = [
    { label: 'Games', value: profile.gamesPlayed.toLocaleString() },
    { label: 'Wins', value: profile.wins.toLocaleString() },
    { label: 'Win rate', value: winRate },
    {
      label: 'Average placing',
      value:
        profile.averagePlacing === null
          ? '-'
          : profile.averagePlacing.toFixed(2),
    },
    { label: 'Troops gained', value: profile.troopsGained.toLocaleString() },
    { label: 'Troops killed', value: profile.troopsKilled.toLocaleString() },
    { label: 'Troops lost', value: profile.troopsLost.toLocaleString() },
    {
      label: 'Territories conquered',
      value: profile.territoriesConquered.toLocaleString(),
    },
    {
      label: 'Players eliminated',
      value: profile.playersKilled.toLocaleString(),
    },
    {
      label: 'Capitals conquered',
      value: profile.capitalsConquered.toLocaleString(),
    },
    { label: 'Sets played', value: profile.setsPlayed.toLocaleString() },
  ];

  return (
    <Container fluid className="py-5 px-2 px-sm-4">
      <div
        className={`${PANEL_BG_CLASS} ${PANEL_CLASS} d-flex flex-column flex-md-row align-items-center gap-4 mt-3 mb-4`}
      >
        {isOwnProfile ? (
          <ProfilePictureEditor
            picture={profile.picture}
            dangerous={false}
            size={120}
            onChanged={reloadProfile}
          >
            {onlineDot}
          </ProfilePictureEditor>
        ) : (
          <div className="position-relative flex-shrink-0">
            {profile.picture ? (
              <img
                src={profile.picture}
                alt={profile.username}
                width={120}
                height={120}
                className="rounded d-block"
                onContextMenu={
                  canReportPicture
                    ? (e) =>
                        openReportMenu(e, 'offensive picture', 'Report picture')
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
            {onlineDot}
          </div>
        )}
        <div className="d-flex flex-column align-items-center align-items-md-start gap-2">
          <h1 className="d-flex align-items-center gap-2 mb-0">
            <Flag country={profile.country} height={30} />
            {profile.username}
          </h1>
          <ProfileBio
            key={profile.id}
            bio={profile.bio}
            editable={isOwnProfile}
            onContextMenu={
              canReportText
                ? (e) => openReportMenu(e, 'offensive text', 'Report text')
                : undefined
            }
          />
          <div className="small text-muted">
            Member since {new Date(profile.createdAt).toLocaleDateString()}
          </div>
          {reportMessage && (
            <span className="small text-muted">
              {formatError(reportMessage)}
            </span>
          )}
          <SharePageButton
            title={profile.username}
            path={`/players/${encodeURIComponent(profile.username)}`}
            tooltip={
              isOwnProfile
                ? 'Share your profile with friends'
                : 'Share this profile with friends'
            }
          />
        </div>
        <div
          className={`d-flex flex-wrap flex-grow-1 justify-content-center ${canManageFriend ? '' : 'justify-content-md-end'} align-items-center gap-4`}
        >
          <div className="d-flex align-items-center gap-2">
            <RankIcon elo={profile.elo} size={40} />
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
            <div className="small text-muted">Reputation</div>
            <div className="fs-5">{profile.reputation}</div>
          </div>
        </div>
        {canManageFriend && (
          <ProfileActions
            userId={profile.id}
            username={profile.username}
            onReport={() => openReport()}
          />
        )}
      </div>

      {allowance > 0 && profile.reputation >= 0 && (
        <p className="small text-muted text-center">
          New account bonus: +{allowance} reputation when joining games (ends in{' '}
          {allowance} {allowance === 1 ? 'day' : 'days'})
        </p>
      )}

      {reportMenu && (
        <div
          className={`${PANEL_BG_CLASS} border rounded position-fixed p-1`}
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
            variant="danger"
            onClick={() => {
              setReportMenu(null);
              openReport(reportMenu.reason);
            }}
          >
            {reportMenu.label}
          </Button>
        </div>
      )}
      <ReportPlayerModal
        show={reportOpen}
        playerName={profile.username}
        includePicture={!!profile.picture}
        includeText={!!profile.bio}
        initialReason={reportReason}
        onHide={() => setReportOpen(false)}
        onSubmit={(reason, cb) =>
          connector.reportPlayer({ userId: profileId, reason }, cb)
        }
        onReported={() => setReportMessage('report submitted')}
      />

      <div className="row row-cols-2 row-cols-sm-3 row-cols-lg-4 row-cols-xl-6 g-2 justify-content-center mb-4">
        {careerStats.map((stat) => (
          <div key={stat.label} className="col">
            <div className="border rounded p-2 text-center h-100">
              <div className="small text-muted">{stat.label}</div>
              <div className="fs-5">{stat.value}</div>
            </div>
          </div>
        ))}
      </div>

      <Achievements key={profile.id} username={profile.username} />

      {history.length > 0 && (
        <div className="mb-4">
          <h4 className="mb-3">Stats over time</h4>
          <CareerChart
            key={profile.id}
            history={history}
            includeElo={profile.elo > 0}
          />
        </div>
      )}

      {result === null || mapTotal === null ? (
        <div className="text-center">
          <Spinner size="sm" className="me-2" />
          Loading...
        </div>
      ) : (
        <>
          {rows.length > 0 && (
            <>
              <h4 className="mb-3">Games</h4>
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

          {mapTotal > 0 && (
            <div className={rows.length > 0 ? 'mt-5' : undefined}>
              <h4 className="mb-3">Maps</h4>
              <MapBrowser
                account={account}
                mode="browse"
                authorId={profileId}
                onRowClick={setMapPreview}
              />
            </div>
          )}

          {rows.length === 0 && mapTotal === 0 && (
            <p className="text-center text-muted">Nothing here yet.</p>
          )}
        </>
      )}

      <MapPreviewModal
        account={account}
        preview={mapPreview}
        onHide={() => setMapPreview(null)}
      />
    </Container>
  );
}

export default PlayerProfilePage;
