import type { PointerEvent as ReactPointerEvent } from 'react';
import { Badge, Button, Table } from 'react-bootstrap';
import Flag from '../../common/badges/Flag';
import RankIcon from '../../common/badges/RankIcon';
import { useWhiteIcon } from '../../common/icon';
import WhiteIcon from '../../common/icons/WhiteIcon';
import PlayerNameEditor from '../../common/inputs/PlayerNameEditor';
import { isPlayerMuted } from '../../common/mutedPlayers';
import Tip from '../../common/tooltips/Tip';
import { connector } from '../../connector';
import { contrastTextColor, playerColor } from '../../lib/palette';
import type { BotDifficulty, BotPersonality, GameState } from '../../lib/types';
import {
  CURSOR_DEFAULT,
  CURSOR_GRAB,
  CURSOR_POINTER,
} from '../../ui/cursors/cursors';
import { GAP } from '../../ui/dnd/dragDrop';
import Selector from '../../ui/forms/Selector';
import {
  BOT_DIFFICULTIES,
  BOT_DIFFICULTY_LABELS,
  BOT_PERSONALITIES,
  BOT_PERSONALITY_LABELS,
} from '../botOptions';
import type { RosterProps } from '../PlayerRoster';
import { MAX_SLOTS, MIN_SLOTS } from './teamLayout';

type Player = GameState['players'][number];

interface Props {
  roster: RosterProps;
  rows: (Player | null | typeof GAP)[];
  team?: number;
  addSlot: () => void;
  removeEmptySlot: () => void;
  startDrag?: (e: ReactPointerEvent, player: Player) => void;
  register?: (key: string) => (el: HTMLElement | null) => void;
  draggingId?: number;
}

