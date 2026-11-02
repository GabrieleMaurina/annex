import { useEffect, useRef } from 'react';
import { drawWorld } from './draw';
import { isBackground, scanObstacles } from './obstacles';
import { updateWorld } from './tank';
import type { TankKind } from './world';
import {
  BARRIER_SIZE,
  blast,
  clampTanks,
  createWorld,
  extendBarrierLine,
  spawnBarrier,
  spawnTank,
} from './world';

const MAX_DT = 0.1;
const SCAN_MS = 200;
const RESCAN_MS = 1000;
const INITIAL_TANKS = 3;
const HOLD_DELAY_MS = 250;
const REPEAT_MS = 100;
const GATE_ANIMATION = 'page-gate-left';

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
    let redraw = true;
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
      redraw = true;
    }
    resize();

    let pressedOnBackground = false;
    let blockSelection = false;
    let hold: {
      event: PointerEvent;
      tank: boolean;
      next: number;
      moved: boolean;
      onBackground: boolean;
    } | null = null;
    let barrierHold = false;
    let barrierAnchor: { x: number; y: number } | null = null;
    let ctrlDown = false;

    function tankKind(ctrl: boolean): TankKind {
      return ctrl ? 'gun' : 'cannon';
    }

    function onKey(event: KeyboardEvent) {
      ctrlDown = event.ctrlKey;
    }

    function addTank(x: number, y: number, kind: TankKind) {
      spawnTank(world, x, y, kind);
      clampTanks(world);
    }

    function onPointerDown(event: PointerEvent) {
      ctrlDown = event.ctrlKey;
      pressedOnBackground = isBackground(event, canvas);
      const mouse = event.pointerType === 'mouse';
      blockSelection =
        pressedOnBackground && (mouse || event.pointerType === 'touch');
      hold =
        pressedOnBackground &&
        mouse &&
        (event.button === 0 || event.button === 2)
          ? {
              event,
              tank: event.button === 2,
              next: performance.now() + HOLD_DELAY_MS,
              moved: false,
              onBackground: true,
            }
          : null;
      barrierHold = pressedOnBackground && mouse && event.button === 1;
      barrierAnchor = null;
      if (barrierHold) layBarriers(event);
    }

    function layBarriers(event: PointerEvent) {
      const { clientX: x, clientY: y } = event;
      if (
        barrierAnchor &&
        Math.max(Math.abs(x - barrierAnchor.x), Math.abs(y - barrierAnchor.y)) <
          BARRIER_SIZE
      ) {
        return;
      }
      if (!isBackground(event, canvas)) barrierAnchor = null;
      else if (barrierAnchor) {
        barrierAnchor = extendBarrierLine(world, barrierAnchor, x, y);
      } else barrierAnchor = spawnBarrier(world, x, y);
      redraw = true;
    }

    function onPointerMove(event: PointerEvent) {
      ctrlDown = event.ctrlKey;
      if (barrierHold) layBarriers(event);
      if (!hold) return;
      hold.event = event;
      hold.moved = true;
    }

    function onPointerUp(event: PointerEvent) {
      endHold();
      if (event.pointerType === 'mouse') blockSelection = false;
    }

    function endHold() {
      hold = null;
      barrierHold = false;
    }

    function repeatHold(now: number) {
      if (!hold || now < hold.next) return;
      hold.next = now + REPEAT_MS;
      if (hold.moved) {
        hold.onBackground = isBackground(hold.event, canvas);
        hold.moved = false;
      }
      if (!hold.onBackground) return;
      const { clientX: x, clientY: y } = hold.event;
      if (hold.tank) addTank(x, y, tankKind(ctrlDown));
      else blast(world, x, y, now);
    }

    function onMouseDown(event: MouseEvent) {
      if (event.button === 1 && pressedOnBackground) event.preventDefault();
    }

    function preventSelection(event: Event) {
      if (blockSelection) event.preventDefault();
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
      addTank(event.clientX, event.clientY, tankKind(event.ctrlKey));
    }

    function markDirty() {
      dirty = true;
    }

    let last = performance.now();
    let lastScan = last;
    let drawn = true;
    let frame = 0;
    let gateOpening = false;

    function onGateAnimation(event: AnimationEvent) {
      if (event.animationName !== GATE_ANIMATION) return;
      gateOpening = event.type === 'animationstart';
      if (!gateOpening) lastScan = -Infinity;
    }

    function step(now: number) {
      frame = requestAnimationFrame(step);
      const dt = Math.min(Math.max((now - last) / 1000, 0), MAX_DT);
      last = now;
      if (gateOpening) return;
      const busy = world.tanks.length > 0 || world.shells.length > 0;
      const sinceScan = now - lastScan;
      if (busy && ((dirty && sinceScan > SCAN_MS) || sinceScan > RESCAN_MS)) {
        world.obstacles = scanObstacles(canvas);
        lastScan = now;
        dirty = false;
      }
      repeatHold(now);
      updateWorld(world, dt, now);
      const visible =
        busy || world.marks.length > 0 || world.explosions.length > 0;
      if (visible || drawn || redraw) drawWorld(ctx, world, now);
      drawn = visible;
      redraw = false;
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
    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', endHold, true);
    window.addEventListener('blur', endHold);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    window.addEventListener('mousedown', onMouseDown, true);
    window.addEventListener('click', onClick);
    window.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('selectstart', preventSelection);
    document.addEventListener('dragstart', preventSelection);
    document.addEventListener('animationstart', onGateAnimation);
    document.addEventListener('animationend', onGateAnimation);
    document.addEventListener('animationcancel', onGateAnimation);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', markDirty, true);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('pointercancel', endHold, true);
      window.removeEventListener('blur', endHold);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
      window.removeEventListener('mousedown', onMouseDown, true);
      window.removeEventListener('click', onClick);
      window.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('selectstart', preventSelection);
      document.removeEventListener('dragstart', preventSelection);
      document.removeEventListener('animationstart', onGateAnimation);
      document.removeEventListener('animationend', onGateAnimation);
      document.removeEventListener('animationcancel', onGateAnimation);
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
