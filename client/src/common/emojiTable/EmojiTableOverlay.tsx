import { useReducer } from 'react';
import {
  ATTACK_EMOJI,
  EMOJI_LABELS,
  EMOJI_POP_DURATION,
  EMOJIS,
  GLOBAL_TARGET_ID,
} from '../../game/logic/emoji';
import type { EmojiValue } from '../../lib/types';
import { useWhiteIcon } from '../icon';
import { isPlayerMuted, toggleMutePlayer } from '../mutedPlayers';
import { PANEL_BG_CLASS } from '../panelStyle';
import Tip from '../Tip';
import type { TableEmojiPop } from './useTableEmojiReactions';

const PICKABLE_EMOJIS = EMOJIS.filter((emoji) => emoji !== ATTACK_EMOJI);
const NAME_GAP = 8;

interface Props {
  emojiPickerFor: number | null;
  emojiPops: TableEmojiPop[];
  rowRefs: React.RefObject<Map<number, HTMLElement>>;
  nameCellRefs: React.RefObject<Map<number, HTMLElement>>;
  emojiPickerRef: React.RefObject<HTMLDivElement | null>;
  onPick: (targetPlayerId: number, emoji: EmojiValue) => void;
}

function EmojiTableOverlay({
  emojiPickerFor,
  emojiPops,
  rowRefs,
  nameCellRefs,
  emojiPickerRef,
  onPick,
}: Props) {
  const whiteGlobeIcon = useWhiteIcon('/icons/globe.svg');
  const whiteMutedIcon = useWhiteIcon('/icons/muted.svg');
  const whiteUnmutedIcon = useWhiteIcon('/icons/unmuted.svg');
  const [, bumpMuteVersion] = useReducer((c) => c + 1, 0);

  return (
    <>
      {emojiPickerFor !== null &&
        (() => {
          const rowRect = rowRefs.current
            .get(emojiPickerFor)
            ?.getBoundingClientRect();
          const nameRect = nameCellRefs.current
            .get(emojiPickerFor)
            ?.getBoundingClientRect();
          if (!rowRect || !nameRect) return null;
          return (
            <div
              ref={emojiPickerRef}
              className={`position-fixed ${PANEL_BG_CLASS} border rounded d-flex align-items-center`}
              style={{
                top: rowRect.top,
                left: nameRect.right + NAME_GAP,
                height: rowRect.height,
                width: 'fit-content',
                padding: 0,
                zIndex: 3,
              }}
            >
              {PICKABLE_EMOJIS.map((emoji) => (
                <Tip key={emoji} text={EMOJI_LABELS[emoji]} placement="bottom">
                  <button
                    type="button"
                    className="border-0 bg-transparent d-inline-flex align-items-center justify-content-center lh-1"
                    style={{ fontSize: 24, padding: '3px 2px 5px 2px' }}
                    data-no-click-sound
                    onClick={() => onPick(emojiPickerFor, emoji)}
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
                    className="border-0 border-start d-inline-flex align-items-center justify-content-center lh-1"
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
            </div>
          );
        })()}
      {emojiPops.map((pop) => {
        const rowRect = rowRefs.current
          .get(pop.rowPlayerId)
          ?.getBoundingClientRect();
        const nameRect = nameCellRefs.current
          .get(pop.rowPlayerId)
          ?.getBoundingClientRect();
        if (!rowRect || !nameRect) return null;
        return (
          <div
            key={pop.id}
            className="position-fixed"
            style={{
              top: rowRect.top,
              left: nameRect.right + NAME_GAP,
              height: rowRect.height,
              width: 'fit-content',
              zIndex: 3,
              pointerEvents: 'none',
              overflow: 'hidden',
            }}
          >
            <style>{`
              @keyframes annexTableEmojiPop {
                0% { opacity: 0; }
                20% { opacity: 1; }
                80% { opacity: 1; }
                100% { opacity: 0; }
              }
            `}</style>
            <div
              className={`${PANEL_BG_CLASS} border rounded d-flex align-items-center gap-1 h-100`}
              style={{
                padding: 0,
                animation: `annexTableEmojiPop ${EMOJI_POP_DURATION}ms ease-out forwards`,
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
            </div>
          </div>
        );
      })}
    </>
  );
}

export default EmojiTableOverlay;
