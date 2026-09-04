import { Badge, Table } from 'react-bootstrap';
import { contrastTextColor, playerColor } from '../lib/palette';
import type { GameState } from '../lib/types';
import { useWhiteIcon } from './icon';
import Tip from './Tip';

export interface ResultRow {
  troopsGained: number;
  troopsKilled: number;
  troopsLost: number;
  territoriesConquered: number;
  territoriesLost: number;
  capitalsConquered: number;
  capitalsLost: number;
  cardsGained: number;
  turnsPlayed: number;
  setsPlayed: number;
}

const EMPTY_ROW: ResultRow = {
  troopsGained: 0,
  troopsKilled: 0,
  troopsLost: 0,
  territoriesConquered: 0,
  territoriesLost: 0,
  capitalsConquered: 0,
  capitalsLost: 0,
  cardsGained: 0,
  turnsPlayed: 0,
  setsPlayed: 0,
};

interface Props {
  players: GameState['players'];
  ranking: number[];
  results: Map<number, ResultRow> | null;
  originalHostId: number;
  roundNumber: number;
  isCapitals: boolean;
  selfId: number | null;
  showYouLabel?: boolean;
  rowRef?: (playerId: number) => (el: HTMLTableRowElement | null) => void;
  nameRef?: (playerId: number) => (el: HTMLDivElement | null) => void;
  onRowClick?: (playerId: number) => void;
  rowClickable?: (player: GameState['players'][number]) => boolean;
}

function ResultsTable({
  players,
  ranking,
  results,
  originalHostId,
  roundNumber,
  isCapitals,
  selfId,
  showYouLabel = false,
  rowRef,
  nameRef,
  onRowClick,
  rowClickable,
}: Props) {
  const whiteBotIcon = useWhiteIcon('/icons/bot.svg');
  const whiteDeathIcon = useWhiteIcon('/icons/death.svg');
  const whiteNoWifiIcon = useWhiteIcon('/icons/no-wifi.svg');
  const whiteFlagIcon = useWhiteIcon('/icons/flag.svg');

  const playerById = new Map(players.map((p) => [p.id, p]));
  const rankedPlayers = ranking
    .map((id) => playerById.get(id))
    .filter((p): p is GameState['players'][number] => !!p);
  const nameById = new Map(players.map((p) => [p.id, p.name]));

  return (
    <div className="table-responsive">
      <Table size="sm" borderless className="mb-0 text-center align-middle">
        <thead>
          <tr>
            <th>#</th>
            <th className="text-start">Player</th>
            <th>Turns</th>
            <th>Players Killed</th>
            <th>Troops Gained</th>
            <th>Troops Killed</th>
            <th>Troops Lost</th>
            <th>Territories Conquered</th>
            <th>Territories Lost</th>
            {isCapitals && <th>Capitals Conquered</th>}
            {isCapitals && <th>Capitals Lost</th>}
            <th>Cards Gained</th>
            <th>Sets Played</th>
          </tr>
        </thead>
        <tbody>
          {rankedPlayers.map((p, index) => {
            const bg = playerColor(p.color);
            const fg = contrastTextColor(bg);
            const clickable = rowClickable ? rowClickable(p) : false;
            const rowStyle = {
              backgroundColor: bg,
              color: fg,
              cursor: clickable ? 'pointer' : 'default',
            };
            const isDark = fg === '#ffffff';
            const rowIcon = (white: string | undefined, path: string) =>
              isDark ? (white ?? path) : path;
            const killedNames = p.playersKilled
              .map((id) => nameById.get(id) ?? '?')
              .join(', ');
            const stats = results?.get(p.id) ?? EMPTY_ROW;
            return (
              <tr
                key={p.id}
                ref={rowRef?.(p.id)}
                role={clickable ? 'button' : undefined}
                data-no-click-sound
                onClick={clickable ? () => onRowClick?.(p.id) : undefined}
                style={{
                  outline: p.id === selfId ? '2px solid #fff' : undefined,
                  outlineOffset: p.id === selfId ? '-2px' : undefined,
                }}
              >
                <td style={rowStyle}>{index + 1}</td>
                <td className="text-start" style={rowStyle}>
                  <div
                    ref={nameRef?.(p.id)}
                    className="d-inline-flex align-items-center gap-1"
                  >
                    <span className="text-truncate" style={{ minWidth: 0 }}>
                      {p.id === selfId && showYouLabel ? 'You' : p.name}
                    </span>
                    {p.isBot && (
                      <img
                        src={rowIcon(whiteBotIcon, '/icons/bot.svg')}
                        width={12}
                        height={12}
                        alt="Bot"
                        className="flex-shrink-0"
                      />
                    )}
                    {p.id === originalHostId && (
                      <Badge bg="primary" className="flex-shrink-0">
                        Host
                      </Badge>
                    )}
                    {p.eliminated && (
                      <Tip text="Eliminated">
                        <img
                          src={rowIcon(whiteDeathIcon, '/icons/death.svg')}
                          width={12}
                          height={12}
                          alt="Eliminated"
                          className="flex-shrink-0"
                        />
                      </Tip>
                    )}
                    {p.surrendered && (
                      <Tip text="Surrendered">
                        <img
                          src={rowIcon(whiteFlagIcon, '/icons/flag.svg')}
                          width={12}
                          height={12}
                          alt="Surrendered"
                          className="flex-shrink-0"
                        />
                      </Tip>
                    )}
                    {!p.connected && !p.eliminated && (
                      <Tip text="Disconnected">
                        <img
                          src={rowIcon(whiteNoWifiIcon, '/icons/no-wifi.svg')}
                          width={12}
                          height={12}
                          alt="Disconnected"
                          className="flex-shrink-0"
                        />
                      </Tip>
                    )}
                  </div>
                </td>
                <td style={rowStyle}>
                  {stats.turnsPlayed}/{roundNumber + 1}
                </td>
                {killedNames ? (
                  <Tip text={killedNames}>
                    <td style={rowStyle}>{p.playersKilled.length}</td>
                  </Tip>
                ) : (
                  <td style={rowStyle}>{p.playersKilled.length}</td>
                )}
                <td style={rowStyle}>{stats.troopsGained}</td>
                <td style={rowStyle}>{stats.troopsKilled}</td>
                <td style={rowStyle}>{stats.troopsLost}</td>
                <td style={rowStyle}>{stats.territoriesConquered}</td>
                <td style={rowStyle}>{stats.territoriesLost}</td>
                {isCapitals && (
                  <td style={rowStyle}>{stats.capitalsConquered}</td>
                )}
                {isCapitals && <td style={rowStyle}>{stats.capitalsLost}</td>}
                <td style={rowStyle}>{stats.cardsGained}</td>
                <td style={rowStyle}>{stats.setsPlayed}</td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}

export default ResultsTable;
