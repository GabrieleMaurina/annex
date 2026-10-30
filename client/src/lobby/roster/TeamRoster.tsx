import { useState } from 'react';
import { Button } from 'react-bootstrap';
import WhiteIcon from '../../common/icons/WhiteIcon';
import Tip from '../../common/tooltips/Tip';
import { SECTION_CLASS } from '../../ui/containers/panelStyle';
import type { RosterProps } from '../PlayerRoster';
import RosterTable from './RosterTable';
import {
  MAX_SLOTS,
  moveToTeam,
  teamLayout,
  type TeamLayout,
} from './teamLayout';

const MIN_TEAMS = 2;

function TeamRoster({ roster }: { roster: RosterProps }) {
  const { game, isHost, setTeams } = roster;
  const [dropTeam, setDropTeam] = useState<number | null>(null);
  const layout = teamLayout(game);

  function update(change: (next: TeamLayout) => void) {
    const next = teamLayout(game);
    change(next);
    setTeams(next);
  }

  function drop(e: React.DragEvent, team: number) {
    e.preventDefault();
    setDropTeam(null);
    const player = game.players.find(
      (p) => p.id === Number(e.dataTransfer.getData('text/plain')),
    );
    if (!player || player.team === team) return;
    const next = moveToTeam(game, player.id, team);
    if (next.reduce((sum, t) => sum + t.slots, 0) > MAX_SLOTS) return;
    setTeams(next);
  }

  return (
    <>
      {layout.map(({ slots }, team) => {
        const players = game.players.filter((p) => p.team === team);
        const rows = [
          ...players,
          ...Array.from({ length: slots - players.length }, () => null),
        ];
        const canRemove = layout.length > MIN_TEAMS && players.length === 0;
        return (
          <div
            key={team}
            className={`${SECTION_CLASS} mb-2 ${dropTeam === team ? 'border-primary' : ''}`}
            onDragOver={
              isHost
                ? (e) => {
                    e.preventDefault();
                    setDropTeam(team);
                  }
                : undefined
            }
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node))
                setDropTeam(null);
            }}
            onDrop={isHost ? (e) => drop(e, team) : undefined}
          >
            <div className="d-flex align-items-center justify-content-between px-2 py-1">
              <span className="fw-semibold">Team {team + 1}</span>
              {isHost && (
                <Tip text="Remove team">
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
                </Tip>
              )}
            </div>
            <RosterTable
              roster={roster}
              rows={rows}
              team={team}
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
          <Button
            size="sm"
            variant="success"
            onClick={() => setTeams([...layout, { slots: 1, playerIds: [] }])}
            disabled={game.slots >= MAX_SLOTS}
          >
            Add Team
          </Button>
        </div>
      )}
    </>
  );
}

export default TeamRoster;
