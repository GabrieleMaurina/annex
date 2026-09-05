import type { RefObject } from 'react';
import Tip from '../../../common/Tip';
import { isPlayerMuted, toggleMutePlayer } from '../../../common/mutedPlayers';
import { PANEL_BG_CLASS } from '../../../common/panelStyle';
import type { EmojiValue, GameState } from '../../../lib/types';
import {
  ATTACK_EMOJI,
  EMOJI_LABELS,
  EMOJI_PANEL_EDGE_OFFSET,
  EMOJI_POP_DURATION,
  EMOJIS,
  GLOBAL_TARGET_ID,
  type EmojiPop,
} from '../../logic/emoji';
import type { Point } from '../helpers';

interface EmojiFlight {
  id: number;
  emoji: EmojiValue;
  from: Point;
  to: Point;
  totalDuration: number;
  travelPercent: number;
}

export default function EmojiOverlay({
  emojiPickerFor,
  rowRefs,
  emojiPickerRef,
  size,
  handleEmojiPick,
  whiteMutedIcon,
  whiteUnmutedIcon,
  whiteGlobeIcon,
  emojiPops,
  emojiFlights,
  bumpMuteVersion,
  gameEnded,
  players,
  navigate,
}: {
  emojiPickerFor: number | null;
  rowRefs: RefObject<Map<number, HTMLElement>>;
  emojiPickerRef: RefObject<HTMLDivElement | null>;
  size: { w: number; h: number };
  handleEmojiPick: (targetPlayerId: number, emoji: EmojiValue) => void;
  whiteMutedIcon: string | undefined;
  whiteUnmutedIcon: string | undefined;
  whiteGlobeIcon: string | undefined;
  emojiPops: EmojiPop[];
  emojiFlights: EmojiFlight[];
  bumpMuteVersion: () => void;
  gameEnded: boolean;
  players: GameState['players'];
  navigate: (path: string) => void;
}) {
  const pickerRect =
    emojiPickerFor !== null
      ? rowRefs.current.get(emojiPickerFor)?.getBoundingClientRect()
      : undefined;
  const pickerPlayer =
    emojiPickerFor !== null
      ? players.find((p) => p.id === emojiPickerFor)
      : undefined;

  return (
    <>
      {emojiPickerFor !== null && pickerRect && (
        <div
          ref={emojiPickerRef}
          className={`position-fixed ${PANEL_BG_CLASS} border rounded-start d-flex align-items-center`}
          style={{
            top: pickerRect.top + pickerRect.height / 2,
            right: size.w - pickerRect.left + EMOJI_PANEL_EDGE_OFFSET,
            width: 'fit-content',
            padding: 0,
            transform: 'translateY(-50%)',
            zIndex: 3,
          }}
        >
          <style>{`
            .annex-emoji-btn:hover {
              background-color: rgba(127, 127, 127, 0.35) !important;
              border-radius: 4px;
            }
          `}</style>
          {(emojiPickerFor === GLOBAL_TARGET_ID
            ? EMOJIS.filter((emoji) => emoji !== ATTACK_EMOJI)
            : EMOJIS
          ).map((emoji) => (
            <Tip key={emoji} text={EMOJI_LABELS[emoji]} placement="bottom">
              <button
                type="button"
                className="annex-emoji-btn border-0 bg-transparent d-inline-flex align-items-center justify-content-center lh-1"
                style={{
                  fontSize: 24,
                  padding: '3px 2px 5px 2px',
                }}
                data-no-click-sound
                onClick={() => handleEmojiPick(emojiPickerFor, emoji)}
              >
                {emoji}
              </button>
            </Tip>
          ))}
          {emojiPickerFor !== GLOBAL_TARGET_ID && (
            <Tip
              text={isPlayerMuted(emojiPickerFor) ? 'Unmute' : 'Mute'}
              placement="bottom"
            >
              <button
                type="button"
                className="annex-emoji-btn border-0 border-start d-inline-flex align-items-center justify-content-center lh-1"
                style={{
                  fontSize: 24,
                  padding: '3px 2px 5px 2px',
                  backgroundColor: 'rgba(180, 180, 180, 0.35)',
                  borderRadius: 4,
                }}
                onClick={() => {
                  toggleMutePlayer(emojiPickerFor);
                  bumpMuteVersion();
                }}
              >
                <img
                  src={
                    (isPlayerMuted(emojiPickerFor)
                      ? whiteMutedIcon
                      : whiteUnmutedIcon) ??
                    (isPlayerMuted(emojiPickerFor)
                      ? '/icons/muted.svg'
                      : '/icons/unmuted.svg')
                  }
                  width={20}
                  height={20}
                  alt={isPlayerMuted(emojiPickerFor) ? 'Muted' : 'Unmuted'}
                />
              </button>
            </Tip>
          )}
          {gameEnded && pickerPlayer?.userId && (
            <Tip text="View profile" placement="bottom">
              <button
                type="button"
                className="annex-emoji-btn border-0 border-start d-inline-flex align-items-center justify-content-center lh-1"
                style={{
                  fontSize: 24,
                  padding: '3px 2px 5px 2px',
                  backgroundColor: 'rgba(180, 180, 180, 0.35)',
                  borderRadius: 4,
                }}
                onClick={() =>
                  navigate(`/players/${encodeURIComponent(pickerPlayer.name)}`)
                }
              >
                🧑
              </button>
            </Tip>
          )}
        </div>
      )}
      {emojiPops.map((pop) => {
        const rect = rowRefs.current
          .get(pop.rowPlayerId)
          ?.getBoundingClientRect();
        if (!rect) return null;
        return (
          <div
            key={pop.id}
            className="position-fixed"
            style={{
              top: rect.top + rect.height / 2,
              right: size.w - rect.left + EMOJI_PANEL_EDGE_OFFSET,
              width: 'fit-content',
              zIndex: 3,
              pointerEvents: 'none',
              overflow: 'hidden',
              transform: 'translateY(-50%)',
            }}
          >
            <style>{`
              @keyframes annexEmojiPop {
                0% { transform: translateX(100%); opacity: 0; }
                20% { transform: translateX(0); opacity: 1; }
                80% { transform: translateX(0); opacity: 1; }
                100% { transform: translateX(0); opacity: 0; }
              }
            `}</style>
            <div
              className={`${PANEL_BG_CLASS} border rounded-start d-flex align-items-center gap-1`}
              style={{
                padding: 0,
                animation: `annexEmojiPop ${EMOJI_POP_DURATION}ms ease-out forwards`,
              }}
            >
              <Tip text={EMOJI_LABELS[pop.emoji]} placement="bottom">
                <span
                  className="d-inline-flex align-items-center justify-content-center lh-1"
                  style={{
                    fontSize: 24,
                    padding: '3px 2px 5px 2px',
                    pointerEvents: 'auto',
                  }}
                >
                  {pop.emoji}
                </span>
              </Tip>
              {pop.global && (
                <Tip text="Sent to everyone" placement="bottom">
                  <img
                    src={whiteGlobeIcon ?? '/icons/globe.svg'}
                    width={14}
                    height={14}
                    alt="Everyone"
                    className="me-1 flex-shrink-0"
                    style={{ pointerEvents: 'auto' }}
                  />
                </Tip>
              )}
              {pop.attackText && (
                <strong
                  className="text-truncate"
                  style={{ color: pop.attackColor, fontSize: 14 }}
                >
                  {pop.attackText}
                </strong>
              )}
            </div>
          </div>
        );
      })}
      {emojiFlights.map((flight) => (
        <div
          key={flight.id}
          className="position-fixed"
          style={
            {
              left: flight.from.x,
              top: flight.from.y,
              fontSize: 28,
              zIndex: 3,
              pointerEvents: 'none',
              transform: 'translate(-50%, -50%)',
              animation: `annexEmojiFlight-${flight.id} ${flight.totalDuration}ms linear forwards`,
              '--annex-emoji-dx': `${flight.to.x - flight.from.x}px`,
              '--annex-emoji-dy': `${flight.to.y - flight.from.y}px`,
            } as React.CSSProperties
          }
        >
          <style>{`
            @keyframes annexEmojiFlight-${flight.id} {
              0% { transform: translate(-50%, -50%); opacity: 1; }
              ${flight.travelPercent}% { transform: translate(calc(-50% + var(--annex-emoji-dx)), calc(-50% + var(--annex-emoji-dy))); opacity: 1; }
              95% { transform: translate(calc(-50% + var(--annex-emoji-dx)), calc(-50% + var(--annex-emoji-dy))); opacity: 1; }
              100% { transform: translate(calc(-50% + var(--annex-emoji-dx)), calc(-50% + var(--annex-emoji-dy))); opacity: 0; }
            }
          `}</style>
          {flight.emoji}
        </div>
      ))}
    </>
  );
}
