import type { Card } from '../../../lib/types';
import { PANEL_BG_CLASS } from '../../../ui/containers/panelStyle';
import { CardFace } from '../../panels/CardsPanel';

export default function CardSetFlash({
  cards,
  territoryNames,
  duration,
  onDismiss,
}: {
  cards: Card[];
  territoryNames: Map<number, string>;
  duration: number;
  onDismiss: () => void;
}) {
  return (
    <div
      onClick={onDismiss}
      className={`position-fixed top-50 start-50 d-flex gap-3 cursor-pointer ${PANEL_BG_CLASS} border rounded p-3`}
      style={{
        zIndex: 4,
        animation: `annexCardSetFlash ${duration / 1000}s ease-out forwards`,
      }}
    >
      <style>{`
        @keyframes annexCardSetFlash {
          0% { transform: translate(-50%, -50%) scale(0.4); opacity: 0; }
          15% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
          25% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          85% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(0.92); opacity: 0; }
        }
      `}</style>
      {cards.map((card, i) => (
        <CardFace
          key={i}
          card={card}
          territoryNames={territoryNames}
          size={90}
        />
      ))}
    </div>
  );
}
