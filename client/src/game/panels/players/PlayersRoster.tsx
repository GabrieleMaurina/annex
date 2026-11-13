import type { CSSProperties, MutableRefObject, Ref } from 'react';
import type { GameState } from '../../../lib/types';
import type { EmojiPop } from '../../logic/emoji';
import type { PlayersLevel } from './playerLevels';
import type { ProgressContext, StatDef } from './playerStats';
import { CHIP_STATS, LINE_STATS, pickStats, progressFor } from './playerStats';
import { registerRef } from './registerRef';
import PlayerCard from './rows/PlayerCard';
import PlayerChip from './rows/PlayerChip';
import PlayerLine from './rows/PlayerLine';
import { playerStatuses } from './rows/playerStatuses';
import type { RowProps } from './rows/rowTypes';

const BIG_CARD_MAX = 3;

interface Props {
  players: GameState['players'];
  level: PlayersLevel;
  twoColumns: boolean;
  gridRef: Ref<HTMLDivElement>;
  stats: StatDef[];
  progressContext: ProgressContext;
  isTeamDeathmatch: boolean;
  selfId: number | null;
  turnPlayerId: number | null;
  selectedId: number | null;
  drawVoteIds: number[];
  abortVoteIds: number[];
  recoloredIds?: Set<number>;
  anonymous: boolean;
  live: boolean;
  canSendEmoji: boolean;
  emojiTargeting: boolean;
  emojiPops: EmojiPop[];
  emojiAllowedIds: Set<number> | null;
  showAllianceColumn: boolean;
  allianceStates: GameState['allianceStates'];
  allianceCooldownIds: Set<number>;
  allianceCellRefs: MutableRefObject<Map<number, HTMLElement>>;
  onAllianceCellClick: (playerId: number) => void;
  rowRefs: MutableRefObject<Map<number, HTMLElement>>;
  onSelect: (playerId: number) => void;
  onEmojiClick: (playerId: number) => void;
}

function PlayersRoster({
  players,
  level,
  twoColumns,
  gridRef,
  stats,
  progressContext,
  isTeamDeathmatch,
  selfId,
  turnPlayerId,
  selectedId,
  drawVoteIds,
  abortVoteIds,
  recoloredIds,
  anonymous,
  live,
  canSendEmoji,
  emojiTargeting,
  emojiPops,
  emojiAllowedIds,
  showAllianceColumn,
  allianceStates,
  allianceCooldownIds,
  allianceCellRefs,
  onAllianceCellClick,
  rowRefs,
  onSelect,
  onEmojiClick,
}: Props) {
  const rowStats =
    level === 'cards'
      ? stats
      : pickStats(stats, level === 'lines' ? LINE_STATS : CHIP_STATS);
  const rows: RowProps[] = players.map((player) => {
    const isSelf = player.id === selfId;
    return {
      player,
      label: isSelf ? 'You' : player.name,
      isSelf,
      isTurn: player.id === turnPlayerId,
      selected: player.id === selectedId,
      statuses: playerStatuses({
        player,
        isSelf,
        recolored: !!recoloredIds?.has(player.id),
        drawVoted: drawVoteIds.includes(player.id),
        abortVoted: abortVoteIds.includes(player.id),
      }),
      stats: rowStats,
      progress: progressFor(player, progressContext),
      showTeamBadge: isTeamDeathmatch && level !== 'cards',
      emojiTargeting,
      rowClickable:
        canSendEmoji &&
        !player.isBot &&
        (emojiTargeting ||
          (!isSelf &&
            (emojiAllowedIds === null || emojiAllowedIds.has(player.id)))),
      pop: emojiPops.find((e) => e.rowPlayerId === player.id),
      alliance:
        showAllianceColumn && !isSelf && !player.isBot
          ? {
              state:
                allianceStates.find((a) => a.playerId === player.id)?.state ??
                'none',
              cooldown: allianceCooldownIds.has(player.id),
              setRef: (id, element) =>
                registerRef(allianceCellRefs, id, element),
              onClick: onAllianceCellClick,
            }
          : null,
      setRowRef: (id, element) => registerRef(rowRefs, id, element),
      onSelect,
      onEmojiClick,
    };
  });

  if (level === 'cards')
    return (
      <div ref={gridRef} className="d-flex flex-column gap-2">
        {rows.map((row) => (
          <PlayerCard
            key={row.player.id}
            row={row}
            big={players.length <= BIG_CARD_MAX}
            live={live}
            showPicture={!anonymous}
          />
        ))}
      </div>
    );

  if (level === 'lines')
    return (
      <div ref={gridRef} className="d-flex flex-column gap-1">
        {rows.map((row) => (
          <PlayerLine key={row.player.id} row={row} />
        ))}
      </div>
    );

  const gridRows = twoColumns ? Math.ceil(rows.length / 2) : rows.length;
  return (
    <div
      ref={gridRef}
      className="player-chips"
      style={{ '--player-rows': gridRows } as CSSProperties}
    >
      {rows.map((row) => (
        <PlayerChip key={row.player.id} row={row} showName={!twoColumns} />
      ))}
    </div>
  );
}

export default PlayersRoster;
