import { meetsRequirements } from 'engine';
import { Badge, Table } from 'react-bootstrap';
import WhiteIcon from '../../common/icons/WhiteIcon';
import { playerColor } from '../../lib/palette';
import type { Account, GameSummary } from '../../lib/types';

const MAX_PIPS = 10;

const STATE_LABELS: Record<GameSummary['state'], string> = {
  lobby: 'Lobby',
  playing: 'Playing',
  ended: 'Ended',
};

const STATE_BADGES: Record<
  GameSummary['state'],
  { bg: string; text?: string }
> = {
  lobby: { bg: 'success' },
  playing: { bg: 'primary', text: 'dark' },
  ended: { bg: 'secondary' },
};

interface Props {
  games: GameSummary[];
  account: Account | null;
  onOpen: (name: string) => void;
}

function PlayerPips({ filled, slots }: { filled: number; slots: number }) {
  if (slots > MAX_PIPS) return null;
  return (
    <span className="d-inline-flex gap-1 me-2 align-middle">
      {Array.from({ length: slots }, (_, i) => (
        <span
          key={i}
          className={`player-pip${i < filled ? '' : ' player-pip-empty'}`}
          style={i < filled ? { backgroundColor: playerColor(i) } : undefined}
        />
      ))}
    </span>
  );
}

function GamesTable({ games, account, onOpen }: Props) {
  function isSpectateOnly(game: GameSummary) {
    return (
      game.state === 'lobby' &&
      (game.playerCount >= game.slots ||
        !meetsRequirements(game, {
          elo: account?.elo ?? null,
          gamesPlayed: account?.gamesPlayed ?? null,
          accountCreatedAt: account?.createdAt ?? null,
          reputation: account?.reputation ?? null,
          reputationRecoveryFrom: null,
        }))
    );
  }

  return (
    <div className="table-responsive">
      <Table hover borderless>
        <thead>
          <tr>
            <th style={{ width: 1 }} />
            <th>Name</th>
            <th>Map</th>
            <th>Host</th>
            <th>Players</th>
            <th>State</th>
          </tr>
        </thead>
        <tbody>
          {games.map((game) => {
            const badge =
              STATE_BADGES[isSpectateOnly(game) ? 'playing' : game.state];
            return (
              <tr
                key={game.name}
                role="button"
                onClick={() => onOpen(game.name)}
              >
                <td className="text-center px-1">
                  {game.hasPassword && (
                    <WhiteIcon
                      path="/icons/lock.svg"
                      size={14}
                      alt="Password protected"
                    />
                  )}
                </td>
                <td className="fw-semibold">{game.name}</td>
                <td>{game.mapName}</td>
                <td>{game.hostName}</td>
                <td>
                  <PlayerPips filled={game.playerCount} slots={game.slots} />
                  {game.playerCount}/{game.slots}
                  {game.spectatorCount > 0 &&
                    ` · ${game.spectatorCount} spectating`}
                </td>
                <td>
                  <Badge pill bg={badge.bg} text={badge.text}>
                    {STATE_LABELS[game.state]}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}

export default GamesTable;
