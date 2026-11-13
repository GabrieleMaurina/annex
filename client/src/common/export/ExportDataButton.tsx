import { useState } from 'react';
import { Dropdown, Spinner } from 'react-bootstrap';
import type { ExportCallback } from '../../lib/types';
import { formatError } from '../formatError';
import WhiteIcon from '../icons/WhiteIcon';
import Tip from '../tooltips/Tip';
import type { ExportFormat } from './exportFiles';
import { downloadExport } from './exportFiles';

const MENU_POPPER = { strategy: 'fixed' as const };

const FORMATS: [ExportFormat, string, string][] = [
  ['json', 'JSON (one file)', '/icons/logs.svg'],
  ['csv', 'CSV (zip of files)', '/icons/table.svg'],
];

interface Props {
  name: string;
  tooltip: string;
  load: (cb: ExportCallback) => void;
}

function ExportDataButton({ name, tooltip, load }: Props) {
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
        <Tip text={tooltip}>
          <Dropdown.Toggle
            variant="secondary"
            className="d-inline-flex align-items-center justify-content-center gap-1"
            disabled={loading}
          >
            {loading ? (
              <Spinner size="sm" />
            ) : (
              <WhiteIcon path="/icons/download.svg" />
            )}
            Export Data
          </Dropdown.Toggle>
        </Tip>
        <Dropdown.Menu className="selector-menu" popperConfig={MENU_POPPER}>
          {FORMATS.map(([format, label, icon]) => (
            <Dropdown.Item
              key={format}
              as="button"
              eventKey={format}
              className="selector-option text-nowrap"
            >
              <WhiteIcon path={icon} />
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
