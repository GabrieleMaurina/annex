import type { Dispatch, RefObject, SetStateAction } from 'react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { connector } from '../../../connector';
import type { Ack, Card, GameState } from '../../../lib/types';
import { CARD_SET_FLASH_DURATION } from '../../animations';
import {
  comboKey,
  diffNewCards,
  enumerateCombos,
  type EvaluatedCombo,
} from '../../logic/cards';
import type { GameToast } from '../overlays/GameToasts';
import { nextToastId } from '../toastId';
import { BOT_TOAST_DELAY_MS } from './view/useTurnToasts';

const CARD_SET_FLASH_BOT_REFERENCE_MS = 5000;

export function useCardsAndDeploy({
  turnPhase,
  isMyTurn,
  paused,
  selectedTerritoryId,
  ownedTerritoryIds,
  nextSetBaseValues,
  selfId,
  playersRef,
  botSpeed,
  cardsOpen,
  setOpenPanel,
  autoOpenCardsPanel,
  setToasts,
  setGame,
}: {
  turnPhase: GameState['turnPhase'];
  isMyTurn: boolean;
  paused: boolean;
  selectedTerritoryId: number | null;
  ownedTerritoryIds: Set<number>;
  nextSetBaseValues: GameState['nextSetBaseValues'];
  selfId: number | null;
  playersRef: RefObject<GameState['players']>;
  botSpeed: GameState['botSpeed'];
  cardsOpen: boolean;
  setOpenPanel: (
    panel: 'cards' | 'bonuses' | 'logs' | 'settings' | null,
  ) => void;
  autoOpenCardsPanel: () => void;
  setToasts: Dispatch<SetStateAction<GameToast[]>>;
  setGame: (game: GameState) => void;
}) {
  const [hand, setHand] = useState<Card[]>([]);
  const handRef = useRef<Card[]>([]);
  const [awardedCards, setAwardedCards] = useState<
    { id: number; card: Card }[]
  >([]);
  const awardIdRef = useRef(0);
  const [cardSetFlash, setCardSetFlash] = useState<{
    id: number;
    cards: Card[];
    duration: number;
  } | null>(null);
  const cardSetFlashIdRef = useRef(0);
  const [selectedComboKey, setSelectedComboKey] = useState<string | null>(null);
  const [deployTroops, setDeployTroops] = useState(0);
  const deployInputRef = useRef<HTMLInputElement>(null);

  const combos = enumerateCombos(hand, nextSetBaseValues, ownedTerritoryIds);
  const selectedCombo =
    combos.find((c) => comboKey(c) === selectedComboKey) ?? combos[0];
  const hasSetToPlay = combos.length > 0;
  const mustPlaySet = hand.length >= 5;
  const autoOpenCards =
    turnPhase === 'deploy' && isMyTurn && !paused && mustPlaySet;

  useLayoutEffect(() => {
    if (autoOpenCards) autoOpenCardsPanel();
  }, [autoOpenCards, autoOpenCardsPanel]);

  const cardByTerritoryId = !cardsOpen
    ? new Map<number, Card>()
    : new Map(
        hand
          .filter((c) => c.territoryId !== null)
          .map((c) => [c.territoryId as number, c]),
      );

  const playCardSet = useCallback(
    (combo: EvaluatedCombo) => {
      const cards = combo.cards.map((c) => c.territoryId);
      connector.playCardSet({ cards }, (res: Ack) => {
        if (!res.ok) return;
        setGame(res.game);
        setSelectedComboKey(null);
        setHand((prev) => {
          const next = [...prev];
          for (const card of combo.cards) {
            const index = next.indexOf(card);
            if (index !== -1) next.splice(index, 1);
          }
          return next;
        });
        if (hand.length - combo.cards.length < 5) setOpenPanel(null);
      });
    },
    [setGame, hand, setOpenPanel],
  );

  const quickDeploy = useCallback(
    (territoryId: number, troops: number) => {
      const payload = { territoryId, troops };
      const cb = (res: Ack) => {
        if (!res.ok) return;
        setGame(res.game);
        if (turnPhase !== 'deploy' || res.game.turnPhase !== 'attack') return;
        connector.attackSelectStart({ territoryId }, (selectRes: Ack) => {
          if (selectRes.ok) setGame(selectRes.game);
        });
      };
      if (turnPhase === 'troop') connector.placeTroop(payload, cb);
      else connector.deploy(payload, cb);
    },
    [setGame, turnPhase],
  );

  const submitDeploy = useCallback(() => {
    if (selectedTerritoryId === null) return;
    quickDeploy(selectedTerritoryId, deployTroops);
  }, [selectedTerritoryId, deployTroops, quickDeploy]);

  const deployPanelOpen =
    (turnPhase === 'deploy' || turnPhase === 'troop') &&
    isMyTurn &&
    !paused &&
    selectedTerritoryId !== null;

  useEffect(() => {
    let receivedFirstHand = false;
    function onCards(payload: { cards: Card[] }) {
      if (receivedFirstHand) {
        const added = diffNewCards(handRef.current, payload.cards);
        for (const card of added) {
          const id = ++awardIdRef.current;
          setAwardedCards((prev) => [...prev, { id, card }]);
          setTimeout(() => {
            setAwardedCards((prev) => prev.filter((a) => a.id !== id));
          }, 3000);
        }
      }
      receivedFirstHand = true;
      const cards = [...payload.cards];
      handRef.current = cards;
      setHand(cards);
    }
    connector.on('game:cards', onCards);
    connector.requestCards();
    return () => {
      connector.off('game:cards', onCards);
    };
  }, [selfId]);

  useEffect(() => {
    function onCardSetPlayed(payload: {
      playerId: number;
      troops: number;
      cards: Card[];
    }) {
      const player = playersRef.current.find((p) => p.id === payload.playerId);
      const botDelay = player?.isBot ? BOT_TOAST_DELAY_MS[botSpeed] : undefined;
      const duration = botDelay
        ? (CARD_SET_FLASH_DURATION * botDelay) / CARD_SET_FLASH_BOT_REFERENCE_MS
        : CARD_SET_FLASH_DURATION;

      const id = ++cardSetFlashIdRef.current;
      setCardSetFlash({ id, cards: payload.cards, duration });
      setTimeout(() => {
        setCardSetFlash((prev) => (prev?.id === id ? null : prev));
      }, duration);

      if (payload.playerId !== selfId) {
        setToasts((prev) => [
          ...prev,
          {
            id: nextToastId(),
            message: `${player?.name ?? 'A player'} received ${payload.troops} troops from a set`,
            delay: botDelay,
          },
        ]);
      }
    }
    connector.on('game:cardSetPlayed', onCardSetPlayed);
    return () => {
      connector.off('game:cardSetPlayed', onCardSetPlayed);
    };
  }, [selfId, playersRef, botSpeed, setToasts]);

  const dismissCardSetFlash = useCallback(() => setCardSetFlash(null), []);

  return {
    hand,
    awardedCards,
    setAwardedCards,
    cardSetFlash,
    dismissCardSetFlash,
    selectedComboKey,
    setSelectedComboKey,
    combos,
    selectedCombo,
    hasSetToPlay,
    mustPlaySet,
    cardByTerritoryId,
    playCardSet,
    deployTroops,
    setDeployTroops,
    deployInputRef,
    submitDeploy,
    quickDeploy,
    deployPanelOpen,
  };
}
