import { useEffect, useState } from 'react';
import { Button, Form, ListGroup } from 'react-bootstrap';
import { titleCase } from '../../../lobby/settings/gameSettings';
import {
  loadGazetteer,
  randomPlace,
  searchPlaces,
  type GazetteerIndex,
  type GazetteerPlace,
} from './gazetteer';

interface Props {
  initialQuery: string;
  onSelect: (place: GazetteerPlace) => void;
}

function SearchBox({ initialQuery, onSelect }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [index, setIndex] = useState<GazetteerIndex | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    loadGazetteer()
      .then(setIndex)
      .catch(() => setFailed(true));
  }, []);

  const results = index && open ? searchPlaces(index, query) : [];

  function choose(place: GazetteerPlace) {
    setQuery(place.name);
    setOpen(false);
    onSelect(place);
  }

  function chooseRandom() {
    const place = index && randomPlace(index);
    if (place) choose(place);
  }

  return (
    <div className="position-relative">
      <Form.Control
        size="sm"
        value={query}
        placeholder={
          failed
            ? 'Search unavailable'
            : index
              ? 'Search a country, region or city'
              : 'Loading places…'
        }
        disabled={failed}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && results[active]) {
            e.preventDefault();
            choose(results[active]);
          } else if (e.key === 'Escape') {
            e.stopPropagation();
            setOpen(false);
          }
        }}
      />
      {results.length > 0 && (
        <ListGroup className="position-absolute w-100 shadow z-3">
          {results.map((place, i) => (
            <ListGroup.Item
              key={`${place.kind}:${place.name}:${place.context}:${i}`}
              action
              active={i === active}
              className="py-1 small"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(place)}
            >
              <div className="fw-semibold">{place.name}</div>
              <div className="text-muted small">
                {[titleCase(place.kind), place.context]
                  .filter(
                    (part, i, parts) =>
                      part &&
                      parts.findIndex(
                        (p) => p.toLowerCase() === part.toLowerCase(),
                      ) === i,
                  )
                  .join(' · ')}
              </div>
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}
      <Button
        variant="secondary"
        size="sm"
        className="w-100 mt-2"
        disabled={!index}
        onClick={chooseRandom}
      >
        Random location
      </Button>
    </div>
  );
}

export default SearchBox;
