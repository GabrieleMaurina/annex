import { Button, Table } from 'react-bootstrap';
import Flag from '../common/badges/Flag';
import RankIcon from '../common/badges/RankIcon';
import type { GameState } from '../lib/types';

interface Props {
  spectators: GameState['spectators'];
  isHost: boolean;
  banId: (id: number) => void;
}

function SpectatorList({ spectators, isHost, banId }: Props) {
  if (spectators.length === 0) return null;

  return (
    <>
      <h5>Spectators</h5>
      <Table striped borderless hover>
        <thead>
          <tr>
            <th style={{ width: '1%' }} className="text-nowrap"></th>
            <th style={{ width: '100%' }}>Spectator</th>
            {isHost && (
              <th style={{ width: '1%' }} className="text-nowrap"></th>
            )}
          </tr>
        </thead>
        <tbody>
          {spectators.map((s, i) => (
            <tr key={s.id}>
              <td className="align-middle text-nowrap px-3">{i + 1}</td>
              <td className="align-middle">
                <span className="d-inline-flex align-items-center gap-2">
                  <RankIcon elo={s.elo} />
                  <Flag country={s.country} />
                  {s.name}
                </span>
              </td>
              {isHost && (
                <td className="text-nowrap align-middle">
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => banId(s.id)}
                  >
                    ✕
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}

export default SpectatorList;
