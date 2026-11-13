import AllianceCell from './AllianceCell';
import PlayerAvatar from './PlayerAvatar';
import PlayerProgress from './PlayerProgress';
import PlayerStatusIcons from './PlayerStatusIcons';
import PlayerStatValues from './PlayerStatValues';
import type { RowProps } from './rowTypes';
import { rowClassName, rowRootProps } from './rowTypes';

interface Props {
  row: RowProps;
}

function PlayerLine({ row }: Props) {
  const { player } = row;
  return (
    <div
      {...rowRootProps(row)}
      className={rowClassName(
        row,
        'player-line d-flex align-items-center gap-2 px-2 py-1',
      )}
    >
      <PlayerAvatar
        player={player}
        isSelf={row.isSelf}
        isTurn={row.isTurn}
        size={26}
        teamBadge={row.showTeamBadge}
      />
      <span className="fw-semibold text-truncate flex-grow-1">{row.label}</span>
      <PlayerStatusIcons statuses={row.statuses} />
      <PlayerStatValues
        player={player}
        stats={row.stats}
        iconSize={12}
        className="gap-2"
      />
      {row.alliance && (
        <AllianceCell playerId={player.id} alliance={row.alliance} />
      )}
      <PlayerProgress progress={row.progress} thin />
    </div>
  );
}

export default PlayerLine;
