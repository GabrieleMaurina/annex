import WhiteIcon from '../../../../common/icons/WhiteIcon';
import Tip from '../../../../common/tooltips/Tip';
import type { StatDef } from '../playerStats';
import type { Player } from './rowTypes';

interface Props {
  player: Player;
  stats: StatDef[];
  iconSize?: number;
  className?: string;
}

function PlayerStatValues({
  player,
  stats,
  iconSize = 13,
  className = 'gap-3',
}: Props) {
  return (
    <span className={`d-inline-flex align-items-center flex-wrap ${className}`}>
      {stats.map((stat) => {
        const value = stat.value(player);
        const muted = value === '?' || value === '-';
        return (
          <Tip key={stat.key} text={stat.title}>
            <span
              className={`d-inline-flex align-items-center gap-1 fw-semibold ${muted ? 'text-body-secondary' : ''}`}
            >
              <WhiteIcon path={stat.icon} size={iconSize} />
              {value}
            </span>
          </Tip>
        );
      })}
    </span>
  );
}

export default PlayerStatValues;
