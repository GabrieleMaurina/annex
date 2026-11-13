import WhiteIcon from '../../../../common/icons/WhiteIcon';
import Tip from '../../../../common/tooltips/Tip';
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
  const kind = isSelf ? 'You' : player.isBot ? 'Bot' : 'Player';
  const icon = `/icons/${kind.toLowerCase()}.svg`;
  return (
    <Tip text={isTurn ? `${kind}\nCurrent turn` : kind}>
      <span
        className={`player-orb position-relative d-inline-flex align-items-center justify-content-center flex-shrink-0 rounded-circle ${isTurn ? 'player-orb-turn' : ''}`}
        style={{ width: size, height: size }}
      >
        {picture ? (
          <img
            src={picture}
            alt=""
            width={size}
            height={size}
            className="rounded-circle"
          />
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