function RosterTable({
  roster,
  rows,
  team,
  addSlot,
  removeEmptySlot,
  startDrag,
  register,
  draggingId,
}: Props) {
  const {
    game,
    isHost,
    selfId,
    cycleColor,
    cycleBotColor,
    addBot,
    addLocalPlayer,
    setLocalPlayerName,
    cycleLocalPlayerColor,
    setBotProfile,
    removeBot,
    removePlayer,
    rowRefs,
    nameCellRefs,
    onEmojiRowClick,
  } = roster;
  const whiteBotIcon = useWhiteIcon('/icons/bot.svg');
  const whiteMutedIcon = useWhiteIcon('/icons/muted.svg');
  const hasBots = game.players.some((p) => p.isBot);
  const draggable = isHost && team !== undefined;

  function rowClick(p: Player | null) {
    if (!p) return undefined;
    if (p.id === selfId) return cycleColor;
    if (p.isBot) return isHost ? () => cycleBotColor(p.id) : undefined;
    if (connector.isOffline())
      return cycleLocalPlayerColor
        ? () => cycleLocalPlayerColor(p.id)
        : undefined;
    return () => onEmojiRowClick(p.id);
  }

  return (
    <div className="table-responsive">
      <Table
        striped
        borderless
        hover
        size="sm"
        className={`mb-0${team !== undefined ? ' table-flat' : ''}`}
      >
        <thead>
          <tr>
            <th style={{ width: '1%' }} className="text-nowrap"></th>
            <th>Player</th>
            {hasBots && <th className="text-nowrap">Personality</th>}
            {hasBots && <th className="text-nowrap">Difficulty</th>}
            {isHost && (
              <th style={{ width: '1%' }} className="text-nowrap"></th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            if (row === GAP)
              return (
                <tr key="gap" ref={register?.('gap')} style={{ height: 40 }}>
                  <td colSpan={2 + (hasBots ? 2 : 0) + 1} className="p-1">
                    <div
                      className="rounded h-100"
                      style={{ border: '2px dashed var(--bs-primary)' }}
                    />
                  </td>
                </tr>
              );
            const p = row;
            const key = p ? `p${p.id}` : `e${team}-${i}`;
            const setGlideRef = register?.(key);
            const onRowClick = rowClick(p);
            const rowStyle = p
              ? {
                  backgroundColor: playerColor(p.color),
                  color: contrastTextColor(playerColor(p.color)),
                  cursor: onRowClick
                    ? CURSOR_POINTER
                    : draggable
                      ? CURSOR_GRAB
                      : CURSOR_DEFAULT,
                }
              : undefined;
            return (
              <tr
                key={key}
                ref={(el) => {
                  setGlideRef?.(el);
                  if (!p) return;
                  if (el) rowRefs.current.set(p.id, el);
                  else rowRefs.current.delete(p.id);
                }}
                role={onRowClick ? 'button' : undefined}
                onClick={onRowClick}
                onPointerDown={(e) => {
                  if (
                    !p ||
                    !startDrag ||
                    (e.target as Element).closest('button')
                  )
                    return;
                  startDrag(e, p);
                }}
                style={{
                  height: 40,
                  outline: p?.id === selfId ? '2px solid #fff' : undefined,
                  outlineOffset: p?.id === selfId ? '-2px' : undefined,
                  touchAction: startDrag && p ? 'none' : undefined,
                  opacity: p && draggingId === p.id ? 0.35 : undefined,
                }}
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
                      className="d-inline-flex align-items-center gap-2 flex-wrap"
                    >
                      <RankIcon elo={p.elo} />
                      <Flag country={p.country} />
                      {p.id === selfId && !connector.isOffline() ? (
                        'You'
                      ) : setLocalPlayerName &&
                        p.id !== game.hostId &&
                        !p.isBot ? (
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
                        <Badge bg="primary" text="dark">
                          Host
                        </Badge>
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
                          variant="success"
                          onClick={() => addLocalPlayer(team)}
                        >
                          Add Player
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => addBot(team)}
                      >
                        Add Bot
                      </Button>
                    </span>
                  ) : (
                    <span className="text-muted">Empty</span>
                  )}
                </td>
                {hasBots && (
                  <td className="align-middle" style={rowStyle}>
                    {p?.isBot &&
                      (isHost ? (
                        <span
                          className="d-inline-block"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Selector
                            size="sm"
                            className="w-auto"
                            value={p.botPersonality ?? 'random'}
                            onChange={(value) =>
                              setBotProfile(
                                p.id,
                                p.botDifficulty ?? 'easy',
                                value as BotPersonality | 'random',
                              )
                            }
                          >
                            {BOT_PERSONALITIES.map((value) => (
                              <option key={value} value={value}>
                                {BOT_PERSONALITY_LABELS[value]}
                              </option>
                            ))}
                          </Selector>
                        </span>
                      ) : (
                        p.botPersonality &&
                        BOT_PERSONALITY_LABELS[p.botPersonality]
                      ))}
                  </td>
                )}
                {hasBots && (
                  <td className="align-middle" style={rowStyle}>
                    {p?.isBot &&
                      (isHost ? (
                        <span
                          className="d-inline-block"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Selector
                            size="sm"
                            className="w-auto"
                            value={p.botDifficulty ?? 'easy'}
                            onChange={(value) =>
                              setBotProfile(
                                p.id,
                                value as BotDifficulty | 'random',
                                p.botPersonality ?? 'random',
                              )
                            }
                          >
                            {BOT_DIFFICULTIES.map((value) => (
                              <option key={value} value={value}>
                                {BOT_DIFFICULTY_LABELS[value]}
                              </option>
                            ))}
                          </Selector>
                        </span>
                      ) : (
                        p.botDifficulty &&
                        BOT_DIFFICULTY_LABELS[p.botDifficulty]
                      ))}
                  </td>
                )}
                {isHost && (
                  <td className="text-nowrap align-middle" style={rowStyle}>
                    {p?.id !== selfId && (
                      <span
                        className="d-inline-block"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Tip
                          text={
                            p
                              ? p.isBot
                                ? 'Remove bot'
                                : connector.isOffline()
                                  ? 'Remove player'
                                  : 'Kick/Ban'
                              : 'Remove'
                          }
                        >
                          <Button
                            variant="danger"
                            className="d-inline-flex align-items-center justify-content-center"
                            style={{ width: 24, height: 24, padding: 0 }}
                            onClick={() =>
                              p
                                ? p.isBot
                                  ? removeBot(p.id)
                                  : removePlayer(p.id)
                                : removeEmptySlot()
                            }
                            disabled={
                              !p &&
                              (game.slots <= MIN_SLOTS ||
                                (team !== undefined && rows.length <= 1))
                            }
                          >
                            <WhiteIcon path="/icons/close.svg" size={12} />
                          </Button>
                        </Tip>
                      </span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
          {isHost && (
            <tr>
              <td
                colSpan={2 + (hasBots ? 2 : 0) + 1}
                className="text-center align-middle"
              >
                <Tip text="Add slot" placement="bottom">
                  <Button
                    size="sm"
                    variant="success"
                    onClick={addSlot}
                    disabled={game.slots >= MAX_SLOTS}
                  >
                    <WhiteIcon path="/icons/plus.svg" size={14} />
                  </Button>
                </Tip>
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}

export default RosterTable;
