import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { Button, Form } from 'react-bootstrap';
import {
  areAnimationsDisabled,
  toggleAnimationsDisabled,
} from '../../game/animations';
import { isTypingTarget } from '../../game/GameMap/helpers';
import { pushSettings } from '../../lib/player';
import {
  getCurrentTrack,
  getEffectsVolume,
  getMusicVersion,
  getMusicVolume,
  getSoundVolume,
  isSoundMuted,
  nextTrack,
  previousTrack,
  setEffectsVolume,
  setMusicVolume,
  setSoundVolume,
  subscribeMusic,
  toggleSoundMuted,
  useToggleSound,
} from '../../lib/sounds';
import { titleCase } from '../../lobby/settings/gameSettings';
import { useWhiteIcon } from '../icon';
import { PANEL_BG_CLASS, PANEL_CLASS } from '../panelStyle';
import Tip from '../tooltips/Tip';
import SharePageButton from './SharePageButton';

interface VolumeRangeProps {
  tip: string;
  value: number;
  onChange: (value: number) => void;
}

function VolumeRange({ tip, value, onChange }: VolumeRangeProps) {
  return (
    <Tip text={tip}>
      <Form.Range
        className="annex-volume-range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={
          {
            '--annex-volume-progress': `${value * 100}%`,
          } as React.CSSProperties
        }
      />
    </Tip>
  );
}

interface IconButtonProps {
  tip: string;
  icon: string;
  active?: boolean;
  onClick: () => void;
}

function IconButton({ tip, icon, active, onClick }: IconButtonProps) {
  const whiteIcon = useWhiteIcon(icon);
  return (
    <Tip text={tip}>
      <Button
        variant="secondary"
        size="sm"
        className="d-flex align-items-center justify-content-center"
        active={active}
        onClick={onClick}
      >
        <img src={whiteIcon ?? icon} width={16} height={16} alt={tip} />
      </Button>
    </Tip>
  );
}

function trackTitle(track: string): string {
  const file = track.slice(track.lastIndexOf('/') + 1).replace(/\.mp3$/, '');
  return file
    .split('_')
    .map((part) => titleCase(part.replaceAll('-', ' ')))
    .join(' - ');
}

interface Props {
  hidden?: boolean;
  onOpenChange?: (open: boolean) => void;
  lockScrollOnFullscreen?: boolean;
}

