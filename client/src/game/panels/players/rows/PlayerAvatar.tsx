import WhiteIcon from '../../../../common/icons/WhiteIcon';
import ZombieIcon from '../../../../common/icons/ZombieIcon';
import Tip from '../../../../common/tooltips/Tip';
import { scaled } from '../../../../ui/uiScale';
import type { Player } from './rowTypes';

interface Props {
  player: Player;
  isSelf: boolean;
  isTurn: boolean;
  size: number;
  picture?: string | null;
  teamBadge?: boolean;
}

function PlayerAvatar({
  player,
  isSelf,
  isTurn,
  size,
  picture,
  teamBadge = false,
}: Props) {
  const kind = isSelf
    ? 'You'
    : player.isZombie
      ? 'Zombies'
      : player.isBot
        ? 'Bot'
        : 'Player';
  const icon = `/icons/${player.isBot ? 'bot' : kind.toLowerCase()}.svg`;
  return (
    <Tip text={isTurn ? `${kind}\nCurrent turn` : kind}>
      <span
        className={`player-orb position-relative d-inline-flex align-items-center justify-content-center flex-shrink-0 rounded-2 ${isTurn ? 'player-orb-turn' : ''}`}
        style={{ width: scaled(size), height: scaled(size) }}
      >
        {picture ? (
          <img
            src={picture}
            alt=""
            className="rounded-2 w-100 h-100 object-fit-cover"
          />
        ) : player.isZombie ? (
          <ZombieIcon size={Math.round(size * 0.6)} isTurn={isTurn} />
        ) : (
          <WhiteIcon path={icon} size={Math.round(size * 0.5)} />
        )}
        {teamBadge && (
          <span className="player-team-badge position-absolute rounded-pill">
            {player.team + 1}
          </span>
        )}
      </span>
    </Tip>
  );
}

export default PlayerAvatar;
