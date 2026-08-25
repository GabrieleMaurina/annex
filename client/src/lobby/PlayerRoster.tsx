import { Badge, Button, Form, Table } from 'react-bootstrap';
import { useWhiteIcon } from '../common/icon';
import Tip from '../common/Tip';
import { GLOBAL_TARGET_ID } from '../game/emoji';
import { contrastTextColor, playerColor } from '../lib/palette';
import type { GameState } from '../lib/types';

const MIN_SLOTS = 2;
const MAX_SLOTS = 20;

interface Props {
  game: GameState;
  isHost: boolean;
  isTeamDeathmatch: boolean;
  maxTeams: number;
  selfId: number | null;
  setPlayerTeam: (playerId: number, team: number) => void;
  cycleColor: () => void;
  removeSlot: (index: number) => void;
  addSlot: () => void;
  rowRefs: React.RefObject<Map<number, HTMLElement>>;
  nameCellRefs: React.RefObject<Map<number, HTMLElement>>;
  onEmojiRowClick: (playerId: number) => void;
}

function PlayerRoster({
  game,
  isHost,
  isTeamDeathmatch,
  maxTeams,
  selfId,
  setPlayerTeam,
  cycleColor,
  removeSlot,
  addSlot,
  rowRefs,
  nameCellRefs,
  onEmojiRowClick,
}: Props) {
  const slotRows = Array.from(
    { length: game.slots },
    (_, i) => game.players[i] ?? null,
  );
  const whiteGlobeIcon = useWhiteIcon('/icons/globe.svg');

  return (
    <>
      <Table striped borderless hover size="sm" className="mb-0">
        <thead>
          <tr>
            <th style={{ width: '1%' }} className="text-nowrap"></th>
            <th style={{ width: '100%' }}>Player</th>
            {isTeamDeathmatch && <th className="text-nowrap">Team</th>}
            {isHost && (
              <th style={{ width: '1%' }} className="text-nowrap"></th>
            )}
          </tr>
        </thead>
        <tbody>
          {slotRows.map((p, i) => {
            const rowStyle = p
              ? {
                  backgroundColor: playerColor(p.color),
                  color: contrastTextColor(playerColor(p.color)),
                  cursor: 'pointer',
                }
              : undefined;
            return (
              <tr
                key={i}
                ref={(el) => {
                  if (!p) return;
                  if (el) rowRefs.current.set(p.id, el);
                  else rowRefs.current.delete(p.id);
                }}
                role={p ? 'button' : undefined}
                onClick={
                  p
                    ? p.id === selfId
                      ? cycleColor
                      : () => onEmojiRowClick(p.id)
                    : undefined
                }
              >
                <td className="align-middle text-nowrap px-3" style={rowStyle}>
                  {i + 1}
                </td>
                <td className="align-middle" style={rowStyle}>
                  {p ? (
                    <span
                      ref={(el) => {
                        if (el) nameCellRefs.current.set(p.id, el);
                        else nameCellRefs.current.delete(p.id);
                      }}
                    >
                      {p.name}
                      {p.id === game.hostId && (
                        <Badge bg="primary" className="ms-2 align-middle">
                          Host
                        </Badge>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted">Empty</span>
                  )}
                </td>
                {isTeamDeathmatch && (
                  <td
                    className="align-middle"
                    style={rowStyle}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {p ? (
                      isHost ? (
                        <Form.Select
                          size="sm"
                          className="w-auto"
                          value={p.team}
                          onChange={(e) =>
                            setPlayerTeam(p.id, Number(e.target.value))
                          }
                        >
                          {Array.from({ length: maxTeams }, (_, t) => t).map(
                            (team) => (
                              <option key={team} value={team}>
                                {team + 1}
                              </option>
                            ),
                          )}
                        </Form.Select>
                      ) : (
                        p.team + 1
                      )
                    ) : null}
                  </td>
                )}
                {isHost && (
                  <td
                    className="text-nowrap align-middle"
                    style={rowStyle}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {p?.id !== selfId && (
                      <Tip text={p ? 'Kick/Ban' : 'Remove'}>
                        <Button
                          variant="danger"
                          className="d-inline-flex align-items-center justify-content-center"
                          style={{ width: 24, height: 24, padding: 0 }}
                          onClick={() => removeSlot(i)}
                          disabled={!p && game.slots <= MIN_SLOTS}
                        >
                          ✕
                        </Button>
                      </Tip>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
          {isHost && (
            <tr>
              <td
                colSpan={2 + (isTeamDeathmatch ? 1 : 0) + 1}
                className="text-center align-middle"
              >
                <Tip text="Add slot" placement="bottom">
                  <Button
                    size="sm"
                    variant="success"
                    onClick={addSlot}
                    disabled={game.slots >= MAX_SLOTS}
                  >
                    +
                  </Button>
                </Tip>
              </td>
            </tr>
          )}
        </tbody>
      </Table>
      <div className="d-flex justify-content-start mt-1">
        <Tip text="Everyone" placement="bottom">
          <Button
            variant="secondary"
            size="sm"
            className="d-inline-flex align-items-center justify-content-center"
            style={{ width: 28, height: 28, padding: 0 }}
            onClick={() => onEmojiRowClick(GLOBAL_TARGET_ID)}
            ref={(el) => {
              if (el) {
                rowRefs.current.set(GLOBAL_TARGET_ID, el);
                nameCellRefs.current.set(GLOBAL_TARGET_ID, el);
              } else {
                rowRefs.current.delete(GLOBAL_TARGET_ID);
                nameCellRefs.current.delete(GLOBAL_TARGET_ID);
              }
            }}
          >
            <img
              src={whiteGlobeIcon ?? '/icons/globe.svg'}
              width={14}
              height={14}
              alt="Everyone"
            />
          </Button>
        </Tip>
      </div>
    </>
  );
}

export default PlayerRoster;
