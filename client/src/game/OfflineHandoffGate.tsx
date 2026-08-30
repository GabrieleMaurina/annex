import { useEffect, useState } from 'react';
import { connector } from '../connector';
import { contrastTextColor, playerColor } from '../lib/palette';
import type { GameState } from '../lib/types';

interface Handoff {
  toName: string;
  color: number;
}

function Blackout({
  color,
  title,
  subtitle,
  onClick,
}: {
  color: number;
  title: string;
  subtitle: string;
  onClick?: () => void;
}) {
  const background = playerColor(color);
  return (
    <div
      role={onClick ? 'button' : undefined}
      onClick={onClick}
      className="position-fixed top-0 start-0 vw-100 vh-100 d-flex flex-column justify-content-center align-items-center"
      style={{
        zIndex: 3000,
        backgroundColor: background,
        color: contrastTextColor(background),
      }}
    >
      <h1 className="mb-3">{title}</h1>
      <p className="opacity-75">{subtitle}</p>
    </div>
  );
}

function OfflineHandoffGate({ game }: { game: GameState }) {
  const [handoff, setHandoff] = useState<Handoff | null>(null);

  useEffect(() => {
    function onHandoff(payload: Handoff) {
      setHandoff(payload);
    }
    connector.on('offline:handoff', onHandoff);
    return () => connector.off('offline:handoff', onHandoff);
  }, []);

  function proceed() {
    setHandoff(null);
    connector.continueHandoff();
  }

  if (handoff !== null) {
    return (
      <Blackout
        color={handoff.color}
        title={`Pass to ${handoff.toName}`}
        subtitle="Tap anywhere to continue"
        onClick={proceed}
      />
    );
  }

  const current =
    connector.isOffline() && game.state === 'playing' && game.fogOfWar === 'on'
      ? game.players[game.turnPlayerIndex]
      : undefined;

  if (!current?.isBot) return null;

  return (
    <Blackout
      color={current.color}
      title="Bot turn in progress"
      subtitle={`${current.name} is playing`}
    />
  );
}

export default OfflineHandoffGate;
