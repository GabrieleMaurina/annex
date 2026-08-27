import type { Dispatch, RefObject, SetStateAction } from 'react';
import { Badge, Button } from 'react-bootstrap';
import Tip from '../../../common/Tip';
import type { Card, GameState, TurnPhase } from '../../../lib/types';
import { comboKey, type EvaluatedCombo } from '../../logic/cards';
import CardsPanel, { CardFace } from '../../panels/CardsPanel';
import LogsPanel from '../../panels/LogsPanel';
import type { LogEntry } from '../../useGameLogs';

export default function MapButtonsColumn({
  cardsButtonsTop,
  buttonColumnRef,
  bonusesButtonRef,
  whiteBonusIcon,
  setOpenPanel,
  cardsOpen,
  cardsPanelRef,
  hand,
  ownedTerritoryIds,
  upcomingSetValues,
  combos,
  selectedCombo,
  setSelectedComboKey,
  isMyTurn,
  turnPhase,
  playCardSet,
  cardsButtonRef,
  whiteCardsIcon,
  gameEnded,
  hasSetToPlay,
  setAwardedCards,
  logsOpen,
  logsPanelRef,
  logs,
  logsPanelTop,
  logsButtonRef,
  whiteLogsIcon,
  awardedCards,
}: {
  cardsButtonsTop: number;
  buttonColumnRef: RefObject<HTMLDivElement | null>;
  bonusesButtonRef: RefObject<HTMLButtonElement | null>;
  whiteBonusIcon: string | undefined;
  setOpenPanel: Dispatch<SetStateAction<'cards' | 'bonuses' | 'logs' | null>>;
  cardsOpen: boolean;
  cardsPanelRef: RefObject<HTMLDivElement | null>;
  hand: Card[];
  ownedTerritoryIds: Set<number>;
  upcomingSetValues: GameState['upcomingSetValues'];
  combos: EvaluatedCombo[];
  selectedCombo: EvaluatedCombo | undefined;
  setSelectedComboKey: (key: string | null) => void;
  isMyTurn: boolean;
  turnPhase: TurnPhase;
  playCardSet: (combo: EvaluatedCombo) => void;
  cardsButtonRef: RefObject<HTMLButtonElement | null>;
  whiteCardsIcon: string | undefined;
  gameEnded: boolean;
  hasSetToPlay: boolean;
  setAwardedCards: (cards: { id: number; card: Card }[]) => void;
  logsOpen: boolean;
  logsPanelRef: RefObject<HTMLDivElement | null>;
  logs: LogEntry[];
  logsPanelTop: number;
  logsButtonRef: RefObject<HTMLButtonElement | null>;
  whiteLogsIcon: string | undefined;
  awardedCards: { id: number; card: Card }[];
}) {
  return (
    <div
      className="position-absolute start-0 ms-3 d-flex flex-column align-items-start gap-2"
      style={{ zIndex: 2, top: cardsButtonsTop }}
    >
      <div
        ref={buttonColumnRef}
        className="d-flex flex-column align-items-start gap-3"
      >
        <Tip text="Bonuses">
          <Button
            ref={bonusesButtonRef}
            variant="secondary"
            size="sm"
            onClick={() =>
              setOpenPanel((p) => (p === 'bonuses' ? null : 'bonuses'))
            }
          >
            <img
              src={whiteBonusIcon ?? '/icons/bonus.svg'}
              width={16}
              height={16}
              alt="Continent Bonuses"
            />
          </Button>
        </Tip>
        {cardsOpen ? (
          <div ref={cardsPanelRef}>
            <CardsPanel
              hand={hand}
              ownedTerritoryIds={ownedTerritoryIds}
              upcomingSetValues={upcomingSetValues}
              combos={combos}
              selectedCombo={selectedCombo}
              onSelectCombo={(combo) => setSelectedComboKey(comboKey(combo))}
              canPlay={isMyTurn && turnPhase === 'deploy'}
              onPlaySet={playCardSet}
              onClose={() => setOpenPanel(null)}
            />
          </div>
        ) : (
          <Tip text="Cards">
            <Button
              ref={cardsButtonRef}
              variant="secondary"
              size="sm"
              className="position-relative"
              onClick={() => {
                setOpenPanel('cards');
                setAwardedCards([]);
              }}
            >
              <img
                src={whiteCardsIcon ?? '/icons/cards.svg'}
                width={16}
                height={16}
                alt="Cards"
              />
              {!gameEnded && hand.length > 0 && (
                <Badge
                  bg={hasSetToPlay ? 'danger' : 'secondary'}
                  pill
                  className="position-absolute top-0 start-100 translate-middle"
                  style={{ fontSize: 10 }}
                >
                  {hand.length}
                  {hasSetToPlay && '!'}
                </Badge>
              )}
            </Button>
          </Tip>
        )}
        {logsOpen ? (
          <div ref={logsPanelRef}>
            <LogsPanel
              logs={logs}
              top={logsPanelTop}
              onClose={() => setOpenPanel(null)}
            />
          </div>
        ) : (
          <Tip text="Logs">
            <Button
              ref={logsButtonRef}
              variant="secondary"
              size="sm"
              onClick={() => setOpenPanel('logs')}
            >
              <img
                src={whiteLogsIcon ?? '/icons/logs.svg'}
                width={16}
                height={16}
                alt="Logs"
              />
            </Button>
          </Tip>
        )}
      </div>
      {!gameEnded && awardedCards.length > 0 && (
        <div className="d-flex flex-column gap-2">
          {awardedCards.map(({ id, card }) => (
            <div
              key={id}
              className="bg-body bg-opacity-75 border rounded p-2 d-flex align-items-center gap-2"
            >
              <CardFace card={card} size={36} />
              <span className="small">New card!</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
