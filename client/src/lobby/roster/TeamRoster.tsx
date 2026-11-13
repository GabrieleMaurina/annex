import { Button } from 'react-bootstrap';
import WhiteIcon from '../../common/icons/WhiteIcon';
import TipSpan from '../../common/tooltips/TipSpan';
import { contrastTextColor, playerColor } from '../../lib/palette';
import type { GameState } from '../../lib/types';
import { SECTION_CLASS } from '../../ui/containers/panelStyle';
import { GAP, useDrag, type DropHit } from '../../ui/dnd/dragDrop';
import DragGhost from '../../ui/dnd/DragGhost';
import type { RosterProps } from '../PlayerRoster';
import RosterTable from './RosterTable';
import {
  MAX_SLOTS,
  moveToTeam,
  teamLayout,
  type TeamLayout,
} from './teamLayout';

const MIN_TEAMS = 2;

type Player = GameState['players'][number];

function TeamRoster({ roster }: { roster: RosterProps }) {
  const { game, isHost, setTeams } = roster;
  const layout = teamLayout(game);
  const { drag, start, register } = useDrag<Player>();
  const dragged = drag?.item ?? null;
  const target = drag?.hover?.zone === 'team' ? drag.hover.index : undefined;
  const moving =
    dragged !== null && target !== undefined && target !== dragged.team;
  const shown = moving ? moveToTeam(game, dragged.id, target) : layout;
  const playerById = new Map(game.players.map((p) => [p.id, p]));

  function update(change: (next: TeamLayout) => void) {
    const next = teamLayout(game);
    change(next);
    setTeams(next);
  }

  function dropPlayer(player: Player, hit: DropHit | null) {
    if (hit?.zone !== 'team' || hit.index === undefined) return;
    if (player.team === hit.index) return;
    const next = moveToTeam(game, player.id, hit.index);
    if (next.reduce((sum, t) => sum + t.slots, 0) > MAX_SLOTS) return;
    setTeams(next);
  }

  return (
    <>
      {shown.map(({ slots, playerIds }, team) => {
        const rows = [
          ...playerIds.map((id) =>
            moving && id === dragged.id ? GAP : playerById.get(id)!,
          ),
          ...Array.from({ length: slots - playerIds.length }, () => null),
        ];
        const canRemove =
          layout.length > MIN_TEAMS && layout[team].playerIds.length === 0;
        return (
          <div
            key={team}
            data-drop-zone={isHost ? 'team' : undefined}
            data-drop-index={team}
            data-drop-exact="true"
            className={`${SECTION_CLASS} mb-2 ${target === team ? 'border-primary' : ''}`}
          >
            <div className="d-flex align-items-center justify-content-between px-2 py-1">
              <span className="fw-semibold">Team {team + 1}</span>
              {isHost && (
                <TipSpan text="Remove team">
                  <Button
                    variant="danger"
                    className="d-inline-flex align-items-center justify-content-center"
                    style={{ width: 24, height: 24, padding: 0 }}
                    onClick={() =>
                      setTeams(layout.filter((_, index) => index !== team))
                    }
                    disabled={!canRemove}
                  >
                    <WhiteIcon path="/icons/close.svg" size={12} />
                  </Button>
                </TipSpan>
              )}
            </div>
            <RosterTable
              roster={roster}
              rows={rows}
              team={team}
              startDrag={
                isHost
                  ? (e, player) =>
                      start(e, player, (hit) => dropPlayer(player, hit))
                  : undefined
              }
              register={register}
              draggingId={dragged?.id}
              addSlot={() =>
                update((next) => {
                  next[team].slots++;
                })
              }
              removeEmptySlot={() =>
                update((next) => {
                  next[team].slots--;
                })
              }
            />
          </div>
        );
      })}
      {isHost && (
        <div className="text-center mb-2">
          <TipSpan
            text={
              game.slots >= MAX_SLOTS
                ? 'Maximum number of slots reached'
                : 'Add a team'
            }
          >
            <Button
              size="sm"
              variant="success"
              className="d-inline-flex align-items-center justify-content-center gap-1"
              onClick={() => setTeams([...layout, { slots: 1, playerIds: [] }])}
              disabled={game.slots >= MAX_SLOTS}
            >
              <WhiteIcon path="/icons/team.svg" />
              Add Team
            </Button>
          </TipSpan>
        </div>
      )}
      <DragGhost
        drag={drag}
        render={(player) => (
          <div
            className="rounded px-3 py-1 fw-semibold text-nowrap"
            style={{
              backgroundColor: playerColor(player.color),
              color: contrastTextColor(playerColor(player.color)),
            }}
          >
            {player.name}
          </div>
        )}
      />
    </>
  );
}

export default TeamRoster;
