import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Button, Form, Spinner, Table } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import {
  Field,
  FilterDetails,
  ListPager,
  RangeField,
  SortSelect,
} from '../common/filterControls';
import { useWhiteIcon } from '../common/icon';
import { connector } from '../connector';
import type {
  Account,
  Fill,
  GenerationType,
  MapSize,
  PlayerMapRow,
  PlayerMapSort,
  PlayerMapsPage,
  PlayerMapsQuery,
} from '../lib/types';
import { mapImageUrl } from './mapUrl';

const PAGE_SIZE = 24;
const TERR_MIN = 0;
const TERR_MAX = 500;

type OwnerFilter = '' | 'mine' | 'notMine';
type LikeFilter = '' | 'liked' | 'notLiked';

interface Props {
  account: Account | null;
  mode: 'browse' | 'mine' | 'pick';
  authorId?: string;
  onRowClick?: (row: PlayerMapRow) => void;
  rowActions?: (row: PlayerMapRow) => ReactNode;
  footerRow?: ReactNode;
  reloadKey?: number;
}

function MapBrowser({
  account,
  mode,
  authorId,
  onRowClick,
  rowActions,
  footerRow,
  reloadKey,
}: Props) {
  const navigate = useNavigate();
  const whiteHeartFull = useWhiteIcon('/icons/heart_full.svg');
  const whiteHeartEmpty = useWhiteIcon('/icons/heart_empty.svg');
  const [q, setQ] = useState('');
  const [owner, setOwner] = useState<OwnerFilter>('');
  const [like, setLike] = useState<LikeFilter>('');
  const [terrMin, setTerrMin] = useState(TERR_MIN);
  const [terrMax, setTerrMax] = useState(TERR_MAX);
  const [genType, setGenType] = useState<GenerationType | ''>('');
  const [genFill, setGenFill] = useState<Fill | ''>('');
  const [genSize, setGenSize] = useState<MapSize | ''>('');
  const [sort, setSort] = useState<PlayerMapSort>('mostLiked');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PlayerMapsPage | null>(null);
  const [rows, setRows] = useState<PlayerMapRow[]>([]);

  const terrNarrowed = terrMin !== TERR_MIN || terrMax !== TERR_MAX;
  const filterKey = JSON.stringify({
    q,
    owner,
    like,
    terrMin,
    terrMax,
    genType,
    genFill,
    genSize,
  });

  useEffect(() => {
    let stale = false;
    const query: PlayerMapsQuery = {
      page,
      pageSize: PAGE_SIZE,
      q: q.trim() || undefined,
      authorId,
      mine: mode === 'mine' || owner === 'mine' || undefined,
      notMine: mode !== 'mine' && owner === 'notMine' ? true : undefined,
      liked: like === 'liked' || undefined,
      notLiked: like === 'notLiked' || undefined,
      territoryMin: terrNarrowed ? terrMin : undefined,
      territoryMax: terrNarrowed ? terrMax : undefined,
      generationType: genType || undefined,
      generationFill: genFill || undefined,
      generationSize: genSize || undefined,
      sort,
    };
    connector.listPlayerMaps(query, (r) => {
      if (stale) return;
      setResult(r);
      setRows(r.maps);
      const lastPage = Math.max(1, Math.ceil(r.total / PAGE_SIZE));
      if (page > lastPage) setPage(lastPage);
    });
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterKey, sort, mode, authorId, reloadKey]);

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  function toggleLike(row: PlayerMapRow) {
    if (!account) return;
    const next = !row.liked;
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id
          ? { ...r, liked: next, likeCount: r.likeCount + (next ? 1 : -1) }
          : r,
      ),
    );
    connector.likeMap(row.id, next, (res) => {
      if (res.ok) return;
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? { ...r, liked: !next, likeCount: r.likeCount + (next ? -1 : 1) }
            : r,
        ),
      );
    });
  }

  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / PAGE_SIZE))
    : 1;
  const nothing = result !== null && rows.length === 0;
  const showAuthor = mode === 'browse' && !authorId;
  const actionsCol = !!rowActions || mode === 'pick';
  const colCount = 5 + (showAuthor ? 1 : 0) + (actionsCol ? 1 : 0);

  function clearFilters() {
    setQ('');
    setOwner('');
    setLike('');
    setTerrMin(TERR_MIN);
    setTerrMax(TERR_MAX);
    setGenType('');
    setGenFill('');
    setGenSize('');
    setPage(1);
  }

  return (
    <>
      <SortSelect
        value={sort}
        onChange={(v) => resetPage(setSort)(v as PlayerMapSort)}
      >
        <option value="mostLiked">Most liked</option>
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
        <option value="nameAsc">Name A-Z</option>
        <option value="nameDesc">Name Z-A</option>
      </SortSelect>

      <FilterDetails onClear={clearFilters}>
        <div className="border rounded p-2 mb-2">
          <div className="row g-3">
            <Field label="Search">
              <Form.Control
                size="sm"
                style={{ width: 180 }}
                placeholder="Name or author"
                maxLength={60}
                value={q}
                onChange={(e) => resetPage(setQ)(e.target.value)}
              />
            </Field>
            <RangeField
              label="Territories"
              min={TERR_MIN}
              max={TERR_MAX}
              lo={terrMin}
              hi={terrMax}
              fallbackLo={TERR_MIN}
              fallbackHi={TERR_MAX}
              setLo={resetPage(setTerrMin)}
              setHi={resetPage(setTerrMax)}
            />
            {account && mode !== 'mine' && !authorId && (
              <Field label="Owner">
                <Form.Select
                  size="sm"
                  className="w-auto"
                  value={owner}
                  onChange={(e) =>
                    resetPage(setOwner)(e.target.value as OwnerFilter)
                  }
                >
                  <option value="">Anyone</option>
                  <option value="mine">My maps</option>
                  <option value="notMine">Not my maps</option>
                </Form.Select>
              </Field>
            )}
            {account && (
              <Field label="Likes">
                <Form.Select
                  size="sm"
                  className="w-auto"
                  value={like}
                  onChange={(e) =>
                    resetPage(setLike)(e.target.value as LikeFilter)
                  }
                >
                  <option value="">Any</option>
                  <option value="liked">Liked</option>
                  <option value="notLiked">Not liked</option>
                </Form.Select>
              </Field>
            )}
            <Field label="Generated type">
              <Form.Select
                size="sm"
                className="w-auto"
                value={genType}
                onChange={(e) =>
                  resetPage(setGenType)(e.target.value as GenerationType | '')
                }
              >
                <option value="">Any</option>
                <option value="terrain">Terrain</option>
                <option value="dungeon">Dungeon</option>
                <option value="temple">Temple</option>
              </Form.Select>
            </Field>
            <Field label="Generated fill">
              <Form.Select
                size="sm"
                className="w-auto"
                value={genFill}
                onChange={(e) =>
                  resetPage(setGenFill)(e.target.value as Fill | '')
                }
              >
                <option value="">Any</option>
                <option value="full">Full</option>
                <option value="mixed">Mixed</option>
                <option value="sparse">Sparse</option>
              </Form.Select>
            </Field>
            <Field label="Generated size">
              <Form.Select
                size="sm"
                className="w-auto"
                value={genSize}
                onChange={(e) =>
                  resetPage(setGenSize)(e.target.value as MapSize | '')
                }
              >
                <option value="">Any</option>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
                <option value="xlarge">Extra Large</option>
              </Form.Select>
            </Field>
          </div>
        </div>
      </FilterDetails>

      {result === null ? (
        <div className="text-center">
          <Spinner size="sm" className="me-2" />
          Loading...
        </div>
      ) : nothing && !footerRow ? (
        <p className="text-center text-muted">No maps match.</p>
      ) : (
        <>
          <div className="table-responsive">
            <Table striped hover className="align-middle">
              <thead>
                <tr>
                  <th></th>
                  <th>Name</th>
                  {showAuthor && <th>Author</th>}
                  <th>Territories</th>
                  <th>Continents</th>
                  <th>Likes</th>
                  {actionsCol && <th></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    role={onRowClick ? 'button' : undefined}
                    style={onRowClick ? { cursor: 'pointer' } : undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    <td>
                      <img
                        src={mapImageUrl(row.id)}
                        alt=""
                        width={64}
                        height={36}
                        className="rounded border"
                        style={{ objectFit: 'cover' }}
                      />
                    </td>
                    <td>
                      {row.name}
                      {row.dangerous && (
                        <span className="badge bg-danger ms-2">flagged</span>
                      )}
                    </td>
                    {showAuthor && (
                      <td>
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(
                              `/players/${encodeURIComponent(row.authorName)}`,
                            );
                          }}
                        >
                          {row.authorName}
                        </Button>
                      </td>
                    )}
                    <td>{row.territoryCount}</td>
                    <td>{row.continentCount}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm p-0 text-white d-inline-flex align-items-center gap-1"
                        disabled={!account}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLike(row);
                        }}
                      >
                        <img
                          src={
                            row.liked
                              ? (whiteHeartFull ?? '/icons/heart_full.svg')
                              : (whiteHeartEmpty ?? '/icons/heart_empty.svg')
                          }
                          width={14}
                          height={14}
                          alt={row.liked ? 'Liked' : 'Like'}
                        />
                        {row.likeCount}
                      </button>
                    </td>
                    {actionsCol && (
                      <td
                        className="text-end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {mode === 'pick' && onRowClick ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => onRowClick(row)}
                          >
                            Select
                          </button>
                        ) : (
                          rowActions?.(row)
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {footerRow && (
                  <tr>
                    <td colSpan={colCount} className="text-center align-middle">
                      {footerRow}
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>

          <ListPager
            page={page}
            totalPages={totalPages}
            total={result.total}
            noun="maps"
            onChange={setPage}
          />
        </>
      )}
    </>
  );
}

export default MapBrowser;
