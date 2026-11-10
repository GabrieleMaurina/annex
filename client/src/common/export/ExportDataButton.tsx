import { useState } from 'react';
import { Dropdown, Spinner } from 'react-bootstrap';
import type { ExportCallback } from '../../lib/types';
import { formatError } from '../formatError';
import type { ExportFormat } from './exportFiles';
import { downloadExport } from './exportFiles';

const MENU_POPPER = { strategy: 'fixed' as const };

const FORMATS: [ExportFormat, string][] = [
  ['json', 'JSON (one file)'],
  ['csv', 'CSV (zip of files)'],
];

interface Props {
  name: string;
  load: (cb: ExportCallback) => void;
}

function ExportDataButton({ name, load }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function exportAs(format: ExportFormat) {
    setLoading(true);
    setError('');
    load((data, loadError) => {
      setLoading(false);
      if (data) downloadExport(data, format, name);
      else setError(loadError ?? 'export failed');
    });
  }

  return (
    <div className="d-flex flex-column align-items-center">
      <Dropdown onSelect={(key) => exportAs(key === 'csv' ? 'csv' : 'json')}>
        <Dropdown.Toggle variant="secondary" disabled={loading}>
          {loading && <Spinner size="sm" className="me-2" />}
          Export Data
        </Dropdown.Toggle>
        <Dropdown.Menu className="selector-menu" popperConfig={MENU_POPPER}>
          {FORMATS.map(([format, label]) => (
            <Dropdown.Item
              key={format}
              as="button"
              eventKey={format}
              className="selector-option text-nowrap"
            >
              {label}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
      {error && (
        <div className="text-danger small mt-1">{formatError(error)}</div>
      )}
    </div>
  );
}

export default ExportDataButton;
