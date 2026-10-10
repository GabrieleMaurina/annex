import type { RefObject } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import {
  clamp,
  clampPan,
  createSettleSampler,
  getScales,
  MAX_ZOOM,
  MIN_ZOOM,
} from '../../../mapMath';
import { DEFAULT_TRANSFORM, type Camera } from '../../camera';
import { easeOutCubic } from '../../helpers';

const SETTLE_DURATION = 200;

export function useMapViewportAnimation(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  camera: Camera,
  imgDims: { w: number; h: number },
) {
  const settleRef = useRef<number | null>(null);

  const cancelSettle = useCallback(() => {
    if (settleRef.current !== null) {
      cancelAnimationFrame(settleRef.current);
      settleRef.current = null;
    }
  }, []);

  const resetView = useCallback(() => {
    cancelSettle();
    camera.set({ ...DEFAULT_TRANSFORM });
  }, [cancelSettle, camera]);

  useEffect(
    () => () => {
      if (settleRef.current !== null) cancelAnimationFrame(settleRef.current);
    },
    [],
  );

  useEffect(() => {
    document.addEventListener('fullscreenchange', resetView);
    return () => document.removeEventListener('fullscreenchange', resetView);
  }, [resetView]);

  const zoomAround = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      cancelSettle();
      const rect = canvas.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const canvasW = canvas.clientWidth;
      const canvasH = canvas.clientHeight;
      const { w: imgW, h: imgH } = imgDims;
      camera.set((prev) => {
        const { scaleX: oldSX, scaleY: oldSY } = getScales(
          canvasW,
          canvasH,
          prev.zoom,
          imgW,
          imgH,
        );
        const oldOffX = (canvasW - imgW * oldSX) / 2 + prev.offsetX;
        const oldOffY = (canvasH - imgH * oldSY) / 2 + prev.offsetY;
        const worldX = (px - oldOffX) / oldSX;
        const worldY = (py - oldOffY) / oldSY;
        const newZoom = clamp(prev.zoom * factor, MIN_ZOOM, MAX_ZOOM);
        const { scaleX: newSX, scaleY: newSY } = getScales(
          canvasW,
          canvasH,
          newZoom,
          imgW,
          imgH,
        );
        const { x, y } = clampPan(
          canvasW,
          canvasH,
          newSX,
          newSY,
          imgW,
          imgH,
          px - worldX * newSX - (canvasW - imgW * newSX) / 2,
          py - worldY * newSY - (canvasH - imgH * newSY) / 2,
        );
        return { zoom: newZoom, offsetX: x, offsetY: y };
      });
    },
    [canvasRef, imgDims, camera, cancelSettle],
  );

  function startSettle() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    cancelSettle();
    const { zoom, offsetX, offsetY } = camera.get();
    const settle = createSettleSampler(
      canvas.clientWidth,
      canvas.clientHeight,
      zoom,
      imgDims.w,
      imgDims.h,
      offsetX,
      offsetY,
    );
    const { target } = settle;
    if (settle.settled) {
      if (offsetX !== target.x || offsetY !== target.y) {
        camera.set((t) => ({ ...t, offsetX: target.x, offsetY: target.y }));
      }
      return;
    }
    const begin = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - begin) / SETTLE_DURATION, 1);
      if (progress >= 1) {
        camera.set((t) => ({ ...t, offsetX: target.x, offsetY: target.y }));
        settleRef.current = null;
        return;
      }
      const next = settle.sample(easeOutCubic(progress));
      camera.set((t) => ({ ...t, offsetX: next.x, offsetY: next.y }));
      settleRef.current = requestAnimationFrame(animate);
    };
    settleRef.current = requestAnimationFrame(animate);
  }

  return { zoomAround, startSettle, cancelSettle, resetView };
}
