import { Button, Container } from 'react-bootstrap';
import { playerColor } from '../lib/palette';
import type { GameState } from '../lib/types';

interface Props {
  game: GameState;
  selfId: number | null;
  navigate: (path: string) => void;
}

function EndPage({ game, selfId, navigate }: Props) {
  const winners = game.players.filter((p) => game.winnerIds.includes(p.id));
  const won = selfId !== null && game.winnerIds.includes(selfId);
  const isTeamDeathmatch = game.gameMode === 'Team Deathmatch';

  return (
    <Container className="py-5 text-center">
      <h1 className="mb-4">{won ? 'You Win!' : 'Game Over'}</h1>
      {isTeamDeathmatch ? (
        <p className="fs-4 mb-4">
          Team {(winners[0]?.team ?? 0) + 1} wins:{' '}
          {winners.map((w) => w.name).join(', ')}
        </p>
      ) : (
        <p
          className="fs-4 mb-4"
          style={{ color: playerColor(winners[0]?.color ?? 0) }}
        >
          {winners[0]?.name} wins!
        </p>
      )}
      <Button onClick={() => navigate('/')}>Leave</Button>
    </Container>
  );
}

export default EndPage;
