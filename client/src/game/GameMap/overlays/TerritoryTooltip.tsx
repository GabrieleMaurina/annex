import type { Territory } from '../../mapData';
import { useCameraTransform, type Camera } from '../camera';
import { getScales, getTerritoryScreenPos } from '../helpers';

interface Props {
  camera: Camera;
  territory: Territory | undefined;
  labels: string[];
  size: { w: number; h: number };
  imgDims: { w: number; h: number };
  VERTEX_RADIUS: number;
}

export default function TerritoryTooltip({
  camera,
  territory,
  labels,
  size,
  imgDims,
  VERTEX_RADIUS,
}: Props) {
  const transform = useCameraTransform(camera);
  if (!territory || labels.length === 0) return null;
  const position = getTerritoryScreenPos(territory, size, transform, imgDims);
  const offset =
    VERTEX_RADIUS * getScales(size.w, size.h, transform.zoom, imgDims).scaleX;
  return (
    <div
      className="position-absolute px-2 py-1 rounded text-white small bg-black"
      style={{
        left: position.x,
        top: position.y - offset - 8,
        transform: 'translate(-50%, -100%)',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        zIndex: 3,
      }}
    >
      {labels.join(' · ')}
    </div>
  );
}
