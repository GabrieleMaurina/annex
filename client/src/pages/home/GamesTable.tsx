import { meetsRequirements } from 'engine';
import { Badge, Table } from 'react-bootstrap';
import WhiteIcon from '../../common/icons/WhiteIcon';
import Tip from '../../common/tooltips/Tip';
import { playerColor } from '../../lib/palette';
import type { Account, GameSummary } from '../../lib/types';
import { titleCase } from '../../lobby/settings/gameSettings';

const MAX_PIPS = 10;
const MAX_SPECTATOR_ICONS = 5;

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

function PlayerPips({
  filled,
  bots,
  slots,
}: {
  filled: number;
  bots: number;
  slots: number;
}) {
  if (slots > MAX_PIPS) return null;
  const humans = filled - bots;
  return (
    <span className="d-inline-flex align-items-center gap-1 me-2 align-middle">
      {Array.from({ length: slots }, (_, i) =>
        i >= humans && i < filled ? (
          <Tip key={i} text="Bot">
            <span className="d-inline-flex">
              <WhiteIcon path="/icons/bot.svg" size={12} alt="Bot" />
            </span>
          </Tip>
        ) : (
          <span
            key={i}
            className={`player-pip${i < filled ? '' : ' player-pip-empty'}`}
            style={i < filled ? { backgroundColor: playerColor(i) } : undefined}
          />
        ),
      )}
    </span>
  );
}

function Spectators({ count }: { count: number }) {
  if (count === 0) return null;
  function icon(label: string) {
    return (
      <span className="d-inline-flex">
        <WhiteIcon path="/icons/binoculars.svg" size={14} alt={label} />
      </span>
    );
  }
  if (count > MAX_SPECTATOR_ICONS)
    return (
      <Tip text="Spectators">
        <span className="d-inline-flex align-items-center gap-1 ms-3 align-middle">
          {icon('Spectators')}
          {count}
        </span>
      </Tip>
    );
  return (
    <span className="d-inline-flex align-items-center gap-1 ms-3 align-middle">
      {Array.from({ length: count }, (_, i) => (
        <Tip key={i} text="Spectator">
          {icon('Spectator')}
        </Tip>
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
            <th>Name</th>
            <th>Map</th>
            <th>Mode</th>
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
                <td className="fw-semibold">
                  {game.hasPassword && (
                    <span className="me-2 align-middle">
                      <WhiteIcon
                        path="/icons/lock.svg"
                        size={14}
                        alt="Password protected"
                      />
                    </span>
                  )}
                  {game.name}
                </td>
                <td>{game.mapName}</td>
                <td>{titleCase(game.gameMode)}</td>
                <td>{game.hostName}</td>
                <td>
                  <PlayerPips
                    filled={game.playerCount}
                    bots={game.botCount}
                    slots={game.slots}
                  />
                  {game.playerCount}/{game.slots}
                  <Spectators count={game.spectatorCount} />
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
