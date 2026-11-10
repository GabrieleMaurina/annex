import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Container, Form, Spinner } from 'react-bootstrap';
import {
  Field,
  FilterDetails,
  ListPager,
  RangeField,
  SortSelect,
} from '../common/inputs/filterControls';
import type { SearchSelectItem } from '../common/inputs/SearchMultiSelect';
import PagePanel from '../common/page/PagePanel';
import { connector } from '../connector';
import {
  getHomeFilters,
  getPlayerName,
  isLoggedIn,
  saveHomeFilters,
} from '../lib/player';
import type {
  Account,
  Fill,
  GameSummary,
  GenerationType,
  HomeFilters,
  HomeGamesPage,
  HomeGamesQuery,
  MapAspect,
  MapKind,
  MapSize,
  TileShape,
} from '../lib/types';
import { GAME_MODES } from '../lib/types';
import {
  MapFilterFields,
  PlayerFilter,
  SettingFilterSections,
} from '../lobby/gameFilters';
import { GENERATED_MAP_VALUE, titleCase } from '../lobby/settings/gameSettings';
import { GAME_MODE_HELP, PASSWORD_HELP } from '../lobby/settings/settingsHelp';
import { loadCompletedTutorials } from '../tutorials/progress';
import TutorialInviteModal from '../tutorials/TutorialInviteModal';
import { TUTORIALS } from '../tutorials/tutorials';
import { SECTION_CLASS } from '../ui/containers/panelStyle';
import Selector from '../ui/forms/Selector';
import GamesTable from './home/GamesTable';
import HomeHero from './home/HomeHero';

const MAX_GAME_NAME_LENGTH = 20;
const POLL_MS = 5000;
const RANDOM_JOIN_RETRY_MS = 2000;
const PAGE_SIZE = 20;

const PLAYERS_MIN = 2;
const PLAYERS_MAX = 20;
const ROUNDS_MIN = 0;
const ROUNDS_MAX = 1000;

