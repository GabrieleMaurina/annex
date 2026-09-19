import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useState } from 'react';
import { connector } from '../../../../connector';
import type { Ack } from '../../../../lib/types';
import type { GameToast } from '../../overlays/GameToasts';
import type { GameMapProps } from '../../props';

export function useNukeControls({
  game,
  roundNumber,
  turnPlayerIndex,
  turnPhase,
  paused,
  showReplay,
  setGame,
  isMyTurn,
  nukesOpen,
  setToasts,
}: Pick<
  GameMapProps,
  | 'game'
  | 'roundNumber'
  | 'turnPlayerIndex'
  | 'turnPhase'
  | 'paused'
  | 'showReplay'
  | 'setGame'
> & {
  isMyTurn: boolean;
  nukesOpen: boolean;
  setToasts: Dispatch<SetStateAction<GameToast[]>>;
}) {
  const [armedNuke, setArmedNuke] = useState<{
    mode: 'launch' | 'antiNuke';
    turnId: string;
  } | null>(null);
  const nukesEnabled = game.nukes === 'on';
  const nukeTurnId = `${roundNumber}-${turnPlayerIndex}`;
  const canUseNuke =
    nukesEnabled && isMyTurn && turnPhase === 'attack' && !paused;
  const nukeReady =
    canUseNuke && (game.arsenal.nukes > 0 || game.arsenal.antiNukes > 0);
  const nukeTargeting =
    canUseNuke && nukesOpen && armedNuke?.turnId === nukeTurnId
      ? armedNuke.mode
      : null;
  const setNukeTargeting = useCallback(
    (mode: 'launch' | 'antiNuke' | null) =>
      setArmedNuke(mode === null ? null : { mode, turnId: nukeTurnId }),
    [nukeTurnId],
  );

  const runNukeAck = useCallback(
    (res: Ack) => {
      if (res.ok) setGame(res.game);
      else
        setToasts((prev) => [...prev, { id: Date.now(), message: res.error }]);
    },
    [setGame, setToasts],
  );
  const buildNuke = useCallback(
    () => connector.buildNuke(runNukeAck),
    [runNukeAck],
  );
  const buildAntiNuke = useCallback(
    () => connector.buildAntiNuke(runNukeAck),
    [runNukeAck],
  );
  const advanceNuke = useCallback(
    (index: number) => connector.advanceNuke({ index }, runNukeAck),
    [runNukeAck],
  );
  const armNuke = useCallback(
    (mode: 'launch' | 'antiNuke') =>
      setArmedNuke((current) =>
        current?.mode === mode && current.turnId === nukeTurnId
          ? null
          : { mode, turnId: nukeTurnId },
      ),
    [nukeTurnId],
  );

  const nukes = !nukesEnabled
    ? null
    : showReplay
      ? {
          open: nukesOpen,
          paused: true,
          targeting: null,
          onBuildNuke: () => {},
          onBuildAntiNuke: () => {},
          onAdvanceNuke: () => {},
          onArmNuke: () => {},
        }
      : {
          open: nukesOpen,
          paused,
          targeting: nukeTargeting,
          onBuildNuke: buildNuke,
          onBuildAntiNuke: buildAntiNuke,
          onAdvanceNuke: advanceNuke,
          onArmNuke: armNuke,
        };

  return { nukeReady, nukeTargeting, setNukeTargeting, nukes };
}
