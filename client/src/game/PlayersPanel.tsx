import { Button, ListGroup, Table } from 'react-bootstrap';
import { useWhiteIcon } from '../common/icon';
import { PANEL_BG_CLASS, PANEL_CLASS } from '../common/panelStyle';
import { contrastTextColor, playerColor } from '../lib/palette';
import { socket } from '../lib/socket';
import type { Ack, GameState, TurnPhase } from '../lib/types';

interface Props {
  players: GameState['players'];
  spectators: GameState['spectators'];
  isTeamDeathmatch: boolean;
  isCapitals: boolean;
  selfId: number | null;
  turnNumber: number;
  turnPhase: TurnPhase;
  turnPlayerId: number | null;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  navigate: (path: string) => void;
}

function PlayersPanel({
  players,
  spectators,
  isTeamDeathmatch,
  isCapitals,
  selfId,
  turnNumber,
  turnPhase,
  turnPlayerId,
  collapsed,
  setCollapsed,
  navigate,
}: Props) {
  const isSpectator = spectators.some((s) => s.id === selfId);
  const self = players.find((p) => p.id === selfId);
  const canSurrender = !isSpectator && !!self && !self.eliminated;

  const whiteTeamIcon = useWhiteIcon('/icons/team.svg');
  const whiteTerritoryIcon = useWhiteIcon('/icons/territory.svg');
  const whiteCapitalIcon = useWhiteIcon('/icons/capital.svg');
  const whiteTankIcon = useWhiteIcon('/icons/tank.svg');
  const whiteCardsIcon = useWhiteIcon('/icons/cards.svg');
  const whiteNoWifiIcon = useWhiteIcon('/icons/no-wifi.svg');
  const whiteFlagIcon = useWhiteIcon('/icons/flag.svg');
  const whiteDeathIcon = useWhiteIcon('/icons/death.svg');

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
        className="position-absolute top-0 end-0 m-3"
        onClick={() => setCollapsed(false)}
      >
        ☰
      </Button>
    );
  }

  return (
    <div
      className={`position-absolute top-0 end-0 ${PANEL_BG_CLASS} ${PANEL_CLASS} m-3`}
      style={{
        width: 270 + (isTeamDeathmatch ? 40 : 0) + (isCapitals ? 40 : 0),
        maxHeight: 'calc(100vh - 2rem)',
      }}
    >
      <div
        className="text-center fw-bold mb-3"
        role="button"
        tabIndex={0}
        onClick={() => setCollapsed(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setCollapsed(true);
        }}
        style={{ cursor: 'pointer' }}
      >
        Turn {turnPhase === 'capital' ? 0 : turnNumber + 1}
      </div>
      <div
        className="overflow-auto no-scrollbar"
        style={{ maxHeight: 'calc(100vh - 8rem)' }}
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
                <th className="text-center" style={{ width: 34 }}>
                  <img
                    src={whiteTeamIcon ?? '/icons/team.svg'}
                    width={14}
                    height={14}
                    alt="Team"
                    title="Team"
                  />
                </th>
              )}
              <th className="text-center" style={{ width: 34 }}>
                <img
                  src={whiteTerritoryIcon ?? '/icons/territory.svg'}
                  width={14}
                  height={14}
                  alt="Territories"
                  title="Territories"
                />
              </th>
              {isCapitals && (
                <th className="text-center" style={{ width: 34 }}>
                  <img
                    src={whiteCapitalIcon ?? '/icons/capital.svg'}
                    width={14}
                    height={14}
                    alt="Capitals"
                    title="Capitals"
                  />
                </th>
              )}
              <th className="text-center" style={{ width: 34 }}>
                <img
                  src={whiteTankIcon ?? '/icons/tank.svg'}
                  width={14}
                  height={14}
                  alt="Troops"
                  title="Troops"
                />
              </th>
              <th className="text-center" style={{ width: 34 }}>
                <img
                  src={whiteCardsIcon ?? '/icons/cards.svg'}
                  width={14}
                  height={14}
                  alt="Cards"
                  title="Cards"
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
                    {p.eliminated && (
                      <img
                        src={
                          isDark
                            ? (whiteDeathIcon ?? '/icons/death.svg')
                            : '/icons/death.svg'
                        }
                        width={12}
                        height={12}
                        alt="Eliminated"
                        title="Eliminated"
                        className="ms-1"
                      />
                    )}
                    {!p.connected && !p.eliminated && (
                      <img
                        src={
                          isDark
                            ? (whiteNoWifiIcon ?? '/icons/no-wifi.svg')
                            : '/icons/no-wifi.svg'
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
                          isDark
                            ? (whiteFlagIcon ?? '/icons/flag.svg')
                            : '/icons/flag.svg'
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
                    <td className="align-middle text-center" style={rowStyle}>
                      {p.team + 1}
                    </td>
                  )}
                  <td className="align-middle text-center" style={rowStyle}>
                    {p.territoryCount}
                  </td>
                  {isCapitals && (
                    <td className="align-middle text-center" style={rowStyle}>
                      {p.capitalCount}
                    </td>
                  )}
                  <td className="align-middle text-center" style={rowStyle}>
                    {p.troopCount}
                  </td>
                  <td className="align-middle text-center" style={rowStyle}>
                    {p.cardCount}
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
        <div className="d-flex justify-content-end mt-2">
          <Button
            variant="danger"
            size="sm"
            className="d-flex align-items-center gap-1"
            onClick={surrender}
          >
            <img
              src={whiteFlagIcon ?? '/icons/flag.svg'}
              width={14}
              height={14}
              alt=""
            />
            Surrender
          </Button>
        </div>
      )}
    </div>
  );
}

export default PlayersPanel;
