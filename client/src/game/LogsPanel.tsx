import { Table } from 'react-bootstrap';
import { PANEL_BG_CLASS, PANEL_CLASS } from '../common/panelStyle';
import { contrastTextColor } from '../lib/palette';

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

function LogText({ text }: { text: string }) {
  const spaceIndex = text.indexOf(' ');
  if (spaceIndex === -1) return <strong>{text}</strong>;
  return (
    <>
      <strong>{text.slice(0, spaceIndex)}</strong>
      {text.slice(spaceIndex)}
    </>
  );
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
