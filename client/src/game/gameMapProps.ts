import type { GameState } from '../lib/types';
import type { GameMapProps } from './GameMap/props';

type DerivedKeys =
  | 'game'
  | 'mapName'
  | 'players'
  | 'spectators'
  | 'ownership'
  | 'visibleTerritoryIds'
  | 'gameMode'
  | 'isTeamDeathmatch'
  | 'isCapitals'
  | 'continentId'
  | 'roundNumber'
  | 'turnPlayerIndex'
  | 'turnPhase'
  | 'turnDuration'
  | 'fortification'
  | 'entrenchments'
  | 'toxins'
  | 'toxinTerritories'
  | 'cards'
  | 'portalTerritoryIds'
  | 'portalsEnabled'
  | 'radiationTerritoryIds'
  | 'radiationUpcomingTerritoryIds'
  | 'starvation'
  | 'bounties'
  | 'supplyLines'
  | 'alliances'
  | 'allianceStates'
  | 'territoryTroopsCap'
  | 'totalTroopsCap'
  | 'troopsToDeploy'
  | 'turnStartedAt'
  | 'paused'
  | 'botSpeed'
  | 'hostId'
  | 'selectedTerritoryId'
  | 'fortifyStartTerritoryId'
  | 'fortifyEndTerritoryId'
  | 'fortifyPathTerritoryIds'
  | 'attackStartTerritoryId'
  | 'attackEndTerritoryId'
  | 'attackConquestMinTroops'
  | 'attackPathTerritoryIds'
  | 'sailStartTerritoryId'
  | 'sailEndTerritoryId'
  | 'sailPathTerritoryIds'
  | 'attackSeaTerritoryId'
  | 'attackSeaDefenderId'
  | 'seas'
  | 'nextSetBaseValues'
  | 'upcomingSetValues';

export function gameMapDataProps(
  game: GameState,
  mapName: string,
): Pick<GameMapProps, DerivedKeys> {
  return {
    game,
    mapName,
    players: game.players,
    spectators: game.spectators,
    ownership: game.territories,
    visibleTerritoryIds: game.visibleTerritoryIds,
    gameMode: game.gameMode,
    isTeamDeathmatch: game.gameMode === 'Team Deathmatch',
    isCapitals: game.gameMode === 'Capitals',
    continentId: game.continentId,
    roundNumber: game.roundNumber,
    turnPlayerIndex: game.turnPlayerIndex,
    turnPhase: game.turnPhase,
    turnDuration: game.turnDuration,
    fortification: game.fortification,
    entrenchments: game.entrenchments,
    toxins: game.toxins,
    toxinTerritories: game.toxinTerritories,
    cards: game.cards,
    portalTerritoryIds: game.portalTerritoryIds,
    portalsEnabled: game.portalsEnabled,
    radiationTerritoryIds: game.radiationTerritoryIds,
    radiationUpcomingTerritoryIds: game.radiationUpcomingTerritoryIds,
    starvation: game.starvation,
    bounties: game.bounties,
    supplyLines: game.supplyLines,
    alliances: game.alliances,
    allianceStates: game.allianceStates,
    territoryTroopsCap: game.territoryTroopsCap,
    totalTroopsCap: game.totalTroopsCap,
    troopsToDeploy: game.troopsToDeploy,
    turnStartedAt: game.turnStartedAt,
    paused: game.paused,
    botSpeed: game.botSpeed,
    hostId: game.hostId,
    selectedTerritoryId: game.selectedTerritoryId,
    fortifyStartTerritoryId: game.fortifyStartTerritoryId,
    fortifyEndTerritoryId: game.fortifyEndTerritoryId,
    fortifyPathTerritoryIds: game.fortifyPathTerritoryIds,
    attackStartTerritoryId: game.attackStartTerritoryId,
    attackEndTerritoryId: game.attackEndTerritoryId,
    attackConquestMinTroops: game.attackConquestMinTroops,
    attackPathTerritoryIds: game.attackPathTerritoryIds,
    sailStartTerritoryId: game.sailStartTerritoryId,
    sailEndTerritoryId: game.sailEndTerritoryId,
    sailPathTerritoryIds: game.sailPathTerritoryIds,
    attackSeaTerritoryId: game.attackSeaTerritoryId,
    attackSeaDefenderId: game.attackSeaDefenderId,
    seas: game.seas,
    nextSetBaseValues: game.nextSetBaseValues,
    upcomingSetValues: game.upcomingSetValues,
  };
}

export const noopGameMapHandlers = {
  onTogglePause: () => {},
  onCycleBotSpeed: () => {},
  setGame: () => {},
  adjustTerritoryTroops: () => {},
  adjustToxinTerritories: () => {},
  setRadiationTerritoryIds: () => {},
  setRadiationUpcomingTerritoryIds: () => {},
  setChatOpen: () => {},
  onPanelOpenChange: () => {},
} satisfies Partial<GameMapProps>;
