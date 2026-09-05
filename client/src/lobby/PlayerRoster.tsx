import { Badge, Button, Form, Table } from 'react-bootstrap';
import { useWhiteIcon } from '../common/icon';
import { isPlayerMuted } from '../common/mutedPlayers';
import PlayerNameEditor from '../common/PlayerNameEditor';
import Tip from '../common/Tip';
import { connector } from '../connector';
import { GLOBAL_TARGET_ID } from '../game/logic/emoji';
import { contrastTextColor, playerColor } from '../lib/palette';
import type { BotDifficulty, BotPersonality, GameState } from '../lib/types';
import {
  BOT_DIFFICULTIES,
  BOT_DIFFICULTY_LABELS,
  BOT_PERSONALITIES,
  BOT_PERSONALITY_LABELS,
} from './botOptions';

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
  cycleBotColor: (botPlayerId: number) => void;
  removeSlot: (index: number) => void;
  addSlot: () => void;
  addBot: () => void;
  addLocalPlayer?: () => void;
  setLocalPlayerName?: (playerId: number, name: string) => void;
  setBotProfile: (
    botPlayerId: number,
    difficulty: BotDifficulty | 'random',
    personality: BotPersonality | 'random',
  ) => void;
  removeBot: (botPlayerId: number) => void;
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
  cycleBotColor,
  removeSlot,
  addSlot,
  addBot,
  addLocalPlayer,
  setLocalPlayerName,
  setBotProfile,
  removeBot,
  rowRefs,
  nameCellRefs,
  onEmojiRowClick,
}: Props) {
  const slotRows = Array.from(
    { length: game.slots },
    (_, i) => game.players[i] ?? null,
  );
  const whiteGlobeIcon = useWhiteIcon('/icons/globe.svg');
  const whiteBotIcon = useWhiteIcon('/icons/bot.svg');
  const whiteMutedIcon = useWhiteIcon('/icons/muted.svg');
  const hasBots = game.players.some((p) => p.isBot);

  function rowClick(p: (typeof slotRows)[number]) {
    if (!p) return undefined;
    if (p.id === selfId) return cycleColor;
    if (p.isBot) return isHost ? () => cycleBotColor(p.id) : undefined;
    return connector.isOffline() ? undefined : () => onEmojiRowClick(p.id);
  }

  return (
    <>
      <div className="table-responsive">
        <Table striped borderless hover size="sm" className="mb-0">
          <thead>
            <tr>
              <th style={{ width: '1%' }} className="text-nowrap"></th>
              <th>Player</th>
              {hasBots && <th className="text-nowrap">Personality</th>}
              {hasBots && <th className="text-nowrap">Difficulty</th>}
              {isTeamDeathmatch && <th className="text-nowrap">Team</th>}
              {isHost && (
                <th style={{ width: '1%' }} className="text-nowrap"></th>
              )}
            </tr>
          </thead>
          <tbody>
            {slotRows.map((p, i) => {
              const onRowClick = rowClick(p);
              const rowStyle = p
                ? {
                    backgroundColor: playerColor(p.color),
                    color: contrastTextColor(playerColor(p.color)),
                    cursor: onRowClick ? 'pointer' : 'default',
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
                  role={onRowClick ? 'button' : undefined}
                  onClick={onRowClick}
                  style={{
                    height: 40,
                    outline: p?.id === selfId ? '2px solid #fff' : undefined,
                    outlineOffset: p?.id === selfId ? '-2px' : undefined,
                  }}
                >
                  <td
                    className="align-middle text-nowrap px-3"
                    style={rowStyle}
                  >
                    {i + 1}
                  </td>
                  <td className="align-middle" style={rowStyle}>
                    {p ? (
                      <span
                        ref={(el) => {
                          if (el) nameCellRefs.current.set(p.id, el);
                          else nameCellRefs.current.delete(p.id);
                        }}
                        className="d-inline-flex align-items-center gap-2 flex-wrap"
                      >
                        {p.id === selfId && !connector.isOffline() ? (
                          'You'
                        ) : setLocalPlayerName && i >= 1 && !p.isBot ? (
                          <span onClick={(e) => e.stopPropagation()}>
                            <PlayerNameEditor
                              player={p}
                              onNameChange={(name) =>
                                setLocalPlayerName(p.id, name)
                              }
                            />
                          </span>
                        ) : (
                          p.name
                        )}
                        {p.isBot && (
                          <img
                            src={
                              contrastTextColor(playerColor(p.color)) ===
                              '#ffffff'
                                ? (whiteBotIcon ?? '/icons/bot.svg')
                                : '/icons/bot.svg'
                            }
                            width={14}
                            height={14}
                            alt="Bot"
                            className="flex-shrink-0"
                          />
                        )}
                        {p.id !== selfId && isPlayerMuted(p.id) && (
                          <Tip text="Muted">
                            <img
                              src={
                                contrastTextColor(playerColor(p.color)) ===
                                '#ffffff'
                                  ? (whiteMutedIcon ?? '/icons/muted.svg')
                                  : '/icons/muted.svg'
                              }
                              width={14}
                              height={14}
                              alt="Muted"
                              className="flex-shrink-0"
                            />
                          </Tip>
                        )}
                        {p.id === game.hostId && (
                          <Badge bg="primary">Host</Badge>
                        )}
                      </span>
                    ) : isHost ? (
                      <span
                        onClick={(e) => e.stopPropagation()}
                        className="d-inline-flex gap-2"
                      >
                        {addLocalPlayer && (
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            onClick={addLocalPlayer}
                          >
                            Add Player
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          onClick={addBot}
                        >
                          Add Bot
                        </Button>
                      </span>
                    ) : (
                      <span className="text-muted">Empty</span>
                    )}
                  </td>
                  {hasBots && (
                    <td
                      className="align-middle"
                      style={rowStyle}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {p?.isBot &&
                        (isHost ? (
                          <Form.Select
                            size="sm"
                            className="w-auto"
                            value={p.botPersonality ?? 'balanced'}
                            onChange={(e) =>
                              setBotProfile(
                                p.id,
                                p.botDifficulty ?? 'easy',
                                e.target.value as BotPersonality,
                              )
                            }
                          >
                            {BOT_PERSONALITIES.map((value) => (
                              <option key={value} value={value}>
                                {BOT_PERSONALITY_LABELS[value]}
                              </option>
                            ))}
                          </Form.Select>
                        ) : (
                          p.botPersonality &&
                          BOT_PERSONALITY_LABELS[p.botPersonality]
                        ))}
                    </td>
                  )}
                  {hasBots && (
                    <td
                      className="align-middle"
                      style={rowStyle}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {p?.isBot &&
                        (isHost ? (
                          <Form.Select
                            size="sm"
                            className="w-auto"
                            value={p.botDifficulty ?? 'easy'}
                            onChange={(e) =>
                              setBotProfile(
                                p.id,
                                e.target.value as BotDifficulty,
                                p.botPersonality ?? 'balanced',
                              )
                            }
                          >
                            {BOT_DIFFICULTIES.map((value) => (
                              <option key={value} value={value}>
                                {BOT_DIFFICULTY_LABELS[value]}
                              </option>
                            ))}
                          </Form.Select>
                        ) : (
                          p.botDifficulty &&
                          BOT_DIFFICULTY_LABELS[p.botDifficulty]
                        ))}
                    </td>
                  )}
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
                        <Tip
                          text={
                            p ? (p.isBot ? 'Remove bot' : 'Kick/Ban') : 'Remove'
                          }
                        >
                          <Button
                            variant="danger"
                            className="d-inline-flex align-items-center justify-content-center"
                            style={{ width: 24, height: 24, padding: 0 }}
                            onClick={() =>
                              p?.isBot ? removeBot(p.id) : removeSlot(i)
                            }
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
                  colSpan={
                    2 + (hasBots ? 2 : 0) + (isTeamDeathmatch ? 1 : 0) + 1
                  }
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
      </div>
      {!connector.isOffline() && (
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
      )}
    </>
  );
}

export default PlayerRoster;
