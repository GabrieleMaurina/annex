import WhiteIcon from '../../../../common/icons/WhiteIcon';
import Tip from '../../../../common/tooltips/Tip';
import type { PlayerStatus } from './rowTypes';

interface Props {
  statuses: PlayerStatus[];
  size?: number;
  withLabels?: boolean;
}

function PlayerStatusIcons({ statuses, size = 12, withLabels = false }: Props) {
  if (statuses.length === 0) return null;
  if (withLabels)
    return (
      <div className="d-flex flex-wrap gap-1">
        {statuses.map((s) => (
          <span
            key={s.key}
            className="badge text-bg-secondary d-inline-flex align-items-center gap-1 fw-normal"
          >
            <WhiteIcon path={s.icon} size={size} />
            {s.label}
          </span>
        ))}
      </div>
    );
  return (
    <span className="d-inline-flex align-items-center gap-1 flex-shrink-0">
      {statuses.map((s) => (
        <Tip key={s.key} text={s.label}>
          <span className="d-inline-flex">
            <WhiteIcon path={s.icon} size={size} />
          </span>
        </Tip>
      ))}
    </span>
  );
}

export default PlayerStatusIcons;
