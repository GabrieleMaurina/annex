import { useEffect, useState } from 'react';

function matches(query: string): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia(query).matches
    : false;
}

function RotateDeviceOverlay() {
  const [portrait, setPortrait] = useState(() =>
    matches('(orientation: portrait)'),
  );
  const coarse = matches('(pointer: coarse)');

  useEffect(() => {
    const orientation = screen.orientation as
      (ScreenOrientation & { lock?: (o: string) => Promise<void> }) | undefined;
    orientation?.lock?.('landscape').catch(() => {});
    return () => {
      try {
        orientation?.unlock?.();
      } catch {}
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(orientation: portrait)');
    function onChange() {
      setPortrait(media.matches);
    }
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  if (!coarse || !portrait) return null;

  return (
    <div
      className="position-fixed top-0 bottom-0 start-0 end-0 bg-body d-flex flex-column justify-content-center align-items-center text-center gap-4 p-4"
      style={{ zIndex: 2000 }}
    >
      <style>{`
        @keyframes annexRotateHint {
          0%, 20% { transform: rotate(0deg); }
          60%, 100% { transform: rotate(-90deg); }
        }
      `}</style>
      <div
        className="border border-2 rounded-3"
        style={{
          width: 60,
          height: 100,
          animation: 'annexRotateHint 2s ease-in-out infinite alternate',
        }}
      />
      <h4 className="mb-0">Rotate your device to landscape to play</h4>
    </div>
  );
}

export default RotateDeviceOverlay;
