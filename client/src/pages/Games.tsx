import { useEffect, useState } from 'react';
import { Container, Form, Spinner, Table } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import {
  Field,
  FilterDetails,
  ListPager,
  RangeField,
  SortSelect,
} from '../common/filterControls';
import { useWhiteIcon } from '../common/icon';
import type { SearchSelectItem } from '../common/SearchMultiSelect';
import { connector } from '../connector';
import { contrastTextColor, playerColor } from '../lib/palette';
import type {
  Account,
  GameHistoryRow,
  GamesPage,
  GamesQuery,
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

const PAGE_SIZE = 20;

const ROUNDS_MIN = 1;
const ROUNDS_MAX = 1000;
const PLAYERS_MIN = 2;
const PLAYERS_MAX = 20;
const POSITION_MIN = 1;
const POSITION_MAX = 20;
const DURATION_MIN = 0;
const DURATION_MAX = 1000;

type SortOption =
  | 'newest'
  | 'oldest'
  | 'mostRounds'
  | 'fewestRounds'
  | 'bestPosition'
  | 'worstPosition';

const SORT_TO_QUERY: Record<
  SortOption,
  { sort: 'newest' | 'rounds' | 'position'; sortDir: 'asc' | 'desc' }
> = {
  newest: { sort: 'newest', sortDir: 'desc' },
  oldest: { sort: 'newest', sortDir: 'asc' },
  mostRounds: { sort: 'rounds', sortDir: 'desc' },
  fewestRounds: { sort: 'rounds', sortDir: 'asc' },
  bestPosition: { sort: 'position', sortDir: 'asc' },
  worstPosition: { sort: 'position', sortDir: 'desc' },
};

interface Props {
  account: Account | null;
}

interface Filters {
  playerIds: string[];
  name: string;
  mode: string;
  startedFrom: string;
  startedTo: string;
  endedFrom: string;
  endedTo: string;
  durationMin: number;
  durationMax: number;
  mapName: string;
  mapGenerationSize: string;
  mapGenerationWater: string;
  settings: Record<string, string>;
  outcome: '' | 'won' | 'lost';
  roundsMin: number;
  roundsMax: number;
  playersMin: number;
  playersMax: number;
  positionMin: number;
  positionMax: number;
}

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

function DateRangeField({
  label,
  from,
  to,
  setFrom,
  setTo,
}: {
  label: string;
  from: string;
  to: string;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
}) {
  return (
    <Field label={label} wide>
      <div className="d-flex align-items-center gap-1 flex-wrap flex-sm-nowrap">
        <span className="small text-muted">From</span>
        <Form.Control
          size="sm"
          type="datetime-local"
          style={{ width: 190 }}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <span className="small text-muted">To</span>
        <Form.Control
          size="sm"
          type="datetime-local"
          style={{ width: 190 }}
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>
    </Field>
  );
}

function Games({ account }: Props) {
  const navigate = useNavigate();

  const [selectedPlayers, setSelectedPlayers] = useState<SearchSelectItem[]>(
    [],
  );
  const [name, setName] = useState('');
  const [mode, setMode] = useState('');
  const [startedFrom, setStartedFrom] = useState('');
  const [startedTo, setStartedTo] = useState('');
  const [endedFrom, setEndedFrom] = useState('');
  const [endedTo, setEndedTo] = useState('');
  const [durationMin, setDurationMin] = useState(DURATION_MIN);
  const [durationMax, setDurationMax] = useState(DURATION_MAX);
  const [mapName, setMapName] = useState('');
  const [mapGenerationSize, setMapGenerationSize] = useState('');
  const [mapGenerationWater, setMapGenerationWater] = useState('');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<'' | 'won' | 'lost'>('');
  const [roundsMin, setRoundsMin] = useState(ROUNDS_MIN);
  const [roundsMax, setRoundsMax] = useState(ROUNDS_MAX);
  const [playersMin, setPlayersMin] = useState(PLAYERS_MIN);
  const [playersMax, setPlayersMax] = useState(PLAYERS_MAX);
  const [positionMin, setPositionMin] = useState(POSITION_MIN);
  const [positionMax, setPositionMax] = useState(POSITION_MAX);
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [mineOverride, setMineOverride] = useState<boolean | null>(null);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<GamesPage | null>(null);

  const mineOnly = mineOverride ?? !!account;

  const filters: Filters = {
    playerIds: selectedPlayers.map((p) => p.id),
    name,
    mode,
    startedFrom,
    startedTo,
    endedFrom,
    endedTo,
    durationMin,
    durationMax,
    mapName,
    mapGenerationSize,
    mapGenerationWater,
    settings,
    outcome,
    roundsMin,
    roundsMax,
    playersMin,
    playersMax,
    positionMin,
    positionMax,
  };
  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    let stale = false;
    const { sort, sortDir } = SORT_TO_QUERY[sortOption];
    const roundsNarrowed = roundsMin !== ROUNDS_MIN || roundsMax !== ROUNDS_MAX;
    const playersNarrowed =
      playersMin !== PLAYERS_MIN || playersMax !== PLAYERS_MAX;
    const positionNarrowed =
      !!account &&
      (positionMin !== POSITION_MIN || positionMax !== POSITION_MAX);
    const durationNarrowed =
      durationMin !== DURATION_MIN || durationMax !== DURATION_MAX;
    const query: GamesQuery = {
      page,
      pageSize: PAGE_SIZE,
      playerIds:
        selectedPlayers.length > 0
          ? selectedPlayers.map((p) => p.id)
          : undefined,
      name: name.trim() || undefined,
      mode: mode || undefined,
      startedFrom: startedFrom ? new Date(startedFrom).getTime() : undefined,
      startedTo: startedTo ? new Date(startedTo).getTime() : undefined,
      endedFrom: endedFrom ? new Date(endedFrom).getTime() : undefined,
      endedTo: endedTo ? new Date(endedTo).getTime() : undefined,
      durationMin: durationNarrowed ? durationMin : undefined,
      durationMax: durationNarrowed ? durationMax : undefined,
      mapName: mapName && mapName !== GENERATED_MAP_VALUE ? mapName : undefined,
      generatedMap: mapName === GENERATED_MAP_VALUE ? true : undefined,
      mapGenerationSize:
        mapName === GENERATED_MAP_VALUE
          ? (mapGenerationSize as MapSize) || undefined
          : undefined,
      mapGenerationWater:
        mapName === GENERATED_MAP_VALUE
          ? (mapGenerationWater as WaterLevel) || undefined
          : undefined,
      settings,
      outcome: outcome || undefined,
      minRounds: roundsNarrowed ? roundsMin : undefined,
      maxRounds: roundsNarrowed ? roundsMax : undefined,
      playersMin: playersNarrowed ? playersMin : undefined,
      playersMax: playersNarrowed ? playersMax : undefined,
      positionMin: positionNarrowed ? positionMin : undefined,
      positionMax: positionNarrowed ? positionMax : undefined,
      mine: mineOnly,
      sort,
      sortDir,
    };
    connector.listGameHistory(query, (r) => {
      if (!stale) setResult(r);
    });
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterKey, mineOnly, sortOption]);

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / PAGE_SIZE))
    : 1;
  const serverRows = result?.games ?? [];
  const nothing = result !== null && serverRows.length === 0;

  function clearFilters() {
    setSelectedPlayers([]);
    setName('');
    setMode('');
    setStartedFrom('');
    setStartedTo('');
    setEndedFrom('');
    setEndedTo('');
    setDurationMin(DURATION_MIN);
    setDurationMax(DURATION_MAX);
    setMapName('');
    setMapGenerationSize('');
    setMapGenerationWater('');
    setSettings({});
    setOutcome('');
    setRoundsMin(ROUNDS_MIN);
    setRoundsMax(ROUNDS_MAX);
    setPlayersMin(PLAYERS_MIN);
    setPlayersMax(PLAYERS_MAX);
    setPositionMin(POSITION_MIN);
    setPositionMax(POSITION_MAX);
    setPage(1);
  }

  return (
    <Container fluid className="py-5 px-2 px-sm-4">
      <h1 className="text-center mb-4">Games</h1>

      <SortSelect
        value={sortOption}
        onChange={(v) => resetPage(setSortOption)(v as SortOption)}
        after={
          account && (
            <Form.Check
              type="switch"
              id="mine-only"
              label="My games only"
              checked={mineOnly}
              onChange={(e) => resetPage(setMineOverride)(e.target.checked)}
            />
          )
        }
      >
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
        <option value="mostRounds">Most rounds</option>
        <option value="fewestRounds">Fewest rounds</option>
        {account && <option value="bestPosition">Best position</option>}
        {account && <option value="worstPosition">Worst position</option>}
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
                maxLength={20}
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
            <DateRangeField
              label="Started"
              from={startedFrom}
              to={startedTo}
              setFrom={resetPage(setStartedFrom)}
              setTo={resetPage(setStartedTo)}
            />
            <DateRangeField
              label="Ended"
              from={endedFrom}
              to={endedTo}
              setFrom={resetPage(setEndedFrom)}
              setTo={resetPage(setEndedTo)}
            />
            <RangeField
              label="Duration (min)"
              min={DURATION_MIN}
              max={DURATION_MAX}
              lo={durationMin}
              hi={durationMax}
              fallbackLo={DURATION_MIN}
              fallbackHi={DURATION_MAX}
              setLo={resetPage(setDurationMin)}
              setHi={resetPage(setDurationMax)}
            />
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
            {account && (
              <RangeField
                label="Position"
                min={POSITION_MIN}
                max={POSITION_MAX}
                lo={positionMin}
                hi={positionMax}
                fallbackLo={POSITION_MIN}
                fallbackHi={POSITION_MAX}
                setLo={resetPage(setPositionMin)}
                setHi={resetPage(setPositionMax)}
              />
            )}
            {account && (
              <Field label="Result">
                <Form.Select
                  size="sm"
                  className="w-auto"
                  value={outcome}
                  onChange={(e) =>
                    resetPage(setOutcome)(e.target.value as '' | 'won' | 'lost')
                  }
                >
                  <option value="">Any</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                </Form.Select>
              </Field>
            )}
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
      ) : nothing ? (
        <p className="text-center text-muted">No games match.</p>
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
                {serverRows.map((row) => (
                  <GameRow
                    key={row.id}
                    row={row}
                    onOpen={() => navigate(`/games/replay/${row.id}`)}
                  />
                ))}
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

export default Games;
