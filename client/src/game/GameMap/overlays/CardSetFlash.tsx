import type { Card } from '../../../lib/types';
import { CARD_SET_FLASH_DURATION } from '../../animations';
import { CardFace } from '../../panels/CardsPanel';

export default function CardSetFlash({ cards }: { cards: Card[] }) {
  return (
    <div
      className="position-fixed top-50 start-50 d-flex gap-3 bg-body bg-opacity-75 border rounded p-3"
      style={{
        zIndex: 4,
        pointerEvents: 'none',
        animation: `annexCardSetFlash ${CARD_SET_FLASH_DURATION / 1000}s ease-out forwards`,
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
        <CardFace key={i} card={card} size={90} />
      ))}
    </div>
  );
}
