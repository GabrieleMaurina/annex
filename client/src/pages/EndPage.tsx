import { Button, Container, Table } from 'react-bootstrap';
import { contrastTextColor, playerColor } from '../lib/palette';
import type { GameState } from '../lib/types';

interface Props {
  game: GameState;
  selfId: number | null;
  navigate: (path: string) => void;
  onViewMap: () => void;
}

function EndPage({ game, selfId, navigate, onViewMap }: Props) {
  const winners = game.players.filter((p) => game.winnerIds.includes(p.id));
  const won = selfId !== null && game.winnerIds.includes(selfId);
  const isTeamDeathmatch = game.gameMode === 'Team Deathmatch';
  const isCapitals = game.gameMode === 'Capitals';
  const nameById = new Map(game.players.map((p) => [p.id, p.name]));
  const playerById = new Map(game.players.map((p) => [p.id, p]));
  const rankedPlayers = game.finalRanking
    .map((id) => playerById.get(id))
    .filter((p): p is GameState['players'][number] => !!p);

  return (
    <Container fluid className="py-5 px-4">
      <div className="text-center mb-4">
        <h1 className="mb-4">{won ? 'You Win!' : 'Game Over'}</h1>
        {isTeamDeathmatch ? (
          <p className="fs-4 mb-0">
            Team {(winners[0]?.team ?? 0) + 1} wins:{' '}
            {winners.map((w) => w.name).join(', ')}
          </p>
        ) : (
          <p
            className="fs-4 mb-0"
            style={{ color: playerColor(winners[0]?.color ?? 0) }}
          >
            {winners[0]?.name} wins!
          </p>
        )}
      </div>

      <div className="table-responsive">
        <Table size="sm" borderless className="mb-4 text-center align-middle">
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
              const rowStyle = { backgroundColor: bg, color: fg };
              const killedNames = p.playersKilled
                .map((id) => nameById.get(id) ?? '?')
                .join(', ');
              return (
                <tr key={p.id}>
                  <td style={rowStyle}>{index + 1}</td>
                  <td className="text-start" style={rowStyle}>
                    {p.name}
                  </td>
                  <td style={rowStyle}>
                    {p.turnsPlayed}/{game.turnNumber + 1}
                  </td>
                  <td style={rowStyle} title={killedNames || undefined}>
                    {p.playersKilled.length}
                  </td>
                  <td style={rowStyle}>{p.troopsGained}</td>
                  <td style={rowStyle}>{p.troopsKilled}</td>
                  <td style={rowStyle}>{p.troopsLost}</td>
                  <td style={rowStyle}>{p.territoriesConquered}</td>
                  <td style={rowStyle}>{p.territoriesLost}</td>
                  {isCapitals && <td style={rowStyle}>{p.capitalsConquered}</td>}
                  {isCapitals && <td style={rowStyle}>{p.capitalsLost}</td>}
                  <td style={rowStyle}>{p.cardsGained}</td>
                  <td style={rowStyle}>{p.setsPlayed}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>

      <div className="d-flex justify-content-center gap-2">
        <Button variant="secondary" onClick={onViewMap}>
          View Map
        </Button>
        <Button onClick={() => navigate('/')}>Leave</Button>
      </div>
    </Container>
  );
}

export default EndPage;
