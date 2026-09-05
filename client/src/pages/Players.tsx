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
import { connector } from '../connector';
import { rankForElo } from '../lib/ranks';
import type { PlayerRow, PlayersPage, PlayersQuery } from '../lib/types';

const PAGE_SIZE = 20;

const ELO_MIN = 0;
const ELO_MAX = 3100;
const GAMES_MIN = 0;
const GAMES_MAX = 10000;

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

      <SortSelect
        value={sortOption}
        onChange={(v) => resetPage(setSortOption)(v as SortOption)}
      >
        <option value="highestElo">Highest elo</option>
        <option value="lowestElo">Lowest elo</option>
        <option value="nameAsc">Name A-Z</option>
        <option value="nameDesc">Name Z-A</option>
        <option value="mostGames">Most games</option>
        <option value="fewestGames">Fewest games</option>
      </SortSelect>

      <FilterDetails onClear={clearFilters}>
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
      </FilterDetails>

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

          <ListPager
            page={page}
            totalPages={totalPages}
            total={result.total}
            noun="players"
            onChange={setPage}
          />
        </>
      )}
    </Container>
  );
}

export default Players;
