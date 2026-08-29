import { useEffect, useState } from 'react';
import { connector } from '../connector';
import { contrastTextColor, playerColor } from '../lib/palette';

interface Handoff {
  toName: string;
  color: number;
}

function OfflineHandoffGate() {
  const [handoff, setHandoff] = useState<Handoff | null>(null);

  useEffect(() => {
    function onHandoff(payload: Handoff) {
      setHandoff(payload);
    }
    connector.on('offline:handoff', onHandoff);
    return () => connector.off('offline:handoff', onHandoff);
  }, []);

  if (handoff === null) return null;

  function proceed() {
    setHandoff(null);
    connector.continueHandoff();
  }

  const background = playerColor(handoff.color);

  return (
    <div
      role="button"
      onClick={proceed}
      className="position-fixed top-0 start-0 vw-100 vh-100 d-flex flex-column justify-content-center align-items-center"
      style={{
        zIndex: 3000,
        backgroundColor: background,
        color: contrastTextColor(background),
      }}
    >
      <h1 className="mb-3">Pass to {handoff.toName}</h1>
      <p className="opacity-75">Tap anywhere to continue</p>
    </div>
  );
}

export default OfflineHandoffGate;
