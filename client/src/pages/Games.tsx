import { BUILTIN_MAP_NAMES } from 'engine';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Button, Container, Form, Spinner, Table } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { connector } from '../connector';
import { contrastTextColor, playerColor } from '../lib/palette';
import { playSound } from '../lib/sounds';
import type {
  Account,
  GameHistoryRow,
  GamesPage,
  GamesQuery,
} from '../lib/types';
import {
  GAME_MODES,
  SETTING_FILTER_SECTIONS,
  SETTING_FILTERS,
} from '../lib/types';

const PAGE_SIZE = 20;

const ROUNDS_MIN = 1;
const ROUNDS_MAX = 1000;
const PLAYERS_MIN = 2;
const PLAYERS_MAX = 20;
const POSITION_MIN = 1;
const POSITION_MAX = 20;

const LABEL_STYLE = { minWidth: 120, flexShrink: 0 };

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
  search: string;
  mode: string;
  mapName: string;
  settings: Record<string, string>;
  outcome: '' | 'won' | 'lost';
  roundsMin: number;
  roundsMax: number;
  playersMin: number;
  playersMax: number;
  positionMin: number;
  positionMax: number;
}

function clampInt(
  value: number,
  lo: number,
  hi: number,
  fallback: number,
): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(hi, Math.max(lo, Math.trunc(value)));
}

function GameRow({ row, onOpen }: { row: GameHistoryRow; onOpen: () => void }) {
  return (
    <tr role="button" style={{ cursor: 'pointer' }} onClick={onOpen}>
      <td>{row.mapName}</td>
      <td>{row.gameMode}</td>
      <td>
        <div className="d-flex flex-wrap gap-1">
          {row.players.map((p, i) => (
            <span
              key={i}
              className="badge"
              style={{
                backgroundColor: playerColor(p.color),
                color: contrastTextColor(playerColor(p.color)),
              }}
            >
              {p.name}
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

function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={`${wide ? 'col-12 col-md-6' : 'col'} d-flex align-items-center gap-2`}
    >
      <Form.Label className="mb-0" style={LABEL_STYLE}>
        {label}
      </Form.Label>
      {children}
    </div>
  );
}

function RangeField({
  label,
  min,
  max,
  lo,
  hi,
  fallbackLo,
  fallbackHi,
  setLo,
  setHi,
}: {
  label: string;
  min: number;
  max: number;
  lo: number;
  hi: number;
  fallbackLo: number;
  fallbackHi: number;
  setLo: (v: number) => void;
  setHi: (v: number) => void;
}) {
  return (
    <Field label={label} wide>
      <div className="d-flex align-items-center gap-1">
        <span className="small text-muted">From</span>
        <Form.Control
          size="sm"
          type="number"
          min={min}
          max={max}
          style={{ width: 64 }}
          value={lo}
          onChange={(e) =>
            setLo(
              clampInt(
                (e.target as HTMLInputElement).valueAsNumber,
                min,
                max,
                fallbackLo,
              ),
            )
          }
        />
        <span className="small text-muted">To</span>
        <Form.Control
          size="sm"
          type="number"
          min={min}
          max={max}
          style={{ width: 64 }}
          value={hi}
          onChange={(e) =>
            setHi(
              clampInt(
                (e.target as HTMLInputElement).valueAsNumber,
                min,
                max,
                fallbackHi,
              ),
            )
          }
        />
      </div>
    </Field>
  );
}

function Games({ account }: Props) {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [mode, setMode] = useState('');
  const [mapName, setMapName] = useState('');
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
    search: debouncedSearch,
    mode,
    mapName,
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
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let stale = false;
    const { sort, sortDir } = SORT_TO_QUERY[sortOption];
    const roundsNarrowed = roundsMin !== ROUNDS_MIN || roundsMax !== ROUNDS_MAX;
    const playersNarrowed =
      playersMin !== PLAYERS_MIN || playersMax !== PLAYERS_MAX;
    const positionNarrowed =
      !!account &&
      (positionMin !== POSITION_MIN || positionMax !== POSITION_MAX);
    const query: GamesQuery = {
      page,
      pageSize: PAGE_SIZE,
      search: debouncedSearch || undefined,
      mode: mode || undefined,
      mapName: mapName || undefined,
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
    setSearch('');
    setDebouncedSearch('');
    setMode('');
    setMapName('');
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

      <Form
        className="d-flex flex-wrap align-items-end justify-content-between row-gap-3 column-gap-3 mb-3"
        onSubmit={(e) => e.preventDefault()}
      >
        <Form.Group>
          <Form.Label className="mb-0 small">Search</Form.Label>
          <Form.Control
            size="sm"
            placeholder="Map, Mode, Player..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Form.Group>
        <Form.Group>
          <Form.Label className="mb-0 small">Mode</Form.Label>
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
        </Form.Group>
        <Form.Group>
          <Form.Label className="mb-0 small">Sort</Form.Label>
          <Form.Select
            size="sm"
            className="w-auto"
            value={sortOption}
            onChange={(e) =>
              resetPage(setSortOption)(e.target.value as SortOption)
            }
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="mostRounds">Most rounds</option>
            <option value="fewestRounds">Fewest rounds</option>
            {account && <option value="bestPosition">Best position</option>}
            {account && <option value="worstPosition">Worst position</option>}
          </Form.Select>
        </Form.Group>
        {account && (
          <Form.Check
            type="switch"
            id="mine-only"
            label="My games only"
            checked={mineOnly}
            onChange={(e) => resetPage(setMineOverride)(e.target.checked)}
          />
        )}
        <Button size="sm" variant="outline-secondary" onClick={clearFilters}>
          Clear filters
        </Button>
      </Form>

      <details className="mb-3" onToggle={() => playSound('click')}>
        <summary className="fw-bold py-2">More filters</summary>
        <div className="border rounded p-2 mb-2">
          <div className="fw-bold text-muted small mb-2">Match</div>
          <div className="row row-cols-1 row-cols-md-2 g-3">
            <Field label="Map">
              <Form.Select
                size="sm"
                className="w-auto"
                value={mapName}
                onChange={(e) => resetPage(setMapName)(e.target.value)}
              >
                <option value="">Any</option>
                {BUILTIN_MAP_NAMES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
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

        {SETTING_FILTER_SECTIONS.map((section) => (
          <div key={section} className="border rounded p-2 mb-2">
            <div className="fw-bold text-muted small mb-2">{section}</div>
            <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-3">
              {SETTING_FILTERS.filter((f) => f.section === section).map((f) => (
                <Field key={f.key} label={f.label}>
                  <Form.Select
                    size="sm"
                    className="w-auto"
                    value={settings[f.key] ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      resetPage(setSettings)((s) => ({
                        ...s,
                        [f.key]: value,
                      }));
                    }}
                  >
                    <option value="">Any</option>
                    {f.options.map((o) => (
                      <option key={o} value={o}>
                        {o.charAt(0).toUpperCase() + o.slice(1)}
                      </option>
                    ))}
                  </Form.Select>
                </Field>
              ))}
            </div>
          </div>
        ))}
      </details>

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
            <Table hover className="align-middle">
              <thead>
                <tr>
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

export default Games;
