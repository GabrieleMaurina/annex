import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Button, Container, Form, Spinner, Table } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { connector } from '../connector';
import { rankForElo } from '../lib/ranks';
import { playSound } from '../lib/sounds';
import type { PlayerRow, PlayersPage, PlayersQuery } from '../lib/types';

const PAGE_SIZE = 20;

const ELO_MIN = 0;
const ELO_MAX = 3100;
const GAMES_MIN = 0;
const GAMES_MAX = 10000;

const LABEL_STYLE = { minWidth: 120, flexShrink: 0 };

type SortOption =
  | 'highestElo'
  | 'lowestElo'
  | 'nameAsc'
  | 'nameDesc'
  | 'mostGames'
  | 'fewestGames';

const SORT_TO_QUERY: Record<
  SortOption,
  { sort: PlayersQuery['sort']; sortDir: PlayersQuery['sortDir'] }
> = {
  highestElo: { sort: 'elo', sortDir: 'desc' },
  lowestElo: { sort: 'elo', sortDir: 'asc' },
  nameAsc: { sort: 'username', sortDir: 'asc' },
  nameDesc: { sort: 'username', sortDir: 'desc' },
  mostGames: { sort: 'games', sortDir: 'desc' },
  fewestGames: { sort: 'games', sortDir: 'asc' },
};

function clampInt(
  value: number,
  lo: number,
  hi: number,
  fallback: number,
): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(hi, Math.max(lo, Math.trunc(value)));
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="col-12 col-sm-6 col-md-4 d-flex align-items-center gap-2">
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
    <div className="col-12 col-md-4 d-flex align-items-center gap-2">
      <Form.Label className="mb-0" style={LABEL_STYLE}>
        {label}
      </Form.Label>
      <div className="d-flex align-items-center gap-1 flex-wrap flex-sm-nowrap">
        <span className="small text-muted">From</span>
        <Form.Control
          size="sm"
          type="number"
          min={min}
          max={max}
          style={{ width: 76 }}
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
          style={{ width: 76 }}
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
    </div>
  );
}

function PlayerRowView({
  row,
  onOpen,
}: {
  row: PlayerRow;
  onOpen: () => void;
}) {
  const rank = rankForElo(row.elo);
  return (
    <tr role="button" style={{ cursor: 'pointer' }} onClick={onOpen}>
      <td>
        <div className="d-flex align-items-center gap-2">
          <img src={`/ranks/${rank.image}.svg`} width={24} height={24} alt="" />
          {row.username}
        </div>
      </td>
      <td>{rank.name}</td>
      <td>{row.elo}</td>
      <td>{row.gamesPlayed}</td>
    </tr>
  );
}

function Players() {
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [eloMin, setEloMin] = useState(ELO_MIN);
  const [eloMax, setEloMax] = useState(ELO_MAX);
  const [gamesMin, setGamesMin] = useState(GAMES_MIN);
  const [gamesMax, setGamesMax] = useState(GAMES_MAX);
  const [sortOption, setSortOption] = useState<SortOption>('highestElo');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PlayersPage | null>(null);

  const eloNarrowed = eloMin !== ELO_MIN || eloMax !== ELO_MAX;
  const gamesNarrowed = gamesMin !== GAMES_MIN || gamesMax !== GAMES_MAX;
  const filterKey = JSON.stringify({
    username,
    eloMin,
    eloMax,
    gamesMin,
    gamesMax,
  });

  useEffect(() => {
    let stale = false;
    const { sort, sortDir } = SORT_TO_QUERY[sortOption];
    const query: PlayersQuery = {
      page,
      pageSize: PAGE_SIZE,
      username: username || undefined,
      eloMin: eloNarrowed ? eloMin : undefined,
      eloMax: eloNarrowed ? eloMax : undefined,
      gamesMin: gamesNarrowed ? gamesMin : undefined,
      gamesMax: gamesNarrowed ? gamesMax : undefined,
      sort,
      sortDir,
    };
    connector.listPlayers(query, (r) => {
      if (!stale) setResult(r);
    });
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterKey, sortOption]);

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / PAGE_SIZE))
    : 1;
  const rows = result?.players ?? [];
  const nothing = result !== null && rows.length === 0;

  function clearFilters() {
    setUsername('');
    setEloMin(ELO_MIN);
    setEloMax(ELO_MAX);
    setGamesMin(GAMES_MIN);
    setGamesMax(GAMES_MAX);
    setPage(1);
  }

  return (
    <Container fluid className="py-5 px-2 px-sm-4">
      <h1 className="text-center mb-4">Players</h1>

      <Form
        className="d-flex flex-wrap align-items-end justify-content-center row-gap-3 column-gap-3 mb-3"
        onSubmit={(e) => e.preventDefault()}
      >
        <Form.Group className="d-flex align-items-center gap-2">
          <Form.Label className="mb-0 small">Sort</Form.Label>
          <Form.Select
            size="sm"
            className="w-auto"
            value={sortOption}
            onChange={(e) =>
              resetPage(setSortOption)(e.target.value as SortOption)
            }
          >
            <option value="highestElo">Highest elo</option>
            <option value="lowestElo">Lowest elo</option>
            <option value="nameAsc">Name A-Z</option>
            <option value="nameDesc">Name Z-A</option>
            <option value="mostGames">Most games</option>
            <option value="fewestGames">Fewest games</option>
          </Form.Select>
        </Form.Group>
      </Form>

      <details
        className="mb-3"
        onToggle={(e) => {
          playSound('click');
          setFiltersOpen(e.currentTarget.open);
        }}
      >
        <summary className="fw-bold py-2 position-relative">
          Filters
          {filtersOpen && (
            <Button
              size="sm"
              variant="outline-secondary"
              className="position-absolute top-50 end-0 translate-middle-y"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                clearFilters();
              }}
            >
              Clear filters
            </Button>
          )}
        </summary>
        <div className="border rounded p-2 mb-2">
          <div className="row g-3">
            <Field label="Username">
              <Form.Control
                size="sm"
                style={{ width: '10ch' }}
                maxLength={10}
                value={username}
                onChange={(e) => resetPage(setUsername)(e.target.value)}
              />
            </Field>
            <RangeField
              label="Elo"
              min={ELO_MIN}
              max={ELO_MAX}
              lo={eloMin}
              hi={eloMax}
              fallbackLo={ELO_MIN}
              fallbackHi={ELO_MAX}
              setLo={resetPage(setEloMin)}
              setHi={resetPage(setEloMax)}
            />
            <RangeField
              label="Games played"
              min={GAMES_MIN}
              max={GAMES_MAX}
              lo={gamesMin}
              hi={gamesMax}
              fallbackLo={GAMES_MIN}
              fallbackHi={GAMES_MAX}
              setLo={resetPage(setGamesMin)}
              setHi={resetPage(setGamesMax)}
            />
          </div>
        </div>
      </details>

      {result === null ? (
        <div className="text-center">
          <Spinner size="sm" className="me-2" />
          Loading...
        </div>
      ) : nothing ? (
        <p className="text-center text-muted">No players match.</p>
      ) : (
        <>
          <div className="table-responsive">
            <Table striped hover className="align-middle">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Rank</th>
                  <th>Elo</th>
                  <th>Games</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <PlayerRowView
                    key={row.id}
                    row={row}
                    onOpen={() =>
                      navigate(`/players/${encodeURIComponent(row.username)}`)
                    }
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
              Page {page} of {totalPages} ({result.total} players)
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

export default Players;
