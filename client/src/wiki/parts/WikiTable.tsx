import type { ReactNode } from 'react';
import { Table } from 'react-bootstrap';

interface Props {
  head: string[];
  rows: ReactNode[][];
}

function WikiTable({ head, rows }: Props) {
  return (
    <div className="table-responsive mb-3">
      <Table striped size="sm" className="align-middle mb-0">
        <thead>
          <tr>
            {head.map((label) => (
              <th key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className={j === 0 ? 'fw-semibold' : undefined}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export default WikiTable;
