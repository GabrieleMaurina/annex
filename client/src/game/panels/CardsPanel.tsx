import { Badge, Button, ListGroup } from 'react-bootstrap';
import WhiteIcon from '../../common/icons/WhiteIcon';
import PanelHeader from '../../common/PanelHeader';
import Tip from '../../common/tooltips/Tip';
import TipSpan from '../../common/tooltips/TipSpan';
import type { Card } from '../../lib/types';
import { PANEL_BG_CLASS, PANEL_CLASS } from '../../ui/containers/panelStyle';
import { comboKey, sortForDisplay, type EvaluatedCombo } from '../logic/cards';

interface Props {
  hand: Card[];
  territoryNames: Map<number, string>;
  ownedTerritoryIds: Set<number>;
  upcomingSetValues: number[];
  combos: EvaluatedCombo[];
  selectedCombo: EvaluatedCombo | undefined;
  onSelectCombo: (combo: EvaluatedCombo) => void;
  canPlay: boolean;
  onPlaySet: (combo: EvaluatedCombo) => void;
  onClose: () => void;
  title?: string;
}

const SELECTED_BORDER_COLOR = 'var(--bs-primary)';

export function CardFace({
  card,
  territoryNames,
  size = 40,
  owned = false,
  selected = false,
}: {
  card: Card;
  territoryNames: Map<number, string>;
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
  const territoryId = card.territoryId ?? 0;
  const name = territoryNames.get(territoryId);
  const face = (
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
      {name ? (
        <span
          className="text-black text-truncate mw-100 px-1"
          style={{ fontSize: width * 0.18 }}
        >
          {name}
        </span>
      ) : (
        <span className="text-black" style={{ fontSize: width * 0.24 }}>
          #{territoryId + 1}
        </span>
      )}
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
  return name ? <Tip text={name}>{face}</Tip> : face;
}

function ComboRow({
  combo,
  territoryNames,
  selected,
  onClick,
}: {
  combo: EvaluatedCombo;
  territoryNames: Map<number, string>;
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
            territoryNames={territoryNames}
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
  territoryNames,
  ownedTerritoryIds,
  upcomingSetValues,
  combos,
  selectedCombo,
  onSelectCombo,
  canPlay,
  onPlaySet,
  onClose,
  title,
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
    <div
      className={`${PANEL_BG_CLASS} ${PANEL_CLASS} d-flex flex-column`}
      style={{ width: 268, maxHeight: 'calc(100vh - 2rem)' }}
    >
      <PanelHeader title={title ?? 'Your Cards'} onClose={onClose} />
      <div
        className="no-scrollbar"
        style={{ overflowY: 'auto', minHeight: 0 }}
        onWheel={(e) => e.stopPropagation()}
      >
        {hand.length === 0 ? (
          <div className="text-muted small">No cards yet</div>
        ) : (
          <div className="d-flex flex-wrap gap-2">
            {sortForDisplay(hand).map((c, i) => (
              <CardFace
                key={i}
                card={c}
                territoryNames={territoryNames}
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
                <Badge
                  key={i}
                  bg={i === 0 ? 'primary' : 'secondary'}
                  text={i === 0 ? 'dark' : undefined}
                >
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
                    territoryNames={territoryNames}
                    selected={combo === selectedCombo}
                    onClick={() => onSelectCombo(combo)}
                  />
                ))}
              </ListGroup>
            </div>
            <TipSpan
              className="d-block"
              text="Play the selected set (your deploy phase only)"
            >
              <Button
                size="sm"
                className="w-100 d-inline-flex align-items-center justify-content-center gap-1"
                disabled={!canPlay || !selectedCombo}
                onClick={() => selectedCombo && onPlaySet(selectedCombo)}
              >
                <WhiteIcon path="/icons/cards.svg" />
                Play Set
              </Button>
            </TipSpan>
          </>
        )}
      </div>
    </div>
  );
}

export default CardsPanel;
