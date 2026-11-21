import { useCallback, useEffect } from 'react';
import { pulseZombie } from '../../../../common/icons/zombiePulse';
import { connector } from '../../../../connector';
import { playSound } from '../../../../lib/sounds';
import type { ReplayAnimation } from '../../../../lib/types';
import { startAnimation } from '../../../animations';

type Deposit = { territoryId: number; troops: number };
type InfectedPayload = {
  territoryId: number;
  respawn: boolean;
};
type MassFrame = Extract<ReplayAnimation, { type: 'deployMany' | 'infect' }>;

export function useMassDeployEvents({
  zombieId,
  findPosition,
  adjustTerritoryTroops,
  animateAdd,
  staggerTroops,
  startAnimationLoop,
}: {
  zombieId: number | null;
  findPosition: (id: number) => { x: number; y: number } | undefined;
  adjustTerritoryTroops: (
    deltas: { territoryId: number; delta: number }[],
  ) => void;
  animateAdd: (payload: Deposit) => void;
  staggerTroops: (territoryIds: number[], play: () => void) => void;
  startAnimationLoop: () => void;
}) {
  const deployMany = useCallback(
    (deposits: Deposit[], playerId: number, surge: boolean, live: boolean) => {
      const zombie = playerId === zombieId;
      if (!zombie) playSound('deploy');
      else playSound(surge ? 'zombieSurge' : 'zombieDeploy');
      for (const deposit of deposits) {
        const show = () => {
          animateAdd(deposit);
          const position = zombie
            ? findPosition(deposit.territoryId)
            : undefined;
          if (position) startAnimation('spawn', position.x, position.y);
        };
        if (live && zombie) staggerTroops([deposit.territoryId], show);
        else show();
      }
      if (live)
        adjustTerritoryTroops(
          deposits.map((d) => ({
            territoryId: d.territoryId,
            delta: d.troops,
          })),
        );
      if (zombie) pulseZombie();
      startAnimationLoop();
    },
    [
      zombieId,
      findPosition,
      adjustTerritoryTroops,
      animateAdd,
      staggerTroops,
      startAnimationLoop,
    ],
  );

  const infect = useCallback(
    (payload: InfectedPayload) => {
      playSound(payload.respawn ? 'zombieRespawn' : 'zombieInfect');
      const position = findPosition(payload.territoryId);
      if (position) startAnimation('infect', position.x, position.y);
      pulseZombie();
      startAnimationLoop();
    },
    [findPosition, startAnimationLoop],
  );

  useEffect(() => {
    function onDeployedMany(payload: {
      deposits: Deposit[];
      playerId: number;
      surge?: boolean;
    }) {
      deployMany(payload.deposits, payload.playerId, !!payload.surge, true);
    }
    connector.on('game:deployedMany', onDeployedMany);
    connector.on('game:infected', infect);
    return () => {
      connector.off('game:deployedMany', onDeployedMany);
      connector.off('game:infected', infect);
    };
  }, [deployMany, infect]);

  return useCallback(
    (frame: MassFrame) => {
      if (frame.type === 'infect') infect(frame);
      else deployMany(frame.deposits, frame.playerId, !!frame.surge, false);
    },
    [deployMany, infect],
  );
}
