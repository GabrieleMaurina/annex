import { Button, Table } from 'react-bootstrap';
import WhiteIcon from '../common/icons/WhiteIcon';
import Tip from '../common/tooltips/Tip';
import type { GameState } from '../lib/types';

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
                <Tip text="Let this player join again">
                  <Button
                    className="d-inline-flex align-items-center justify-content-center gap-1"
                    size="sm"
                    variant="secondary"
                    onClick={() => unbanPlayer(p.id)}
                  >
                    <WhiteIcon path="/icons/friend-add.svg" />
                    Unban
                  </Button>
                </Tip>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}

export default BannedList;
