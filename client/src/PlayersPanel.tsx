import { Button, ListGroup, Table } from 'react-bootstrap';
import { useWhiteIcon } from './icon';
import { contrastTextColor, playerColor } from './palette';
import ShareButton from './ShareButton';
import { socket } from './socket';
import type { Ack, GameState } from './types';

interface Props {
  players: GameState['players'];
  spectators: GameState['spectators'];
  isTeamDeathmatch: boolean;
  selfId: number | null;
  turnPlayerId: number | null;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  navigate: (path: string) => void;
}

function PlayersPanel({
  players,
  spectators,
  isTeamDeathmatch,
  selfId,
  turnPlayerId,
  collapsed,
  setCollapsed,
  navigate,
}: Props) {
  const isSpectator = spectators.some((s) => s.id === selfId);
  const canSurrender = !isSpectator && players.some((p) => p.id === selfId);

  const whiteTeamIcon = useWhiteIcon('/team.svg');
  const whiteTerritoryIcon = useWhiteIcon('/territory.svg');
  const whiteTankIcon = useWhiteIcon('/tank.svg');
  const whiteNoWifiIcon = useWhiteIcon('/no-wifi.svg');
  const whiteFlagIcon = useWhiteIcon('/flag.svg');

  function surrender() {
    socket.emit('game:surrender', (res: Ack) => {
      if (res.ok) navigate('/');
    });
  }

  if (collapsed) {
    return (
      <Button
        variant="secondary"
        size="sm"
        className="position-absolute top-0 end-0 m-2"
        onClick={() => setCollapsed(false)}
      >
        ☰
      </Button>
    );
  }

  return (
    <div
      className="position-absolute top-0 end-0 bg-body bg-opacity-75 border rounded p-3 m-2"
      style={{
        width: isTeamDeathmatch ? 280 : 240,
        maxHeight: 'calc(100vh - 1rem)',
      }}
    >
      <div className="d-flex justify-content-end mb-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setCollapsed(true)}
        >
          &gt;
        </Button>
      </div>
      <div
        className="overflow-auto no-scrollbar"
        style={{ maxHeight: 'calc(100vh - 7rem)' }}
      >
        <Table
          size="sm"
          borderless
          className="mb-0"
          style={{ tableLayout: 'fixed', width: '100%' }}
        >
          <thead>
            <tr>
              <th style={{ width: 16 }}></th>
              <th>Player</th>
              {isTeamDeathmatch && (
                <th className="text-end" style={{ width: 34 }}>
                  <img
                    src={whiteTeamIcon ?? '/team.svg'}
                    width={14}
                    height={14}
                    alt="Team"
                    title="Team"
                  />
                </th>
              )}
              <th
                className="text-end"
                style={{ width: 34, paddingRight: '0.75rem' }}
              >
                <img
                  src={whiteTerritoryIcon ?? '/territory.svg'}
                  width={14}
                  height={14}
                  alt="Territories"
                  title="Territories"
                />
              </th>
              <th
                className="text-end"
                style={{ width: 34, paddingRight: '0.75rem' }}
              >
                <img
                  src={whiteTankIcon ?? '/tank.svg'}
                  width={14}
                  height={14}
                  alt="Troops"
                  title="Troops"
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => {
              const bg = playerColor(p.color);
              const fg = contrastTextColor(bg);
              const rowStyle = { backgroundColor: bg, color: fg };
              const isDark = fg === '#ffffff';
              return (
                <tr key={p.id}>
                  <td className="align-middle text-center" style={rowStyle}>
                    {p.id === turnPlayerId && '●'}
                  </td>
                  <td className="align-middle text-truncate" style={rowStyle}>
                    {p.name}
                    {!p.connected && (
                      <img
                        src={
                          isDark
                            ? (whiteNoWifiIcon ?? '/no-wifi.svg')
                            : '/no-wifi.svg'
                        }
                        width={12}
                        height={12}
                        alt="Disconnected"
                        title="Disconnected"
                        className="ms-1"
                      />
                    )}
                    {p.surrendered && (
                      <img
                        src={
                          isDark ? (whiteFlagIcon ?? '/flag.svg') : '/flag.svg'
                        }
                        width={12}
                        height={12}
                        alt="Surrendered"
                        title="Surrendered"
                        className="ms-1"
                      />
                    )}
                  </td>
                  {isTeamDeathmatch && (
                    <td className="align-middle text-end" style={rowStyle}>
                      {p.team + 1}
                    </td>
                  )}
                  <td
                    className="align-middle text-end"
                    style={{ ...rowStyle, paddingRight: '0.75rem' }}
                  >
                    {p.territoryCount}
                  </td>
                  <td
                    className="align-middle text-end"
                    style={{ ...rowStyle, paddingRight: '0.75rem' }}
                  >
                    {p.troopCount}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        {spectators.length > 0 && (
          <>
            <div className="fw-bold mt-2 mb-1">Spectators</div>
            <ListGroup variant="flush">
              {spectators.map((s) => (
                <ListGroup.Item key={s.id} className="py-1">
                  {s.name}
                </ListGroup.Item>
              ))}
            </ListGroup>
          </>
        )}
      </div>
      {canSurrender && (
        <Button
          variant="danger"
          size="sm"
          className="w-100 mt-2"
          onClick={surrender}
        >
          Surrender
        </Button>
      )}
      <div className="d-flex justify-content-end mt-2">
        <ShareButton url={window.location.href} />
      </div>
    </div>
  );
}

export default PlayersPanel;
