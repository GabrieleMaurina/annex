import Tip from '../../../../common/tooltips/Tip';
import AllianceCell from './AllianceCell';
import PlayerAvatar from './PlayerAvatar';
import PlayerStatusIcons from './PlayerStatusIcons';
import PlayerStatValues from './PlayerStatValues';
import type { RowProps } from './rowTypes';
import { rowClassName, rowRootProps } from './rowTypes';

interface Props {
  row: RowProps;
}

function PlayerChip({ row }: Props) {
  const { player } = row;
  return (
    <Tip text={row.label} placement="left">
      <div
        {...rowRootProps(row)}
        className={rowClassName(
          row,
          'player-chip rounded-2 d-flex align-items-center gap-2 ps-1 pe-2',
        )}
      >
        <PlayerAvatar
          player={player}
          isSelf={row.isSelf}
          isTurn={row.isTurn}
          size={22}
          teamBadge={row.showTeamBadge}
        />
        <PlayerStatValues
          player={player}
          stats={row.stats}
          iconSize={11}
          className="gap-2 small flex-grow-1 justify-content-between"
        />
        <PlayerStatusIcons statuses={row.statuses} size={11} />
        {row.alliance && (
          <AllianceCell playerId={player.id} alliance={row.alliance} />
        )}
      </div>
    </Tip>
  );
}

export default PlayerChip;
