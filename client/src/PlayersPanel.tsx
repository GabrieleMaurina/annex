import { Button, ListGroup, Table } from 'react-bootstrap';
import { contrastTextColor, playerColor } from './palette';
import type { GameState } from './types';

interface Props {
  players: GameState['players'];
  spectators: GameState['spectators'];
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  navigate: (path: string) => void;
}

function PlayersPanel({
  players,
  spectators,
  collapsed,
  setCollapsed,
  navigate,
}: Props) {
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
      className="position-absolute top-0 end-0 bg-body bg-opacity-75 p-3"
      style={{ width: 220, maxHeight: '100vh' }}
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
        <Table size="sm" borderless className="mb-0">
          <thead>
            <tr>
              <th>Player</th>
              <th className="text-end">Land</th>
              <th className="text-end">Army</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => {
              const rowStyle = {
                backgroundColor: playerColor(p.color),
                color: contrastTextColor(playerColor(p.color)),
              };
              return (
                <tr key={p.id}>
                  <td className="align-middle" style={rowStyle}>
                    {p.name}
                  </td>
                  <td className="align-middle text-end" style={rowStyle}>
                    {p.territoryCount}
                  </td>
                  <td className="align-middle text-end" style={rowStyle}>
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
      <Button
        variant="danger"
        size="sm"
        className="w-100 mt-2"
        onClick={() => navigate('/')}
      >
        Surrender
      </Button>
    </div>
  );
}

export default PlayersPanel;
