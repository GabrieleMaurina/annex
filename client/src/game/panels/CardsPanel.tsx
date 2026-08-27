import { Badge, Button, ListGroup } from 'react-bootstrap';
import { PANEL_BG_CLASS, PANEL_CLASS } from '../../common/panelStyle';
import type { Card } from '../../lib/types';
import { comboKey, sortForDisplay, type EvaluatedCombo } from '../logic/cards';

interface Props {
  hand: Card[];
  ownedTerritoryIds: Set<number>;
  upcomingSetValues: number[];
  combos: EvaluatedCombo[];
  selectedCombo: EvaluatedCombo | undefined;
  onSelectCombo: (combo: EvaluatedCombo) => void;
  canPlay: boolean;
  onPlaySet: (combo: EvaluatedCombo) => void;
  onClose: () => void;
}

const SELECTED_BORDER_COLOR = '#0d6efd';

export function CardFace({
  card,
  size = 40,
  owned = false,
  selected = false,
}: {
  card: Card;
  size?: number;
  owned?: boolean;
  selected?: boolean;
}) {
  const width = size;
  const height = size * 1.5;
  const borderStyle: React.CSSProperties = selected
    ? { borderColor: SELECTED_BORDER_COLOR, borderWidth: 2 }
    : {};
  if (card.symbol === null) {
    return (
      <div
        className="d-flex flex-column align-items-center justify-content-between border rounded bg-white p-1"
        style={{ width, height, ...borderStyle }}
      >
        {(['soldier', 'humvee', 'tank'] as const).map((symbol) => (
          <img
            key={symbol}
            src={`/images/${symbol}.svg`}
            alt={symbol}
            style={{ width: width * 0.55, height: height * 0.28 }}
          />
        ))}
      </div>
    );
  }
  return (
    <div
      className="d-flex flex-column align-items-center justify-content-center border rounded bg-white position-relative"
      style={{ width, height, ...borderStyle }}
    >
      <img
        src={`/images/${card.symbol}.svg`}
        alt={card.symbol}
        width={width * 0.6}
        height={width * 0.6}
      />
      <span className="text-black" style={{ fontSize: width * 0.24 }}>
        #{(card.territoryId ?? 0) + 1}
      </span>
      {owned && (
        <span
          className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-success"
          style={{ fontSize: Math.max(8, width * 0.22) }}
        >
          +2
        </span>
      )}
    </div>
  );
}

function ComboRow({
  combo,
  selected,
  onClick,
}: {
  combo: EvaluatedCombo;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <ListGroup.Item
      action
      active={selected}
      onClick={onClick}
      className="d-flex align-items-center gap-2 py-1"
    >
      <div className="d-flex gap-1">
        {sortForDisplay(combo.cards).map((c, i) => (
          <CardFace
            key={i}
            card={c}
            size={24}
            owned={
              c.territoryId !== null &&
              combo.territoryBonusIds.includes(c.territoryId)
            }
          />
        ))}
      </div>
      <div className="fw-bold ms-auto">
        +{combo.baseValue}
        {combo.territoryBonusIds.length > 0 &&
          ` (+${combo.territoryBonusIds.length * 2})`}
      </div>
    </ListGroup.Item>
  );
}

function CardsPanel({
  hand,
  ownedTerritoryIds,
  upcomingSetValues,
  combos,
  selectedCombo,
  onSelectCombo,
  canPlay,
  onPlaySet,
  onClose,
}: Props) {
  function handleWheel(e: React.WheelEvent) {
    if (combos.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    const currentIndex = selectedCombo ? combos.indexOf(selectedCombo) : 0;
    const direction = e.deltaY < 0 ? -1 : 1;
    const nextIndex = Math.min(
      combos.length - 1,
      Math.max(0, currentIndex + direction),
    );
    onSelectCombo(combos[nextIndex]);
  }

  return (
    <div className={`${PANEL_BG_CLASS} ${PANEL_CLASS}`} style={{ width: 268 }}>
      <div
        className="fw-bold lh-1 mb-2"
        role="button"
        tabIndex={0}
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
            onClose();
          }
        }}
        style={{ cursor: 'pointer' }}
      >
        Your Cards
      </div>
      {hand.length === 0 ? (
        <div className="text-muted small">No cards yet</div>
      ) : (
        <div className="d-flex flex-wrap gap-2">
          {sortForDisplay(hand).map((c, i) => (
            <CardFace
              key={i}
              card={c}
              owned={
                c.territoryId !== null && ownedTerritoryIds.has(c.territoryId)
              }
              selected={selectedCombo?.cards.includes(c) ?? false}
            />
          ))}
        </div>
      )}
      {upcomingSetValues.length > 0 && (
        <>
          <div className="fw-bold lh-1 mb-2 mt-2">Next Sets</div>
          <div className="d-flex gap-2 mb-2">
            {upcomingSetValues.map((value, i) => (
              <Badge key={i} bg={i === 0 ? 'primary' : 'secondary'}>
                +{value}
              </Badge>
            ))}
          </div>
        </>
      )}
      {combos.length > 0 && (
        <>
          <div className="fw-bold lh-1 mb-2 mt-2">Available Sets</div>
          <div
            style={{ maxHeight: '40vh', overflowY: 'auto' }}
            className="mb-2 no-scrollbar"
            onWheel={handleWheel}
          >
            <ListGroup>
              {combos.map((combo) => (
                <ComboRow
                  key={comboKey(combo)}
                  combo={combo}
                  selected={combo === selectedCombo}
                  onClick={() => onSelectCombo(combo)}
                />
              ))}
            </ListGroup>
          </div>
          <Button
            size="sm"
            className="w-100"
            disabled={!canPlay || !selectedCombo}
            onClick={() => selectedCombo && onPlaySet(selectedCombo)}
          >
            Play Set
          </Button>
        </>
      )}
    </div>
  );
}

export default CardsPanel;
