import { useEffect, useRef, useState } from 'react';
import { Badge, Form, ListGroup } from 'react-bootstrap';

export interface SearchSelectItem {
  id: string;
  label: string;
}

interface Props {
  label: string;
  placeholder: string;
  inputWidth?: string;
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
  inputWidth,
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
    <div
      ref={containerRef}
      className="d-flex align-items-center gap-2 flex-wrap"
    >
      <Form.Label className="mb-0 small flex-shrink-0">{label}</Form.Label>
      <div
        className="position-relative flex-grow-1"
        style={inputWidth ? { maxWidth: inputWidth } : undefined}
      >
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
  );
}

export default SearchMultiSelect;
