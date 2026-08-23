import type { ReactNode } from 'react';
import { Table } from 'react-bootstrap';
import { PANEL_BG_CLASS, PANEL_CLASS } from '../../common/panelStyle';
import { contrastTextColor } from '../../lib/palette';

interface LogEntry {
  id: number;
  color: string;
  text: string;
}

interface Props {
  logs: LogEntry[];
  top: number;
  onClose: () => void;
}

const BOTTOM_MARGIN = 72;

function boldRanges(text: string): [number, number][] {
  const spaceIndex = text.indexOf(' ');
  const ranges: [number, number][] = [
    [0, spaceIndex === -1 ? text.length : spaceIndex],
  ];
  const numberRegex = /\d+/g;
  let match: RegExpExecArray | null;
  while ((match = numberRegex.exec(text)))
    ranges.push([match.index, match.index + match[0].length]);
  ranges.sort((a, b) => a[0] - b[0]);

  const merged: [number, number][] = [];
  for (const [start, end] of ranges) {
    const last = merged.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

function LogText({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const [start, end] of boldRanges(text)) {
    if (start > cursor) nodes.push(text.slice(cursor, start));
    nodes.push(<strong key={start}>{text.slice(start, end)}</strong>);
    cursor = end;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <>{nodes}</>;
}

function LogsPanel({ logs, top, onClose }: Props) {
  const newestFirst = [...logs].reverse();

  return (
    <div
      className={`${PANEL_BG_CLASS} ${PANEL_CLASS} d-flex flex-column`}
      style={{
        width: 640,
        maxHeight: `calc(100vh - ${top}px - ${BOTTOM_MARGIN}px)`,
      }}
    >
      <div
        className="fw-bold lh-1 mb-2 flex-shrink-0"
        role="button"
        tabIndex={0}
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
            onClose();
          }
        }}
        style={{ cursor: 'pointer' }}
      >
        Logs
      </div>
      {newestFirst.length === 0 ? (
        <div className="text-muted small">No actions yet</div>
      ) : (
        <div
          className="no-scrollbar"
          style={{ overflowY: 'auto', minHeight: 0 }}
          onWheel={(e) => e.stopPropagation()}
        >
          <Table size="sm" bordered className="mb-0" style={{ width: '100%' }}>
            <tbody>
              {newestFirst.map((log) => (
                <tr key={log.id}>
                  <td
                    className="small text-nowrap"
                    style={{
                      backgroundColor: log.color,
                      color: contrastTextColor(log.color),
                    }}
                  >
                    • <LogText text={log.text} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default LogsPanel;
