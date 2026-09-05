import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Container,
  Form,
  Spinner,
  Table,
} from 'react-bootstrap';
import {
  Field,
  FilterDetails,
  ListPager,
  RangeField,
  SortSelect,
} from '../common/filterControls';
import { useWhiteIcon } from '../common/icon';
import type { SearchSelectItem } from '../common/SearchMultiSelect';
import SettingsMenu from '../common/SettingsMenu';
import Tip from '../common/Tip';
import { connector } from '../connector';
import { contrastTextColor, playerColor } from '../lib/palette';
import { getPlayerName } from '../lib/player';
import type {
  GameSummary,
  HomeGamesPage,
  HomeGamesQuery,
  MapSize,
  WaterLevel,
} from '../lib/types';
import { GAME_MODES } from '../lib/types';
import {
  MapFilterFields,
  PlayerFilter,
  SettingFilterSections,
} from '../lobby/gameFilters';
import { GENERATED_MAP_VALUE } from '../lobby/gameSettings';

const MAX_GAME_NAME_LENGTH = 20;
const POLL_MS = 5000;
const PAGE_SIZE = 20;

const PLAYERS_MIN = 2;
const PLAYERS_MAX = 20;
const ROUNDS_MIN = 0;
const ROUNDS_MAX = 1000;

const GAME_STATE_COLORS: Record<GameSummary['state'], string> = {
  lobby: playerColor(2),
  playing: playerColor(3),
  ended: playerColor(0),
};

type SortOption =
  | 'newest'
  | 'oldest'
  | 'mostPlayers'
  | 'fewestPlayers'
  | 'mostRounds'
  | 'fewestRounds'
  | 'nameAsc'
  | 'nameDesc';

const SORT_TO_QUERY: Record<
  SortOption,
  { sort: 'newest' | 'players' | 'rounds' | 'name'; sortDir: 'asc' | 'desc' }
