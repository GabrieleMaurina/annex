import { useEffect, useRef, useState } from 'react';
import { Badge, Form, ListGroup } from 'react-bootstrap';
import { FIELD_LABEL_CLASS } from '../../ui/containers/panelStyle';

export interface SearchSelectItem {
  id: string;
  label: string;
}

interface Props {
  label: string;
  placeholder: string;
  maxLength?: number;
  maxSelected?: number;
  search: (query: string, cb: (items: SearchSelectItem[]) => void) => void;
  selected: SearchSelectItem[];
  onChange: (selected: SearchSelectItem[]) => void;
}

const DEBOUNCE_MS = 300;

function SearchMultiSelect({
  label,
  placeholder,
  maxLength,
  maxSelected,
  search,
  selected,
  onChange,
}: Props) {
  const [text, setText] = useState('');
  const [rawSuggestions, setRawSuggestions] = useState<SearchSelectItem[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const atLimit = maxSelected !== undefined && selected.length >= maxSelected;

  useEffect(() => {
    const query = text.trim();
    if (!query || atLimit) return;
    const selectedIds = new Set(selected.map((item) => item.id));
    const timer = setTimeout(() => {
      search(query, (items) => {
        setRawSuggestions(items.filter((item) => !selectedIds.has(item.id)));
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, search, selected, atLimit]);

  const suggestions = text.trim() ? rawSuggestions : [];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  function pick(item: SearchSelectItem) {
    onChange([...selected, item]);
    setText('');
    setRawSuggestions([]);
    setOpen(false);
  }

  function remove(id: string) {
    onChange(selected.filter((item) => item.id !== id));
  }

  return (
    <div ref={containerRef}>
      <Form.Label className={FIELD_LABEL_CLASS}>{label}</Form.Label>
      <div className="position-relative">
        <Form.Control
          size="sm"
          placeholder={atLimit ? 'Limit reached' : placeholder}
          maxLength={maxLength}
          value={text}
          disabled={atLimit}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {!atLimit && open && suggestions.length > 0 && (
          <ListGroup
            className="position-absolute shadow-sm"
            style={{ zIndex: 10, minWidth: 200, width: '100%' }}
          >
            {suggestions.map((item) => (
              <ListGroup.Item key={item.id} action onClick={() => pick(item)}>
                {item.label}
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
      </div>
      {selected.length > 0 && (
        <div className="d-flex flex-wrap gap-1 mt-1">
          {selected.map((item) => (
            <Badge
              key={item.id}
              bg="secondary"
              className="d-inline-flex align-items-center gap-1"
            >
              {item.label}
              <button
                type="button"
                className="btn-close btn-close-white"
                style={{ fontSize: '0.55em' }}
                aria-label="Remove"
                onClick={() => remove(item.id)}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default SearchMultiSelect;
