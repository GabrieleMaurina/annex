import { outlinePoints, shapeAspect, type ShapeKind } from '../paint/shapes';

const SIZE = 16;
const MARGIN = 1;

function ShapeIcon({ kind }: { kind: ShapeKind }) {
  const box = SIZE - MARGIN * 2;
  const aspect = shapeAspect(kind);
  const w = box * Math.min(1, aspect);
  const h = box * Math.min(1, 1 / aspect);
  const points = outlinePoints(kind, w, h)
    .map((p) => `${SIZE / 2 + p.x},${SIZE / 2 + p.y}`)
    .join(' ');
  return (
    <svg width={SIZE} height={SIZE} fill="currentColor">
      <polygon points={points} />
    </svg>
  );
}

export default ShapeIcon;
