import type { Dispatch, RefObject, SetStateAction } from 'react';
import type {
  Card,
  EmojiAttackTarget,
  EmojiValue,
  GameState,
} from '../../../../lib/types';
import type { EvaluatedCombo } from '../../../logic/cards';
import type { SeaTerritory, Territory } from '../../../mapData';
import type { DiceRoll } from '../../../panels/attack/AttackPanel';
import type { Transform } from '../../helpers';

export type CanvasInteractionsParams = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  territories: Territory[];
  seaTerritories: SeaTerritory[];
  sailStartTerritoryId: number | null;
  sailEndTerritoryId: number | null;
  sailStartCandidates: Set<number>;
  sailEndCandidates: Set<number>;
  sailPanelOpen: boolean;
  sailInputRef: RefObject<HTMLInputElement | null>;
  sailMaxShips: number;
  setSailShips: Dispatch<SetStateAction<number>>;
  selectSailStart: (territoryId: number | null) => void;
  selectSailEnd: (territoryId: number) => void;
  submitSail: () => void;
  cancelSail: () => void;
  attackSeaTerritoryId: number | null;
  attackSeaDefenderId: number | null;
  attackSeaStartCandidates: Set<number>;
  attackSeaPanelOpen: boolean;
  attackSeaInputRef: RefObject<HTMLInputElement | null>;
  attackSeaBlitzInputRef: RefObject<HTMLInputElement | null>;
  attackSeaRevealing: boolean;
  attackSeaDiceOnly: boolean;
  setAttackSeaDiceRoll: Dispatch<SetStateAction<DiceRoll | null>>;
  selectAttackSeaStart: (territoryId: number | null) => void;
  submitAttackSea: () => void;
  cancelAttackSea: () => void;
  transform: Transform;
  setTransform: Dispatch<SetStateAction<Transform>>;
  imgDims: { w: number; h: number };
  VERTEX_RADIUS: number;
  gameEnded: boolean;
  isMyTurn: boolean;
  paused: boolean;
  turnPhase: GameState['turnPhase'];
  selfId: number | null;
  selectedTerritoryId: number | null;
  territoryClaimCandidates: Set<number>;
  troopsToDeploy: number;
  deployMaxTroops: number;
  supplyConnectedTerritoryIds: Set<number> | null;
  ownerById: Map<number, GameState['territories'][number]>;
  fortifyStartTerritoryId: number | null;
  fortifyEndTerritoryId: number | null;
  fortifyStartCandidates: Set<number>;
  fortifyEndCandidates: Set<number>;
  fortifyMaxTroops: number;
  fortifyInputRef: RefObject<HTMLInputElement | null>;
  attackPendingConquest: boolean;
  attackStartTerritoryId: number | null;
  attackEndTerritoryId: number | null;
  blitzEnabled: boolean;
  attackStartCandidates: Set<number>;
  attackEndCandidates: Set<number>;
  attackMoveMinTroops: number;
  attackMoveMaxTroops: number;
  attackDiceRoll: DiceRoll | null;
  setAttackDiceRoll: Dispatch<SetStateAction<DiceRoll | null>>;
  attackRevealing: boolean;
  attackDiceOnly: boolean;
  attackMoveInputRef: RefObject<HTMLInputElement | null>;
  blitzInputRef: RefObject<HTMLInputElement | null>;
  entrenchCandidates: Set<number>;
  entrenchMaxTroops: number;
  entrenchInputRef: RefObject<HTMLInputElement | null>;
  toxinsCandidates: Set<number>;
  nukeTargeting: 'launch' | 'antiNuke' | null;
  setNukeTargeting: (mode: 'launch' | 'antiNuke' | null) => void;
  antiNukeTerritoryIds: number[];
  pendingAttackEmoji: { targetPlayerId: number } | null;
  setPendingAttackEmoji: Dispatch<
    SetStateAction<{ targetPlayerId: number } | null>
  >;
  sendEmoji: (
    targetPlayerId: number,
    emoji: EmojiValue,
    attackTarget?: EmojiAttackTarget,
  ) => void;
  emojiPickerFor: number | null;
  setEmojiPickerFor: Dispatch<SetStateAction<number | null>>;
  alliancePopupFor: number | null;
  setAlliancePopupFor: Dispatch<SetStateAction<number | null>>;
  setToasts: Dispatch<SetStateAction<{ id: number; message: string }[]>>;
  setGame: (game: GameState) => void;
  setChatOpen: Dispatch<SetStateAction<boolean>>;
  setPanelCollapsed: Dispatch<SetStateAction<boolean>>;
  openPanel: 'cards' | 'bonuses' | 'logs' | 'settings' | 'nukes' | null;
  setOpenPanel: (
    panel: 'cards' | 'bonuses' | 'logs' | 'settings' | 'nukes' | null,
  ) => void;
  cardsOpen: boolean;
  cardsEnabled: boolean;
  nukesEnabled: boolean;
  settingsMenuOpen: boolean;
  setAwardedCards: (cards: { id: number; card: Card }[]) => void;
  selectedCombo: EvaluatedCombo | undefined;
  playCardSet: (combo: EvaluatedCombo) => void;
  deployPanelOpen: boolean;
  deployInputRef: RefObject<HTMLInputElement | null>;
  setDeployTroops: Dispatch<SetStateAction<number>>;
  submitDeploy: () => void;
  deploySeaCandidates: Set<number>;
  deploySeaTerritoryId: number | null;
  selectDeploySea: (seaTerritoryId: number) => void;
  cancelDeploySea: () => void;
  submitDeploySea: () => void;
  deploySeaPanelOpen: boolean;
  deploySeaInputRef: RefObject<HTMLInputElement | null>;
  setDeploySeaShips: Dispatch<SetStateAction<number>>;
  deploySeaMaxShips: number;
  comboActive: boolean;
  isSeaAdjacentToTerritory: (
    seaTerritoryId: number,
    territoryId: number,
  ) => boolean;
  fortifyPanelOpen: boolean;
  setFortifyTroops: Dispatch<SetStateAction<number>>;
  cancelFortify: () => void;
  selectFortifyStart: (territoryId: number | null) => void;
  selectFortifyEnd: (territoryId: number) => void;
  submitFortify: () => void;
  entrenchPanelOpen: boolean;
  setEntrenchTroops: Dispatch<SetStateAction<number>>;
  submitEntrench: () => void;
  toxinsPanelOpen: boolean;
  submitToxins: () => void;
  attackPanelOpen: boolean;
  attackShowPendingConquest: boolean;
  setAttackMoveTroops: Dispatch<SetStateAction<number>>;
  cycleAttackOption: (direction: 1 | -1) => void;
  selectAttackStart: (territoryId: number | null) => void;
  selectAttackEnd: (territoryId: number) => void;
  quickAttack: (territoryId: number) => void;
  submitAttackMove: () => void;
  cancelAttack: () => void;
  submitAttack: () => void;
  canAdvancePhase: boolean;
};
