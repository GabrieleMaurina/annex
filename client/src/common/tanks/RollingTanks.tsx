import { useEffect, useRef } from 'react';
import { drawWorld } from './draw';
import { isBackground, scanObstacles } from './obstacles';
import { updateWorld } from './tank';
import { blast, clampTanks, createWorld, spawnTank } from './world';

const MAX_DT = 0.1;
const SCAN_MS = 200;
const RESCAN_MS = 1000;
const INITIAL_TANKS = 3;

interface Props {
  spawnInitial: boolean;
}

function RollingTanks({ spawnInitial }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spawnInitialRef = useRef(spawnInitial);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let dirty = false;
    const world = createWorld(
      window.innerWidth,
      window.innerHeight,
      spawnInitialRef.current ? INITIAL_TANKS : 0,
      scanObstacles(canvas),
    );

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      world.width = window.innerWidth;
      world.height = window.innerHeight;
      canvas.width = world.width * dpr;
      canvas.height = world.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      clampTanks(world);
      dirty = true;
    }
    resize();

    let pressedOnBackground = false;
    let touchedBackground = false;

    function onPointerDown(event: PointerEvent) {
      pressedOnBackground = isBackground(event, canvas);
      touchedBackground = pressedOnBackground && event.pointerType === 'touch';
    }

    function onSelectStart(event: Event) {
      if (touchedBackground) event.preventDefault();
    }

    function releasedOnBackground(event: MouseEvent) {
      const pressed = pressedOnBackground;
      pressedOnBackground = false;
      return pressed && isBackground(event, canvas);
    }

    function onClick(event: MouseEvent) {
      if (!releasedOnBackground(event)) return;
      blast(world, event.clientX, event.clientY, performance.now());
    }

    function onContextMenu(event: MouseEvent) {
      if (!releasedOnBackground(event)) return;
      event.preventDefault();
      spawnTank(world, event.clientX, event.clientY);
      clampTanks(world);
    }

    function markDirty() {
      dirty = true;
    }

    let last = performance.now();
    let lastScan = last;
    let drawn = true;
    let frame = 0;

    function step(now: number) {
      const dt = Math.min(Math.max((now - last) / 1000, 0), MAX_DT);
      last = now;
      const busy = world.tanks.length > 0 || world.shells.length > 0;
      const sinceScan = now - lastScan;
      if (busy && ((dirty && sinceScan > SCAN_MS) || sinceScan > RESCAN_MS)) {
        world.obstacles = scanObstacles(canvas);
        lastScan = now;
        dirty = false;
      }
      updateWorld(world, dt, now);
      const visible =
        busy || world.marks.length > 0 || world.explosions.length > 0;
      if (visible || drawn) drawWorld(ctx, world, now);
      drawn = visible;
      frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);

    const observer = new MutationObserver(markDirty);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    window.addEventListener('scroll', markDirty, true);
    window.addEventListener('resize', resize);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('click', onClick);
    window.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('selectstart', onSelectStart);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', markDirty, true);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('click', onClick);
      window.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('selectstart', onSelectStart);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="position-fixed top-0 start-0 w-100 h-100 pe-none z-n1"
    />
  );
}

export default RollingTanks;
