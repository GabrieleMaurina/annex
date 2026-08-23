import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button, Form, Toast, ToastContainer } from 'react-bootstrap';
import {
  areAnimationsDisabled,
  toggleAnimationsDisabled,
} from '../game/animations';
import { saveSettings } from '../lib/player';
import {
  getSoundVolume,
  isSoundMuted,
  setSoundVolume,
  toggleSoundMuted,
} from '../lib/sounds';
import { useWhiteIcon } from './icon';
import { PANEL_BG_CLASS, PANEL_CLASS } from './panelStyle';
import ShareButton from './ShareButton';
import Tip from './Tip';

interface Props {
  shareUrl: string;
}

function SettingsMenu({ shareUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [, forceUpdate] = useState(0);
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRowRef = useRef<HTMLDivElement>(null);
  const [buttonRowWidth, setButtonRowWidth] = useState<number>();

  const whiteGearIcon = useWhiteIcon('/icons/gear.svg');
  const whiteSoundOnIcon = useWhiteIcon('/icons/sound-on.svg');
  const whiteSoundOffIcon = useWhiteIcon('/icons/sound-off.svg');
  const whiteAnimationOnIcon = useWhiteIcon('/icons/animation-on.svg');
  const whiteAnimationOffIcon = useWhiteIcon('/icons/animation-off.svg');

  useLayoutEffect(() => {
    if (open) setButtonRowWidth(buttonRowRef.current?.offsetWidth);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div
      id="settings-toggle"
      className="position-fixed top-0 start-0 m-3"
      style={{ zIndex: 1 }}
    >
      {!open ? (
        <Tip text="Settings">
          <Button
            variant="secondary"
            size="sm"
            className="d-flex align-items-center justify-content-center"
            onClick={() => setOpen(true)}
          >
            <img
              src={whiteGearIcon ?? '/icons/gear.svg'}
              width={16}
              height={16}
              alt="Settings"
            />
          </Button>
        </Tip>
      ) : (
        <div
          ref={panelRef}
          className={`${PANEL_BG_CLASS} ${PANEL_CLASS} d-flex flex-column gap-2`}
        >
          <div className="d-flex gap-2" ref={buttonRowRef}>
            <Tip text={isSoundMuted() ? 'Unmute sounds' : 'Mute sounds'}>
              <Button
                variant="secondary"
                size="sm"
                className="d-flex align-items-center justify-content-center"
                onClick={() => {
                  toggleSoundMuted();
                  saveSettings();
                  forceUpdate((n) => n + 1);
                }}
              >
                <img
                  src={
                    isSoundMuted()
                      ? (whiteSoundOffIcon ?? '/icons/sound-off.svg')
                      : (whiteSoundOnIcon ?? '/icons/sound-on.svg')
                  }
                  width={16}
                  height={16}
                  alt="Sound"
                />
              </Button>
            </Tip>
            <Tip
              text={
                areAnimationsDisabled()
                  ? 'Enable animations'
                  : 'Disable animations'
              }
            >
              <Button
                variant="secondary"
                size="sm"
                className="d-flex align-items-center justify-content-center"
                onClick={() => {
                  toggleAnimationsDisabled();
                  saveSettings();
                  forceUpdate((n) => n + 1);
                }}
              >
                <img
                  src={
                    areAnimationsDisabled()
                      ? (whiteAnimationOffIcon ?? '/icons/animation-off.svg')
                      : (whiteAnimationOnIcon ?? '/icons/animation-on.svg')
                  }
                  width={16}
                  height={16}
                  alt="Animations"
                />
              </Button>
            </Tip>
            <ShareButton url={shareUrl} onCopied={() => setCopied(true)} />
          </div>
          <style>{`
            .annex-volume-range::-webkit-slider-runnable-track {
              background: linear-gradient(
                to right,
                #0d6efd var(--annex-volume-progress),
                var(--bs-secondary-bg) var(--annex-volume-progress)
              );
            }
            .annex-volume-range::-moz-range-track {
              background: var(--bs-secondary-bg);
            }
            .annex-volume-range::-moz-range-progress {
              height: 0.5rem;
              background: #0d6efd;
              border-radius: 1rem;
            }
          `}</style>
          <Tip text="Sound volume">
            <Form.Range
              className="annex-volume-range"
              min={0}
              max={1}
              step={0.01}
              value={getSoundVolume()}
              onChange={(e) => {
                setSoundVolume(Number(e.target.value));
                saveSettings();
                forceUpdate((n) => n + 1);
              }}
              style={
                {
                  width: buttonRowWidth ?? 0,
                  '--annex-volume-progress': `${getSoundVolume() * 100}%`,
                } as React.CSSProperties
              }
            />
          </Tip>
        </div>
      )}
      <ToastContainer
        position="top-center"
        className="position-fixed p-3"
        style={{ zIndex: 3 }}
      >
        <Toast
          show={copied}
          onClose={() => setCopied(false)}
          autohide
          delay={3000}
        >
          <Toast.Body>Link copied to clipboard!</Toast.Body>
        </Toast>
      </ToastContainer>
    </div>
  );
}

export default SettingsMenu;
