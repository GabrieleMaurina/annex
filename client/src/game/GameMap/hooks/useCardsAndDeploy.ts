import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { socket } from '../../../lib/socket';
import type { Ack, Card, GameState } from '../../../lib/types';
import { CARD_SET_FLASH_DURATION } from '../../animations';
import {
  comboKey,
  diffNewCards,
  enumerateCombos,
  type EvaluatedCombo,
} from '../../logic/cards';

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
  cardsOpen: boolean;
  setOpenPanel: (panel: 'cards' | 'bonuses' | 'logs' | null) => void;
  setToasts: (
    update: (prev: { id: number; message: string }[]) => {
      id: number;
      message: string;
    }[],
  ) => void;
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
      socket.emit('game:playCardSet', { cards }, (res: Ack) => {
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

  const submitDeploy = useCallback(() => {
    if (selectedTerritoryId === null) return;
    const event = turnPhase === 'troop' ? 'game:placeTroop' : 'game:deploy';
    socket.emit(
      event,
      { territoryId: selectedTerritoryId, troops: deployTroops },
      (res: Ack) => {
        if (!res.ok) return;
        setGame(res.game);
      },
    );
  }, [selectedTerritoryId, deployTroops, setGame, turnPhase]);

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
          }, 4000);
        }
      }
      receivedFirstHand = true;
      handRef.current = payload.cards;
      setHand(payload.cards);
    }
    socket.on('game:cards', onCards);
    socket.emit('game:requestCards');
    return () => {
      socket.off('game:cards', onCards);
    };
  }, []);

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
        const name =
          playersRef.current.find((p) => p.id === payload.playerId)?.name ??
          'A player';
        setToasts((prev) => [
          ...prev,
          {
            id: Date.now(),
            message: `${name} received ${payload.troops} troops from a set`,
          },
        ]);
      }
    }
    socket.on('game:cardSetPlayed', onCardSetPlayed);
    return () => {
      socket.off('game:cardSetPlayed', onCardSetPlayed);
    };
  }, [selfId, playersRef, setToasts]);

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
    deployPanelOpen,
  };
}
