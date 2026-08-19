import { useEffect, useRef, useState } from 'react';
import { Button } from 'react-bootstrap';
import {
  areAnimationsDisabled,
  toggleAnimationsDisabled,
} from '../game/animations';
import { useWhiteIcon } from './icon';
import ShareButton from './ShareButton';
import { isSoundMuted, toggleSoundMuted } from '../lib/sounds';

interface Props {
  shareUrl: string;
}

function SettingsMenu({ shareUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [, forceUpdate] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const whiteGearIcon = useWhiteIcon('/icons/gear.svg');
  const whiteSoundOnIcon = useWhiteIcon('/icons/sound-on.svg');
  const whiteSoundOffIcon = useWhiteIcon('/icons/sound-off.svg');
  const whiteAnimationOnIcon = useWhiteIcon('/icons/animation-on.svg');
  const whiteAnimationOffIcon = useWhiteIcon('/icons/animation-off.svg');

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

  if (!open) {
    return (
      <Button
        variant="secondary"
        size="sm"
        className="position-fixed top-0 start-0 m-3 d-flex align-items-center justify-content-center"
        style={{ zIndex: 1 }}
        onClick={() => setOpen(true)}
        title="Settings"
      >
        <img
          src={whiteGearIcon ?? '/icons/gear.svg'}
          width={16}
          height={16}
          alt="Settings"
        />
      </Button>
    );
  }

  return (
    <div
      ref={panelRef}
      className="position-fixed top-0 start-0 bg-body bg-opacity-75 border rounded p-2 m-3 d-flex gap-2"
      style={{ zIndex: 1 }}
    >
      <Button
        variant="secondary"
        size="sm"
        className="d-flex align-items-center justify-content-center"
        onClick={() => {
          toggleSoundMuted();
          forceUpdate((n) => n + 1);
        }}
        title={isSoundMuted() ? 'Unmute sounds' : 'Mute sounds'}
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
      <Button
        variant="secondary"
        size="sm"
        className="d-flex align-items-center justify-content-center"
        onClick={() => {
          toggleAnimationsDisabled();
          forceUpdate((n) => n + 1);
        }}
        title={
          areAnimationsDisabled() ? 'Enable animations' : 'Disable animations'
        }
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
      <ShareButton url={shareUrl} />
    </div>
  );
}

export default SettingsMenu;
