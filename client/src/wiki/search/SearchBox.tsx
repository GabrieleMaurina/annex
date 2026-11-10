import { useMemo, useState } from 'react';
import { Form, ListGroup } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import {
  loadSearchIndex,
  search,
  type SearchEntry,
  type SearchResult,
} from './searchIndex';

function SearchBox() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);
  const results = useMemo(
    () => (entries ? search(entries, query) : []),
    [entries, query],
  );
  const showing = open && query.trim() !== '';

  function load() {
    setFailed(false);
    loadSearchIndex()
      .then(setEntries)
      .catch(() => setFailed(true));
  }

  function choose(result: SearchResult) {
    const { pageId, anchor } = result.entry;
    setQuery('');
    navigate(`/wiki/${pageId}${anchor ? `#${anchor}` : ''}`);
  }

  function handleKeyDown(key: string) {
    if (key === 'Escape') setQuery('');
    else if (key === 'Enter' && showing && results[0]) choose(results[0]);
  }

  return (
    <div className="position-relative">
      <Form.Control
        type="search"
        size="sm"
        placeholder="Search the wiki"
        aria-label="Search the wiki"
        value={query}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (!entries) load();
        }}
        onKeyDown={(e) => handleKeyDown(e.key)}
      />
      <div className="visually-hidden" aria-live="polite">
        {showing && entries !== null && `${results.length} results`}
      </div>
      {showing && (
        <ListGroup className="position-absolute w-100 mt-1 z-3 shadow">
          {failed && (
            <ListGroup.Item className="text-body-secondary">
              Search unavailable. Keep typing to try again.
            </ListGroup.Item>
          )}
          {!failed && entries === null && (
            <ListGroup.Item className="text-body-secondary">
              Loading...
            </ListGroup.Item>
          )}
          {entries !== null && results.length === 0 && (
            <ListGroup.Item className="text-body-secondary">
              No matches.
            </ListGroup.Item>
          )}
          {results.map((result) => (
            <ListGroup.Item
              key={`${result.entry.pageId}#${result.entry.anchor}`}
              action
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(result)}
            >
              <div className="fw-semibold">
                {result.entry.pageTitle}
                {result.entry.heading && ` › ${result.entry.heading}`}
              </div>
              <div className="small text-body-secondary">{result.snippet}</div>
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}
    </div>
  );
}

export default SearchBox;