> = {
  newest: { sort: 'newest', sortDir: 'desc' },
  oldest: { sort: 'newest', sortDir: 'asc' },
  mostPlayers: { sort: 'players', sortDir: 'desc' },
  fewestPlayers: { sort: 'players', sortDir: 'asc' },
  mostRounds: { sort: 'rounds', sortDir: 'desc' },
  fewestRounds: { sort: 'rounds', sortDir: 'asc' },
  nameAsc: { sort: 'name', sortDir: 'asc' },
  nameDesc: { sort: 'name', sortDir: 'desc' },
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
  const [result, setResult] = useState<HomeGamesPage | null>(null);
  const [resumeGame, setResumeGame] = useState<string | null>(null);
  const whiteGithubIcon = useWhiteIcon('/icons/github.svg');
  const whiteLockIcon = useWhiteIcon('/icons/lock.svg');

  const [selectedPlayers, setSelectedPlayers] = useState<SearchSelectItem[]>(
    [],
  );
  const [name, setName] = useState('');
  const [mode, setMode] = useState('');
  const [mapName, setMapName] = useState('');
  const [mapGenerationSize, setMapGenerationSize] = useState('');
  const [mapGenerationWater, setMapGenerationWater] = useState('');
  const [playersMin, setPlayersMin] = useState(PLAYERS_MIN);
  const [playersMax, setPlayersMax] = useState(PLAYERS_MAX);
  const [roundsMin, setRoundsMin] = useState(ROUNDS_MIN);
  const [roundsMax, setRoundsMax] = useState(ROUNDS_MAX);
  const [phase, setPhase] = useState<'' | GameSummary['state']>('');
  const [password, setPassword] = useState<'' | 'yes' | 'no'>('');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [page, setPage] = useState(1);

  const playerIds = selectedPlayers.map((p) => p.id);

  const filterKey = JSON.stringify({
    playerIds,
    name,
    mode,
    mapName,
    mapGenerationSize,
    mapGenerationWater,
    playersMin,
    playersMax,
    roundsMin,
    roundsMax,
    phase,
    password,
    settings,
  });

  useEffect(() => {
    function refresh() {
      if (document.visibilityState !== 'visible') return;
      const { sort, sortDir } = SORT_TO_QUERY[sortOption];
      const playersNarrowed =
        playersMin !== PLAYERS_MIN || playersMax !== PLAYERS_MAX;
      const roundsNarrowed =
        roundsMin !== ROUNDS_MIN || roundsMax !== ROUNDS_MAX;
      const generated = mapName === GENERATED_MAP_VALUE;
      const query: HomeGamesQuery = {
        page,
        pageSize: PAGE_SIZE,
        playerIds: playerIds.length > 0 ? playerIds : undefined,
        name: name.trim() || undefined,
        mode: mode || undefined,
        mapName: mapName && !generated ? mapName : undefined,
        generatedMap: generated ? true : undefined,
        mapGenerationSize: generated
          ? (mapGenerationSize as MapSize) || undefined
          : undefined,
        mapGenerationWater: generated
          ? (mapGenerationWater as WaterLevel) || undefined
          : undefined,
        playersMin: playersNarrowed ? playersMin : undefined,
        playersMax: playersNarrowed ? playersMax : undefined,
        minRounds: roundsNarrowed ? roundsMin : undefined,
        maxRounds: roundsNarrowed ? roundsMax : undefined,
        settings,
        phase: phase || undefined,
        hasPassword:
          password === 'yes' ? true : password === 'no' ? false : undefined,
        sort,
        sortDir,
      };
      connector.listGames(query, setResult);
      connector.session((s) => setResumeGame(s.gameName ?? null));
    }
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, page, sortOption]);

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  function clearFilters() {
    setSelectedPlayers([]);
    setName('');
    setMode('');
    setMapName('');
    setMapGenerationSize('');
    setMapGenerationWater('');
    setPlayersMin(PLAYERS_MIN);
    setPlayersMax(PLAYERS_MAX);
    setRoundsMin(ROUNDS_MIN);
    setRoundsMax(ROUNDS_MAX);
    setPhase('');
    setPassword('');
    setSettings({});
    setPage(1);
  }

  const games = result?.games ?? [];
  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / PAGE_SIZE))
    : 1;

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

      <SortSelect
        value={sortOption}
        onChange={(v) => resetPage(setSortOption)(v as SortOption)}
      >
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
        <option value="mostPlayers">Most players</option>
        <option value="fewestPlayers">Fewest players</option>
        <option value="mostRounds">Most rounds</option>
        <option value="fewestRounds">Fewest rounds</option>
        <option value="nameAsc">Name A-Z</option>
        <option value="nameDesc">Name Z-A</option>
      </SortSelect>

      <FilterDetails onClear={clearFilters}>
        <div className="border rounded p-2 mb-2">
          <div className="fw-bold text-muted small mb-2">Match</div>
          <div className="row g-3">
            <PlayerFilter
              selected={selectedPlayers}
              onChange={resetPage(setSelectedPlayers)}
            />
            <Field label="Name">
              <Form.Control
                size="sm"
                className="w-auto"
                placeholder="Game name"
                maxLength={MAX_GAME_NAME_LENGTH}
                value={name}
                onChange={(e) => resetPage(setName)(e.target.value)}
              />
            </Field>
            <Field label="Mode">
              <Form.Select
                size="sm"
                className="w-auto"
                value={mode}
                onChange={(e) => resetPage(setMode)(e.target.value)}
              >
                <option value="">Any</option>
                {GAME_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Form.Select>
            </Field>
            <Field label="State">
              <Form.Select
                size="sm"
                className="w-auto"
                value={phase}
                onChange={(e) =>
                  resetPage(setPhase)(
                    e.target.value as '' | GameSummary['state'],
                  )
                }
              >
                <option value="">Any</option>
                <option value="lobby">Lobby</option>
                <option value="playing">Playing</option>
                <option value="ended">Ended</option>
              </Form.Select>
            </Field>
            <Field label="Password">
              <Form.Select
                size="sm"
                className="w-auto"
                value={password}
                onChange={(e) =>
                  resetPage(setPassword)(e.target.value as '' | 'yes' | 'no')
                }
              >
                <option value="">Any</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </Form.Select>
            </Field>
            <RangeField
              label="Players"
              min={PLAYERS_MIN}
              max={PLAYERS_MAX}
              lo={playersMin}
              hi={playersMax}
              fallbackLo={PLAYERS_MIN}
              fallbackHi={PLAYERS_MAX}
              setLo={resetPage(setPlayersMin)}
              setHi={resetPage(setPlayersMax)}
            />
            <RangeField
              label="Rounds"
              min={ROUNDS_MIN}
              max={ROUNDS_MAX}
              lo={roundsMin}
              hi={roundsMax}
              fallbackLo={ROUNDS_MIN}
              fallbackHi={ROUNDS_MAX}
              setLo={resetPage(setRoundsMin)}
              setHi={resetPage(setRoundsMax)}
            />
          </div>
        </div>

        <div className="border rounded p-2 mb-2">
          <div className="fw-bold text-muted small mb-2">Map</div>
          <div className="row g-3">
            <MapFilterFields
              mapName={mapName}
              size={mapGenerationSize}
              water={mapGenerationWater}
              onMapName={resetPage(setMapName)}
              onSize={resetPage(setMapGenerationSize)}
              onWater={resetPage(setMapGenerationWater)}
            />
          </div>
        </div>

        <SettingFilterSections
          settings={settings}
          onChange={(key, value) =>
            resetPage(setSettings)((s) => ({ ...s, [key]: value }))
          }
        />
      </FilterDetails>

      {result === null ? (
        <div className="text-center">
          <Spinner size="sm" className="me-2" />
          Loading...
        </div>
      ) : games.length === 0 ? (
        <p className="text-center text-muted">No games match.</p>
      ) : (
        <>
          <div className="table-responsive">
            <Table striped hover borderless>
              <thead>
                <tr>
                  <th style={{ width: 1 }} />
                  <th>Name</th>
                  <th>Map</th>
                  <th>Host</th>
                  <th>Players</th>
                  <th>State</th>
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
                      <td style={rowStyle} className="text-center px-1">
                        {g.hasPassword && (
                          <img
                            src={
                              contrastTextColor(bg) === '#ffffff'
                                ? (whiteLockIcon ?? '/icons/lock.svg')
                                : '/icons/lock.svg'
                            }
                            width={14}
                            height={14}
                            alt="Password protected"
                          />
                        )}
                      </td>
                      <td style={rowStyle}>{g.name}</td>
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

          <ListPager
            page={page}
            totalPages={totalPages}
            total={result.total}
            noun="games"
            onChange={setPage}
          />
        </>
      )}
    </Container>
  );
}

export default Home;
