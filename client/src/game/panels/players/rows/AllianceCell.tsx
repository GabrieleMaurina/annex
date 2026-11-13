import WhiteIcon from '../../../../common/icons/WhiteIcon';
import TipSpan from '../../../../common/tooltips/TipSpan';
import { playSound } from '../../../../lib/sounds';
import { ALLIANCE_CELL_LABELS, ALLIANCE_ICONS } from '../../../logic/alliance';
import type { AllianceCellProps } from './rowTypes';

interface Props {
  playerId: number;
  alliance: AllianceCellProps;
}

function AllianceCell({ playerId, alliance }: Props) {
  return (
    <span
      className="flex-shrink-0"
      ref={(element) => alliance.setRef(playerId, element)}
    >
      <TipSpan
        className="d-block"
        text={
          alliance.cooldown
            ? 'Alliance cooldown'
            : ALLIANCE_CELL_LABELS[alliance.state]
        }
      >
        <button
          type="button"
          className="border-0 bg-transparent text-reset d-inline-flex align-items-center justify-content-center lh-1 p-1"
          data-no-click-sound
          disabled={alliance.cooldown}
          onClick={(e) => {
            e.stopPropagation();
            playSound('click');
            alliance.onClick(playerId);
          }}
        >
          <WhiteIcon path={ALLIANCE_ICONS[alliance.state]} size={14} />
        </button>
      </TipSpan>
    </span>
  );
}

export default AllianceCell;
