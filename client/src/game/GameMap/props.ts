import type { Dispatch, SetStateAction } from 'react';
import type { ResultRow } from '../../common/ResultsTable';
import type {
  Alliances,
  BotSpeed,
  Bounties,
  CardsMode,
  Entrenchments,
  Fortification,
  GameMode,
  GameState,
  Mission,
  Starvation,
  SupplyLines,
  Toxins,
  TurnDuration,
  TurnPhase,
} from '../../lib/types';
import type { LogEntry } from '../logs/useGameLogs';
import type { ReplayData } from '../replay/replay';

export interface GameMapProps {
  game: GameState;
  mapName: string;
  players: GameState['players'];
  spectators: GameState['spectators'];
  ownership: GameState['territories'];
  visibleTerritoryIds: GameState['visibleTerritoryIds'];
  gameMode: GameMode;
  isTeamDeathmatch: boolean;
  isCapitals: boolean;
  continentId: number | null;
  mission: Mission | null;
  selfId: number | null;
  roundNumber: number;
  turnPlayerIndex: number;
  turnPhase: TurnPhase;
  turnDuration: TurnDuration;
  fortification: Fortification;
  entrenchments: Entrenchments;
  toxins: Toxins;
  toxinTerritories: GameState['toxinTerritories'];
  cards: CardsMode;
  portalTerritoryIds: number[];
  portalsEnabled: boolean;
  radiationTerritoryIds: number[];
  radiationUpcomingTerritoryIds: number[];
  starvation: Starvation;
  bounties: Bounties;
  supplyLines: SupplyLines;
  alliances: Alliances;
  allianceStates: GameState['allianceStates'];
  territoryTroopsCap: number;
  totalTroopsCap: number;
  troopsToDeploy: number;
  turnStartedAt: number;
  paused: boolean;
  botSpeed: BotSpeed;
  hostId: number;
  onTogglePause: () => void;
  onCycleBotSpeed: () => void;
  selectedTerritoryId: number | null;
  fortifyStartTerritoryId: number | null;
  fortifyEndTerritoryId: number | null;
  fortifyPathTerritoryIds: number[][];
  attackStartTerritoryId: number | null;
  attackEndTerritoryId: number | null;
  attackConquestMinTroops: number | null;
  attackPathTerritoryIds: number[][];
  sailStartTerritoryId: number | null;
  sailEndTerritoryId: number | null;
  sailPathTerritoryIds: number[][];
  attackSeaTerritoryId: number | null;
  attackSeaDefenderId: number | null;
  seas: GameState['seas'];
  nextSetBaseValues: GameState['nextSetBaseValues'];
  upcomingSetValues: GameState['upcomingSetValues'];
  results: Map<number, ResultRow> | null;
  gameEnded: boolean;
  showReplay: boolean;
  replayData?: ReplayData | null;
  onReplayIndexChange?: (index: number) => void;
  logs: LogEntry[];
  setGame: (game: GameState) => void;
  adjustTerritoryTroops: (
    deltas: { territoryId: number; delta: number; ownerId?: number }[],
  ) => void;
  adjustToxinTerritories: (
    changes: (
      | { territoryId: number; remove: true }
      | { territoryId: number; permanent: boolean; roundsRemaining: number }
    )[],
  ) => void;
  setRadiationTerritoryIds: (territoryIds: number[]) => void;
  setRadiationUpcomingTerritoryIds: (territoryIds: number[]) => void;
  setChatOpen: Dispatch<SetStateAction<boolean>>;
  settingsMenuOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
  navigate: (path: string) => void;
}
