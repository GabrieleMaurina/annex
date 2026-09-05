import type { ReactNode } from 'react';
import { Table } from 'react-bootstrap';
import { useWhiteIcon } from '../../common/icon';
import PanelHeader from '../../common/PanelHeader';
import { PANEL_BG_CLASS, PANEL_CLASS } from '../../common/panelStyle';
import { contrastTextColor } from '../../lib/palette';
import type { LogColorRange } from '../logFormat';

interface LogEntry {
  id: number;
  color: string;
  text: string;
  colorRanges?: LogColorRange[];
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
  const numberRegex = /(?<![A-Za-z])\d+(?![A-Za-z])/g;
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

function logNodes(
  text: string,
  colorRanges: LogColorRange[] = [],
  whiteBotIcon: string | undefined,
  rowForeground: string,
): ReactNode[] {
  const bold = boldRanges(text);
  const badgeRanges = colorRanges.filter((r) => r.badge);
  const isInteriorToBadge = (point: number) =>
    badgeRanges.some((r) => point > r.start && point < r.end);
  const boundaries = [
    ...new Set([
      0,
      text.length,
      ...bold.flat().filter((point) => !isInteriorToBadge(point)),
      ...colorRanges.flatMap((r) => [r.start, r.end]),
    ]),
  ].sort((a, b) => a - b);

  const botIcon = (fg: string) => (
    <img
      src={
        fg === '#ffffff' ? (whiteBotIcon ?? '/icons/bot.svg') : '/icons/bot.svg'
      }
      width={12}
      height={12}
      alt="Bot"
    />
  );

  const nodes: ReactNode[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    if (start === end) continue;
    const piece = text.slice(start, end);
    const isBold = bold.some(([bs, be]) => start >= bs && end <= be);
    const colorRange = colorRanges.find(
      (r) => start >= r.start && end <= r.end,
    );

    if (colorRange?.badge) {
      const fg = contrastTextColor(colorRange.color!);
      nodes.push(
        <span
          key={start}
          className="badge d-inline-flex align-items-center gap-1"
          style={{ backgroundColor: colorRange.color, color: fg }}
        >
          {isBold ? <strong>{piece}</strong> : piece}
          {colorRange.isBot && botIcon(fg)}
        </span>,
      );
    } else if (colorRange?.color) {
      nodes.push(
        <span
          key={start}
          className="d-inline-flex align-items-center gap-1"
          style={{ color: colorRange.color }}
        >
          {isBold ? <strong>{piece}</strong> : piece}
          {colorRange.isBot && botIcon(rowForeground)}
        </span>,
      );
    } else if (colorRange?.isBot) {
      nodes.push(
        <span key={start} className="d-inline-flex align-items-center gap-1">
          {isBold ? <strong>{piece}</strong> : piece}
          {botIcon(rowForeground)}
        </span>,
      );
    } else if (isBold) {
      nodes.push(<strong key={start}>{piece}</strong>);
    } else {
      nodes.push(piece);
    }
  }
  return nodes;
}

function LogText({
  text,
  colorRanges,
  whiteBotIcon,
  rowForeground,
}: {
  text: string;
  colorRanges?: LogColorRange[];
  whiteBotIcon: string | undefined;
  rowForeground: string;
}) {
  return <>{logNodes(text, colorRanges, whiteBotIcon, rowForeground)}</>;
}

function LogsPanel({ logs, top, onClose }: Props) {
  const newestFirst = [...logs].reverse();
  const whiteBotIcon = useWhiteIcon('/icons/bot.svg');

  return (
    <div
      className={`${PANEL_BG_CLASS} ${PANEL_CLASS} d-flex flex-column`}
      style={{
        width: 820,
        maxHeight: `calc(100vh - ${top}px - ${BOTTOM_MARGIN}px)`,
      }}
    >
      <PanelHeader title="Logs" onClose={onClose} />
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
              {newestFirst.map((log) => {
                const rowForeground = contrastTextColor(log.color);
                return (
                  <tr key={log.id}>
                    <td
                      className="small text-nowrap"
                      style={{
                        backgroundColor: log.color,
                        color: rowForeground,
                      }}
                    >
                      •{' '}
                      <LogText
                        text={log.text}
                        colorRanges={log.colorRanges}
                        whiteBotIcon={whiteBotIcon}
                        rowForeground={rowForeground}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default LogsPanel;