function SettingsMenu({ hidden, onOpenChange, lockScrollOnFullscreen }: Props) {
  const [open, setOpen] = useState(false);
  useToggleSound(open);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);
  const [, forceUpdate] = useState(0);
  const [mixerOpen, setMixerOpen] = useState(false);
  useSyncExternalStore(subscribeMusic, getMusicVersion);
  const currentTrack = getCurrentTrack();
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRowRef = useRef<HTMLDivElement>(null);
  const [buttonRowWidth, setButtonRowWidth] = useState<number>();

  const whiteGearIcon = useWhiteIcon('/icons/gear.svg');
  const whiteSoundOnIcon = useWhiteIcon('/icons/sound-on.svg');
  const whiteSoundOffIcon = useWhiteIcon('/icons/sound-off.svg');
  const whiteAnimationOnIcon = useWhiteIcon('/icons/animation-on.svg');
  const whiteAnimationOffIcon = useWhiteIcon('/icons/animation-off.svg');
  const whiteFullscreenIcon = useWhiteIcon('/icons/fullscreen.svg');
  const whiteNotFullscreenIcon = useWhiteIcon('/icons/not_fullscreen.svg');

  const [isFullscreen, setIsFullscreen] = useState(
    !!document.fullscreenElement,
  );

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!lockScrollOnFullscreen) return;
    document.body.classList.toggle('overflow-hidden', isFullscreen);
    return () => document.body.classList.remove('overflow-hidden');
  }, [isFullscreen, lockScrollOnFullscreen]);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement
        .requestFullscreen()
        .then(() => {
          const orientation = screen.orientation as
            | (ScreenOrientation & { lock?: (o: string) => Promise<void> })
            | undefined;
          orientation?.lock?.('landscape').catch(() => {});
        })
        .catch(() => {});
    }
  }

  function changeVolume(setVolume: (value: number) => void) {
    return (value: number) => {
      setVolume(value);
      pushSettings();
      forceUpdate((n) => n + 1);
    };
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target))
        return;
      if (e.key.toLowerCase() === 'o') setOpen((prev) => !prev);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

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
      className={`position-fixed top-0 start-0 m-3${
        hidden && !open ? ' invisible' : ''
      }`}
      style={{ zIndex: 1 }}
    >
      {!open ? (
        <Tip text="Settings">
          <Button
            variant="secondary"
            size="sm"
            className="d-flex align-items-center justify-content-center"
            style={{ width: 28, height: 28, padding: 0 }}
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
          onClick={(e) => {
            if (e.target !== e.currentTarget) return;
            setOpen(false);
          }}
        >
          <div className="d-flex gap-2" ref={buttonRowRef}>
            <Tip text={isSoundMuted() ? 'Unmute sounds' : 'Mute sounds'}>
              <Button
                variant="secondary"
                size="sm"
                className="d-flex align-items-center justify-content-center"
                onClick={() => {
                  toggleSoundMuted();
                  pushSettings();
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
                  pushSettings();
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
            <Tip text={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
              <Button
                variant="secondary"
                size="sm"
                className="d-flex align-items-center justify-content-center"
                onClick={toggleFullscreen}
              >
                <img
                  src={
                    isFullscreen
                      ? (whiteNotFullscreenIcon ?? '/icons/not_fullscreen.svg')
                      : (whiteFullscreenIcon ?? '/icons/fullscreen.svg')
                  }
                  width={16}
                  height={16}
                  alt="Fullscreen"
                />
              </Button>
            </Tip>
            <SharePageButton
              title={document.title}
              path={`${window.location.pathname}${window.location.search}`}
              tooltip="Share Annex with friends"
              size="sm"
            />
          </div>
          <style>{`
            .annex-volume-range::-webkit-slider-runnable-track {
              background: linear-gradient(
                to right,
                var(--bs-primary) var(--annex-volume-progress),
                var(--bs-secondary-bg) var(--annex-volume-progress)
              );
            }
            .annex-volume-range::-moz-range-track {
              background: var(--bs-secondary-bg);
            }
            .annex-volume-range::-moz-range-progress {
              height: 0.5rem;
              background: var(--bs-primary);
              border-radius: 1rem;
            }
          `}</style>
          <div
            className="d-flex flex-column gap-1"
            style={{ width: buttonRowWidth ?? 0 }}
          >
            <div className="d-flex align-items-center gap-2">
              <VolumeRange
                tip="Master volume"
                value={getSoundVolume()}
                onChange={changeVolume(setSoundVolume)}
              />
              <IconButton
                tip={mixerOpen ? 'Hide volume mixer' : 'Show volume mixer'}
                icon="/icons/sliders.svg"
                active={mixerOpen}
                onClick={() => setMixerOpen((prev) => !prev)}
              />
            </div>
            {mixerOpen && (
              <>
                <div className="small">Sound effects</div>
                <VolumeRange
                  tip="Sound effects volume"
                  value={getEffectsVolume()}
                  onChange={changeVolume(setEffectsVolume)}
                />
                <div className="small">Music</div>
                <VolumeRange
                  tip="Music volume"
                  value={getMusicVolume()}
                  onChange={changeVolume(setMusicVolume)}
                />
              </>
            )}
            {currentTrack && (
              <>
                <Tip text={trackTitle(currentTrack)}>
                  <div className="small text-truncate">
                    {trackTitle(currentTrack)}
                  </div>
                </Tip>
                <div className="d-flex justify-content-center gap-2">
                  <IconButton
                    tip="Previous song"
                    icon="/icons/skip-back.svg"
                    onClick={previousTrack}
                  />
                  <IconButton
                    tip="Next song"
                    icon="/icons/skip-forward.svg"
                    onClick={nextTrack}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsMenu;
