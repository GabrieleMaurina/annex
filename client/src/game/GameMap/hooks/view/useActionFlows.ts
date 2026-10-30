import type { GameMapProps } from '../../props';
import { useAttackSeaFlow } from '../sea/useAttackSeaFlow';
import { useSailFlow } from '../sea/useSailFlow';
import { useAttackFlow } from '../useAttackFlow';
import { useTurnActionFlows } from '../useTurnActionFlows';

type AttackParams = Parameters<typeof useAttackFlow>[0];
type SailParams = Parameters<typeof useSailFlow>[0];
type AttackSeaParams = Parameters<typeof useAttackSeaFlow>[0];
type TurnParams = Parameters<typeof useTurnActionFlows>[0];

export function useActionFlows({
  attackStartTerritoryId,
  attackEndTerritoryId,
  attackConquestMinTroops,
  sailStartTerritoryId,
  sailEndTerritoryId,
  attackSeaTerritoryId,
  attackSeaDefenderId,
  fortifyStartTerritoryId,
  fortifyEndTerritoryId,
  selectedTerritoryId,
  territories,
  seaTerritories,
  seas,
  ownerById,
  selfId,
  fortification,
  portalTerritoryIds,
  portalsEnabled,
  unusableTerritoryById,
  upcomingUnusableTerritoryById,
  turnPhase,
  isMyTurn,
  paused,
  game,
  toxins,
  closedTiles,
  cards,
  nextSetBaseValues,
  setGame,
}: Omit<AttackParams, 'blitzEnabled' | 'attackDice'> &
  SailParams &
  Omit<AttackSeaParams, 'attackDice'> &
  Omit<
    TurnParams,
    'hillTerritoryIds' | 'blockedById' | 'upcomingBlockedById'
  > & {
    game: GameMapProps['game'];
    upcomingUnusableTerritoryById: TurnParams['upcomingBlockedById'];
  }) {
  const attackFlow = useAttackFlow({
    attackStartTerritoryId,
    attackEndTerritoryId,
    attackConquestMinTroops,
    territories,
    seaTerritories,
    seas,
    ownerById,
    selfId,
    portalTerritoryIds,
    portalsEnabled,
    unusableTerritoryById,
    turnPhase,
    isMyTurn,
    paused,
    blitzEnabled: game.blitz !== 'off',
    attackDice: game.attackDice,
    closedTiles,
    cards,
    nextSetBaseValues,
    setGame,
  });

  const sailFlow = useSailFlow({
    sailStartTerritoryId,
    sailEndTerritoryId,
    seaTerritories,
    seas,
    selfId,
    turnPhase,
    isMyTurn,
    paused,
    setGame,
  });

  const attackSeaFlow = useAttackSeaFlow({
    attackSeaTerritoryId,
    attackSeaDefenderId,
    seaTerritories,
    seas,
    selfId,
    turnPhase,
    isMyTurn,
    paused,
    attackDice: game.attackDice,
    setGame,
  });

  const turnFlow = useTurnActionFlows({
    fortifyStartTerritoryId,
    fortifyEndTerritoryId,
    territories,
    seaTerritories,
    seas,
    ownerById,
    selfId,
    fortification,
    portalTerritoryIds,
    portalsEnabled,
    turnPhase,
    isMyTurn,
    paused,
    selectedTerritoryId,
    toxins,
    hillTerritoryIds: game.hillTerritoryIds,
    cards,
    nextSetBaseValues,
    blockedById: unusableTerritoryById,
    upcomingBlockedById: upcomingUnusableTerritoryById,
    closedTiles,
    setGame,
  });

  return { attackFlow, sailFlow, attackSeaFlow, turnFlow };
}
