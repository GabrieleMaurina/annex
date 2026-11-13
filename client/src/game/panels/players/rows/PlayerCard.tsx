import Flag from '../../../../common/badges/Flag';
import { usePlayerProfile } from '../../../../common/conduct/usePlayerProfile';
import AllianceCell from './AllianceCell';
import PlayerAvatar from './PlayerAvatar';
import PlayerProgress from './PlayerProgress';
import PlayerStatusIcons from './PlayerStatusIcons';
import PlayerStatValues from './PlayerStatValues';
import type { RowProps } from './rowTypes';
import { rowClassName, rowRootProps } from './rowTypes';

interface Props {
  row: RowProps;
  big: boolean;
  live: boolean;
  showPicture: boolean;
}

function PlayerCard({ row, big, live, showPicture }: Props) {
  const { player } = row;
  const { picture } = usePlayerProfile(player, live, showPicture);
  return (
    <div
      {...rowRootProps(row)}
      className={rowClassName(
        row,
        'player-card rounded-3 d-flex align-items-center gap-3 p-2',
      )}
    >
      <PlayerAvatar
        player={player}
        isSelf={row.isSelf}
        isTurn={row.isTurn}
        size={big ? 56 : 48}
        picture={picture}
      />
      <div className="flex-grow-1 overflow-hidden d-flex flex-column gap-1">
        <div className="d-flex align-items-center gap-2">
          <span className="fw-semibold text-truncate">{row.label}</span>
          <Flag country={player.country} height={big ? 16 : 14} />
          {player.isBot && (
            <span className="badge text-bg-secondary fw-normal">Bot</span>
          )}
          {row.alliance && (
            <span className="ms-auto">
              <AllianceCell playerId={player.id} alliance={row.alliance} />
            </span>
          )}
        </div>
        <PlayerStatusIcons statuses={row.statuses} size={11} withLabels />
        <PlayerStatValues
          player={player}
          stats={row.stats}
          className="column-gap-3 row-gap-1"
        />
        <PlayerProgress progress={row.progress} />
      </div>
    </div>
  );
}

export default PlayerCard;
