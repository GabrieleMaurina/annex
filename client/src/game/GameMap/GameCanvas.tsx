import type { RefObject } from 'react';
import {
  CURSOR_GRAB,
  CURSOR_GRABBING,
  CURSOR_POINTER,
} from '../../ui/cursors/cursors';
import type { PlaceNames, Territory } from '../mapData';
import type { Camera } from './camera';
import { computeTooltipLabels } from './helpers';
import type { useEmojiUI } from './hooks/useEmojiUI';
import type { useDisplayedGame } from './hooks/view/useDisplayedGame';
import type { useGameCanvasInteractions } from './hooks/view/useGameCanvasInteractions';
import TerritoryTooltip from './overlays/TerritoryTooltip';

type DisplayedGame = ReturnType<typeof useDisplayedGame>;

interface Props {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  interactions: ReturnType<typeof useGameCanvasInteractions>;
  pendingAttackEmoji: ReturnType<typeof useEmojiUI>['pendingAttackEmoji'];
  camera: Camera;
  territories: Territory[];
  size: { w: number; h: number };
  imgDims: { w: number; h: number };
  VERTEX_RADIUS: number;
  portalTerritoryIds: number[];
  radiationById: DisplayedGame['radiationById'];
  visibleTerritoryById: DisplayedGame['visibleTerritoryById'];
  ownerById: DisplayedGame['ownerById'];
  toxinById: DisplayedGame['toxinById'];
  placeNames: PlaceNames;
}

export default function GameCanvas({
  canvasRef,
  interactions,
  pendingAttackEmoji,
  camera,
  territories,
  size,
  imgDims,
  VERTEX_RADIUS,
  portalTerritoryIds,
  radiationById,
  visibleTerritoryById,
  ownerById,
  toxinById,
  placeNames,
}: Props) {
  const tooltipLabels = computeTooltipLabels(
    interactions.tooltipTerritoryId,
    portalTerritoryIds,
    radiationById,
    visibleTerritoryById,
    ownerById,
    toxinById,
    placeNames,
  );

  return (
    <>
      <canvas
        ref={canvasRef}
        onMouseDown={interactions.handleMouseDown}
        onMouseMove={interactions.handleMouseMove}
        onMouseUp={interactions.handleMouseUp}
        onMouseLeave={interactions.handleMouseLeave}
        onContextMenu={interactions.handleContextMenu}
        onAuxClick={interactions.handleAuxClick}
        onTouchStart={interactions.handleTouchStart}
        onTouchMove={interactions.handleTouchMove}
        onTouchEnd={interactions.handleTouchEnd}
        onTouchCancel={interactions.handleTouchCancel}
        style={{
          display: 'block',
          width: size.w,
          height: size.h,
          touchAction: 'none',
          cursor: pendingAttackEmoji
            ? 'crosshair'
            : interactions.hoveredId !== null
              ? CURSOR_POINTER
              : interactions.isDragging
                ? CURSOR_GRABBING
                : CURSOR_GRAB,
        }}
      />
      <TerritoryTooltip
        camera={camera}
        territory={territories.find(
          (t) => t.id === interactions.tooltipTerritoryId,
        )}
        labels={tooltipLabels}
        size={size}
        imgDims={imgDims}
        VERTEX_RADIUS={VERTEX_RADIUS}
      />
    </>
  );
}
