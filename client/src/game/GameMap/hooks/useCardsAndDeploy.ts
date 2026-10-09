import type { Dispatch, RefObject, SetStateAction } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { BOT_TOAST_DELAY_MS } from './view/useTurnToasts';

export function useCardsAndDeploy({
  turnPhase,
  isMyTurn,
  paused,
  selectedTerritoryId,
  gameEnded,
  ownedTerritoryIds,
  nextSetBaseValues,
  selfId,
  playersRef,
  botSpeed,
  cardsOpen,
  setOpenPanel,
  setToasts,
  setGame,
}: {
  turnPhase: GameState['turnPhase'];
  isMyTurn: boolean;
  paused: boolean;
  selectedTerritoryId: number | null;
  gameEnded: boolean;
  ownedTerritoryIds: Set<number>;
  nextSetBaseValues: GameState['nextSetBaseValues'];
  selfId: number | null;
  playersRef: RefObject<GameState['players']>;
  botSpeed: GameState['botSpeed'];
  cardsOpen: boolean;
  setOpenPanel: (
    panel: 'cards' | 'bonuses' | 'logs' | 'settings' | null,
  ) => void;
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

  const cardByTerritoryId =
    gameEnded && !cardsOpen
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
      const id = ++cardSetFlashIdRef.current;
      setCardSetFlash({ id, cards: payload.cards });
      setTimeout(() => {
        setCardSetFlash((prev) => (prev?.id === id ? null : prev));
      }, CARD_SET_FLASH_DURATION);

      if (payload.playerId !== selfId) {
        const player = playersRef.current.find(
          (p) => p.id === payload.playerId,
        );
        setToasts((prev) => [
          ...prev,
          {
            id: Date.now(),
            message: `${player?.name ?? 'A player'} received ${payload.troops} troops from a set`,
            delay: player?.isBot ? BOT_TOAST_DELAY_MS[botSpeed] : undefined,
          },
        ]);
      }
    }
    connector.on('game:cardSetPlayed', onCardSetPlayed);
    return () => {
      connector.off('game:cardSetPlayed', onCardSetPlayed);
    };
  }, [selfId, playersRef, botSpeed, setToasts]);

  return {
    hand,
    awardedCards,
    setAwardedCards,
    cardSetFlash,
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
