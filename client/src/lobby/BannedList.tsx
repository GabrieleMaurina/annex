import { Button, Table } from 'react-bootstrap';
import type { GameState } from '../types';

interface Props {
  bannedPlayers: GameState['bannedPlayers'];
  isHost: boolean;
  unbanPlayer: (id: number) => void;
}

function BannedList({ bannedPlayers, isHost, unbanPlayer }: Props) {
  if (!isHost || bannedPlayers.length === 0) return null;

  return (
    <>
      <h5>Banned Players</h5>
      <Table striped borderless hover>
        <thead>
          <tr>
            <th>Player</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {bannedPlayers.map((p) => (
            <tr key={p.id}>
              <td className="align-middle">{p.name}</td>
              <td className="align-middle">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => unbanPlayer(p.id)}
                >
                  Unban
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}

export default BannedList;