const DEFAULT_FILTERS: HomeFilters = {
  players: [],
  name: '',
  mode: '',
  mapName: '',
  mapGenerationSize: '',
  mapGenerationType: '',
  mapGenerationFill: '',
  mapGenerationTile: '',
  mapGenerationAspect: '',
  mapGenerationSeas: '',
  mapGenerationTimed: '',
  mapGenerationDirectional: '',
  mapGenerationSwitched: '',
  mapGenerationUnlockable: '',
  mapGenerationMountains: '',
  mapGenerationRivers: '',
  playersMin: PLAYERS_MIN,
  playersMax: PLAYERS_MAX,
  roundsMin: ROUNDS_MIN,
  roundsMax: ROUNDS_MAX,
  phase: '',
  password: '',
  hasBots: '',
  settings: {},
  sort: 'newest',
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
  sessionReady: boolean;
  serverUnreachable: boolean;
  account: Account | null;
  onAccountChange: (account: Account | null) => void;
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

function Home({
  navigate,
  kickedMessage,
  clearKickedMessage,
  sessionReady,
  serverUnreachable,
  account,
  onAccountChange,
}: Props) {
  const [result, setResult] = useState<HomeGamesPage | null>(null);
  const [resumeGame, setResumeGame] = useState<string | null>(null);

  const initial = getHomeFilters() ?? DEFAULT_FILTERS;
  const [selectedPlayers, setSelectedPlayers] = useState<SearchSelectItem[]>(
    initial.players,
  );
  const [name, setName] = useState(initial.name);
  const [mode, setMode] = useState(initial.mode);
  const [mapName, setMapName] = useState(initial.mapName);
  const [mapGenerationSize, setMapGenerationSize] = useState(
    initial.mapGenerationSize,
  );
  const [mapGenerationType, setMapGenerationType] = useState(
    initial.mapGenerationType,
  );
  const [mapGenerationFill, setMapGenerationFill] = useState(
    initial.mapGenerationFill,
  );
  const [mapGenerationTile, setMapGenerationTile] = useState(
    initial.mapGenerationTile,
  );
  const [mapGenerationAspect, setMapGenerationAspect] = useState(
    initial.mapGenerationAspect,
  );
  const [mapGenerationSeas, setMapGenerationSeas] = useState(
    initial.mapGenerationSeas,
  );
  const [mapGenerationTimed, setMapGenerationTimed] = useState(
    initial.mapGenerationTimed,
  );
  const [mapGenerationDirectional, setMapGenerationDirectional] = useState(
    initial.mapGenerationDirectional,
  );
  const [mapGenerationSwitched, setMapGenerationSwitched] = useState(
    initial.mapGenerationSwitched,
  );
  const [mapGenerationUnlockable, setMapGenerationUnlockable] = useState(
    initial.mapGenerationUnlockable,
  );
  const [mapGenerationMountains, setMapGenerationMountains] = useState(
    initial.mapGenerationMountains,
  );
  const [mapGenerationRivers, setMapGenerationRivers] = useState(
    initial.mapGenerationRivers,
  );
  const [playersMin, setPlayersMin] = useState(initial.playersMin);
  const [playersMax, setPlayersMax] = useState(initial.playersMax);
  const [roundsMin, setRoundsMin] = useState(initial.roundsMin);
  const [roundsMax, setRoundsMax] = useState(initial.roundsMax);
  const [phase, setPhase] = useState<'' | GameSummary['state']>(
    initial.phase as '' | GameSummary['state'],
  );
  const [password, setPassword] = useState<'' | 'yes' | 'no'>(
    initial.password as '' | 'yes' | 'no',
  );
  const [hasBots, setHasBots] = useState<'' | 'yes' | 'no'>(
    initial.hasBots as '' | 'yes' | 'no',
  );
  const [settings, setSettings] = useState<Record<string, string>>(
    initial.settings,
  );
  const [sortOption, setSortOption] = useState<SortOption>(
    initial.sort as SortOption,
  );
  const [page, setPage] = useState(1);
  const [joiningRandom, setJoiningRandom] = useState(false);
  const [completedTutorials, setCompletedTutorials] = useState<string[] | null>(
    null,
  );
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  function applyFilters(filters: HomeFilters) {
    setSelectedPlayers(filters.players);
    setName(filters.name);
    setMode(filters.mode);
    setMapName(filters.mapName);
    setMapGenerationSize(filters.mapGenerationSize);
    setMapGenerationType(filters.mapGenerationType);
    setMapGenerationFill(filters.mapGenerationFill);
    setMapGenerationTile(filters.mapGenerationTile);
    setMapGenerationAspect(filters.mapGenerationAspect);
    setMapGenerationSeas(filters.mapGenerationSeas);
    setMapGenerationTimed(filters.mapGenerationTimed);
    setMapGenerationDirectional(filters.mapGenerationDirectional);
    setMapGenerationSwitched(filters.mapGenerationSwitched);
    setMapGenerationUnlockable(filters.mapGenerationUnlockable);
    setMapGenerationMountains(filters.mapGenerationMountains);
    setMapGenerationRivers(filters.mapGenerationRivers);
    setPlayersMin(filters.playersMin);
    setPlayersMax(filters.playersMax);
    setRoundsMin(filters.roundsMin);
    setRoundsMax(filters.roundsMax);
    setPhase(filters.phase as '' | GameSummary['state']);
    setPassword(filters.password as '' | 'yes' | 'no');
    setHasBots(filters.hasBots as '' | 'yes' | 'no');
    setSettings(filters.settings);
    setSortOption(filters.sort as SortOption);
    setPage(1);
  }

  const filtersAccount = account?.username ?? null;
  const [appliedAccount, setAppliedAccount] = useState(filtersAccount);
  if (appliedAccount !== filtersAccount) {
    setAppliedAccount(filtersAccount);
    applyFilters(getHomeFilters() ?? DEFAULT_FILTERS);
  }

  const playerIds = selectedPlayers.map((p) => p.id);
  const playersNarrowed =
    playersMin !== PLAYERS_MIN || playersMax !== PLAYERS_MAX;
  const roundsNarrowed = roundsMin !== ROUNDS_MIN || roundsMax !== ROUNDS_MAX;
  const activeFilterCount =
    [
      playerIds.length > 0,
      name.trim() !== '',
      mode,
      mapName,
      mapGenerationSize,
      mapGenerationType,
      mapGenerationFill,
      mapGenerationTile,
      mapGenerationAspect,
      mapGenerationSeas,
      mapGenerationTimed,
      mapGenerationDirectional,
      mapGenerationSwitched,
      mapGenerationUnlockable,
      mapGenerationMountains,
      mapGenerationRivers,
      playersNarrowed,
      roundsNarrowed,
      phase,
      password,
      hasBots,
    ].filter(Boolean).length + Object.values(settings).filter(Boolean).length;

  const filterKey = JSON.stringify({
    playerIds,
    name,
    mode,
    mapName,
    mapGenerationSize,
    mapGenerationType,
    mapGenerationFill,
    mapGenerationTile,
    mapGenerationAspect,
    mapGenerationSeas,
    mapGenerationTimed,
    mapGenerationDirectional,
    mapGenerationSwitched,
    mapGenerationUnlockable,
    mapGenerationMountains,
    mapGenerationRivers,
    playersMin,
    playersMax,
    roundsMin,
    roundsMax,
    phase,
    password,
    hasBots,
    settings,
  });

  const persistedFilters: HomeFilters = {
    players: selectedPlayers,
    name,
    mode,
    mapName,
    mapGenerationSize,
    mapGenerationType,
    mapGenerationFill,
    mapGenerationTile,
    mapGenerationAspect,
    mapGenerationSeas,
    mapGenerationTimed,
    mapGenerationDirectional,
    mapGenerationSwitched,
    mapGenerationUnlockable,
    mapGenerationMountains,
    mapGenerationRivers,
    playersMin,
    playersMax,
    roundsMin,
    roundsMax,
    phase,
    password,
    hasBots,
    settings,
    sort: sortOption,
  };
  const persistedFiltersKey = JSON.stringify(persistedFilters);
  const savedFiltersKey = useRef(persistedFiltersKey);

  useEffect(() => {
    savedFiltersKey.current = persistedFiltersKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedAccount]);

  useEffect(() => {
    if (persistedFiltersKey === savedFiltersKey.current) return;
    savedFiltersKey.current = persistedFiltersKey;
    if (isLoggedIn()) saveHomeFilters(persistedFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistedFiltersKey]);

  useEffect(() => {
    if (!sessionReady && !serverUnreachable) return;
    function refresh() {
      if (document.visibilityState !== 'visible') return;
      const { sort, sortDir } = SORT_TO_QUERY[sortOption];
      const generated = mapName === GENERATED_MAP_VALUE;
      const query: HomeGamesQuery = {
        page,
        pageSize: PAGE_SIZE,
        playerIds: playerIds.length > 0 ? playerIds : undefined,
        name: name.trim() || undefined,
        mode: mode || undefined,
        mapKind: (mapName as MapKind) || undefined,
        mapGenerationSize: generated
          ? (mapGenerationSize as MapSize) || undefined
          : undefined,
        mapGenerationType: generated
          ? (mapGenerationType as GenerationType) || undefined
          : undefined,
        mapGenerationFill: generated
          ? (mapGenerationFill as Fill) || undefined
          : undefined,
        mapGenerationTile: generated
          ? (mapGenerationTile as TileShape) || undefined
          : undefined,
        mapGenerationAspect: generated
          ? (mapGenerationAspect as MapAspect) || undefined
          : undefined,
        mapGenerationSeas:
          generated && mapGenerationSeas
            ? mapGenerationSeas === 'yes'
            : undefined,
        mapGenerationTimed:
          generated && mapGenerationTimed
            ? mapGenerationTimed === 'yes'
            : undefined,
        mapGenerationDirectional:
          generated && mapGenerationDirectional
            ? mapGenerationDirectional === 'yes'
            : undefined,
        mapGenerationSwitched:
          generated && mapGenerationSwitched
            ? mapGenerationSwitched === 'yes'
            : undefined,
        mapGenerationUnlockable:
          generated && mapGenerationUnlockable
            ? mapGenerationUnlockable === 'yes'
            : undefined,
        mapGenerationMountains:
          generated && mapGenerationMountains
            ? mapGenerationMountains === 'yes'
            : undefined,
        mapGenerationRivers:
          generated && mapGenerationRivers
            ? mapGenerationRivers === 'yes'
            : undefined,
        playersMin: playersNarrowed ? playersMin : undefined,
        playersMax: playersNarrowed ? playersMax : undefined,
        minRounds: roundsNarrowed ? roundsMin : undefined,
        maxRounds: roundsNarrowed ? roundsMax : undefined,
        settings,
        phase: phase || undefined,
        hasPassword:
          password === 'yes' ? true : password === 'no' ? false : undefined,
        hasBots:
          hasBots === 'yes' ? true : hasBots === 'no' ? false : undefined,
        sort,
        sortDir,
      };
      connector.listGames(query, setResult);
      connector.session((s) => {
        setResumeGame(s.gameName ?? null);
        onAccountChange(s.account);
      });
    }
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, page, sortOption, sessionReady, serverUnreachable]);

  useEffect(() => {
    let stale = false;
    loadCompletedTutorials(account).then((ids) => {
      if (!stale) setCompletedTutorials(ids);
    });
    return () => {
      stale = true;
    };
  }, [account]);

  useEffect(() => {
    if (!joiningRandom) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function attempt() {
      connector.findRandomGame((gameName) => {
        if (cancelled) return;
        if (gameName) navigate(gamePath(gameName));
        else timer = setTimeout(attempt, RANDOM_JOIN_RETRY_MS);
      });
    }
    attempt();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [joiningRandom, navigate]);

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
    setMapGenerationType('');
    setMapGenerationFill('');
    setMapGenerationTile('');
    setMapGenerationAspect('');
    setMapGenerationSeas('');
    setMapGenerationTimed('');
    setMapGenerationDirectional('');
    setMapGenerationSwitched('');
    setMapGenerationUnlockable('');
    setMapGenerationMountains('');
    setMapGenerationRivers('');
    setPlayersMin(PLAYERS_MIN);
    setPlayersMax(PLAYERS_MAX);
    setRoundsMin(ROUNDS_MIN);
    setRoundsMax(ROUNDS_MAX);
    setPhase('');
    setPassword('');
    setHasBots('');
    setSettings({});
    setPage(1);
  }

  const games = result?.games ?? [];
  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / PAGE_SIZE))
    : 1;

  const tutorialsLeft =
    completedTutorials !== null &&
    TUTORIALS.some((t) => !completedTutorials.includes(t.id));
  const inviteToTutorials = tutorialsLeft && (account?.gamesPlayed ?? 0) === 0;

  function offerTutorials(action: () => void) {
    if (inviteToTutorials) setPendingAction(() => action);
    else action();
  }

  function createGame() {
    const base = `Game with ${getPlayerName() || 'Player'}`;
    connector.listGames({ page: 1, pageSize: 100, name: base }, (page) => {
      const taken = new Set(page.games.map((g) => g.name));
      let attempt = 0;
      while (taken.has(suggestedGameName(base, attempt))) attempt += 1;
      navigate(gamePath(suggestedGameName(base, attempt)));
    });
  }

  return (
    <Container fluid className="hero-page pb-5 px-2 px-sm-4">
      <HomeHero
        serverUnreachable={serverUnreachable}
        joiningRandom={joiningRandom}
        showTutorials={
          (sessionReady || serverUnreachable) && (!account || tutorialsLeft)
        }
        onJoinRandom={() => offerTutorials(() => setJoiningRandom(true))}
        onCancelJoin={() => setJoiningRandom(false)}
        onCreateOnline={() => offerTutorials(createGame)}
        onCreateOffline={() => offerTutorials(() => navigate('/games/offline'))}
        onTutorials={() => navigate('/tutorials')}
      />

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

      {!serverUnreachable && (
        <PagePanel
          title="Open games"
          count={result?.total}
          className="rise rise-5"
        >
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

          <FilterDetails count={activeFilterCount} onClear={clearFilters}>
            <div className={`${SECTION_CLASS} p-2 mb-2`}>
              <div className="fw-bold text-muted small mb-2">Match</div>
              <div className="row g-3">
                <PlayerFilter
                  selected={selectedPlayers}
                  onChange={resetPage(setSelectedPlayers)}
                />
                <Field label="Name">
                  <Form.Control
                    size="sm"
                    placeholder="Game name"
                    maxLength={MAX_GAME_NAME_LENGTH}
                    value={name}
                    onChange={(e) => resetPage(setName)(e.target.value)}
                  />
                </Field>
                <Field label="Mode" help={GAME_MODE_HELP}>
                  <Selector
                    size="sm"
                    value={mode}
                    onChange={resetPage(setMode)}
                  >
                    <option value="">Any</option>
                    {GAME_MODES.map((m) => (
                      <option key={m} value={m}>
                        {titleCase(m)}
                      </option>
                    ))}
                  </Selector>
                </Field>
                <Field label="State">
                  <Selector
                    size="sm"
                    value={phase}
                    onChange={(value) =>
                      resetPage(setPhase)(value as '' | GameSummary['state'])
                    }
                  >
                    <option value="">Any</option>
                    <option value="lobby">Lobby</option>
                    <option value="playing">Playing</option>
                    <option value="ended">Ended</option>
                  </Selector>
                </Field>
                <Field label="Password" help={PASSWORD_HELP}>
                  <Selector
                    size="sm"
                    value={password}
                    onChange={(value) =>
                      resetPage(setPassword)(value as '' | 'yes' | 'no')
                    }
                  >
                    <option value="">Any</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </Selector>
                </Field>
                <Field label="Bots">
                  <Selector
                    size="sm"
                    value={hasBots}
                    onChange={(value) =>
                      resetPage(setHasBots)(value as '' | 'yes' | 'no')
                    }
                  >
                    <option value="">Any</option>
                    <option value="yes">Has bots</option>
                    <option value="no">No bots</option>
                  </Selector>
                </Field>
                <RangeField
                  label="Player count"
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

            <div className={`${SECTION_CLASS} p-2 mb-2`}>
              <div className="fw-bold text-muted small mb-2">Map</div>
              <div className="row g-3">
                <MapFilterFields
                  mapName={mapName}
                  size={mapGenerationSize}
                  type={mapGenerationType}
                  fill={mapGenerationFill}
                  tile={mapGenerationTile}
                  aspect={mapGenerationAspect}
                  seas={mapGenerationSeas}
                  timed={mapGenerationTimed}
                  directional={mapGenerationDirectional}
                  switched={mapGenerationSwitched}
                  unlockable={mapGenerationUnlockable}
                  mountains={mapGenerationMountains}
                  rivers={mapGenerationRivers}
                  onMapName={resetPage(setMapName)}
                  onSize={resetPage(setMapGenerationSize)}
                  onType={resetPage(setMapGenerationType)}
                  onFill={resetPage(setMapGenerationFill)}
                  onTile={resetPage(setMapGenerationTile)}
                  onAspect={resetPage(setMapGenerationAspect)}
                  onSeas={resetPage(setMapGenerationSeas)}
                  onTimed={resetPage(setMapGenerationTimed)}
                  onDirectional={resetPage(setMapGenerationDirectional)}
                  onSwitched={resetPage(setMapGenerationSwitched)}
                  onUnlockable={resetPage(setMapGenerationUnlockable)}
                  onMountains={resetPage(setMapGenerationMountains)}
                  onRivers={resetPage(setMapGenerationRivers)}
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
              <GamesTable
                games={games}
                account={account}
                onOpen={(name) =>
                  offerTutorials(() => navigate(gamePath(name)))
                }
              />

              <ListPager
                page={page}
                totalPages={totalPages}
                total={result.total}
                noun="games"
                onChange={setPage}
              />
            </>
          )}
        </PagePanel>
      )}
      <TutorialInviteModal
        show={pendingAction !== null}
        onHide={() => setPendingAction(null)}
        onContinue={() => {
          setPendingAction(null);
          pendingAction?.();
        }}
        onTutorials={() => navigate('/tutorials')}
      />
    </Container>
  );
}

export default Home;
