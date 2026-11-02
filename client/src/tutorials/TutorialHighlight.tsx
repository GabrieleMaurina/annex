import { useLayoutEffect, useState, type RefObject } from 'react';
import { useCameraTransform, type Camera } from '../game/GameMap/camera';
import {
  getScales,
  getTerritoryScreenPos,
  type Point,
} from '../game/GameMap/helpers';

interface Props {
  target: number | 'cards';
  camera: Camera;
  places: (Point & { id: number })[];
  size: { w: number; h: number };
  imgDims: { w: number; h: number };
  VERTEX_RADIUS: number;
  cardsButtonRef: RefObject<HTMLButtonElement | null>;
  cardsButtonsTop: number;
  panelOpen: boolean;
}

function HighlightRing({
  target,
  camera,
  places,
  size,
  imgDims,
  VERTEX_RADIUS,
  cardsButtonRef,
  cardsButtonsTop,
  panelOpen,
  onDone,
}: Props & { onDone: () => void }) {
  const transform = useCameraTransform(camera);
  const [cardsRect, setCardsRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (target !== 'cards') return;
    const rect = cardsButtonRef.current?.getBoundingClientRect();
    if (rect && (rect.x !== cardsRect?.x || rect.y !== cardsRect?.y))
      setCardsRect(rect);
  }, [target, cardsButtonRef, cardsRect, size, cardsButtonsTop, panelOpen]);

  let center: Point;
  let radius: number;
  if (target === 'cards') {
    if (!cardsRect) return null;
    center = {
      x: cardsRect.left + cardsRect.width / 2,
      y: cardsRect.top + cardsRect.height / 2,
    };
    radius = Math.max(cardsRect.width, cardsRect.height) / 2;
  } else {
    const place = places.find((p) => p.id === target);
    if (!place) return null;
    center = getTerritoryScreenPos(place, size, transform, imgDims);
    radius =
      VERTEX_RADIUS * getScales(size.w, size.h, transform.zoom, imgDims).scaleX;
  }

  const diameter = radius * 4;
  return (
    <div
      className="position-absolute rounded-circle"
      style={{
        left: center.x - diameter / 2,
        top: center.y - diameter / 2,
        width: diameter,
        height: diameter,
        zIndex: 1,
        pointerEvents: 'none',
        background:
          'radial-gradient(circle closest-side, transparent 45%, rgba(255, 255, 255, 0.95) 60%, transparent 100%)',
        animation: 'annexTutorialHighlight 0.25s ease-in-out 4 alternate',
      }}
      onAnimationEnd={onDone}
    >
      <style>{`
        @keyframes annexTutorialHighlight {
          from { transform: scale(0.8); opacity: 0; }
          to { transform: scale(1.15); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function TutorialHighlight(props: Props) {
  const [done, setDone] = useState(false);
  if (done) return null;
  return <HighlightRing {...props} onDone={() => setDone(true)} />;
}

export default TutorialHighlight;
