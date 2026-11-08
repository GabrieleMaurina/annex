import { useEffect, useRef } from 'react';
import { isTypingTarget } from '../../game/GameMap/helpers';
import { PLAYER_COLORS } from '../../lib/palette';
import { drawWorld } from './draw';
import { isBackground, scanObstacles } from './obstacles';
import { updateWorld } from './tank';
import type { TankKind } from './world';
import {
  BARRIER_SIZE,
  MINE_SPACING,
  blast,
  clampTanks,
  createWorld,
  extendLine,
  spawnBarrier,
  spawnMine,
  spawnTank,
} from './world';

type LineKind = 'barrier' | 'mine';

const LINES = {
  barrier: { size: BARRIER_SIZE, spawn: spawnBarrier },
  mine: { size: MINE_SPACING, spawn: spawnMine },
};

const DIGIT_KEY = /^(?:Digit|Numpad)(\d)$/;
const MAX_DT = 0.1;
const SCAN_MS = 200;
const RESCAN_MS = 1000;
const INITIAL_TANKS = 3;
const HOLD_DELAY_MS = 250;
const REPEAT_MS = 100;
const GATE_ANIMATION = 'page-gate-left';
const COVERING_MODAL = '.modal-fullscreen';

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
    let blockDrag = false;
    let hold: {
      event: PointerEvent;
      tank: boolean;
      next: number;
      moved: boolean;
      onBackground: boolean;
    } | null = null;
    let lineHold: LineKind | null = null;
    let lineAnchor: { x: number; y: number } | null = null;
    let ctrlDown = false;
    let lastMouse: PointerEvent | null = null;
    let keyHold: {
      code: string;
      color: string;
      next: number;
      checked: PointerEvent;
      onBackground: boolean;
    } | null = null;

    function tankKind(ctrl: boolean): TankKind {
      return ctrl ? 'gun' : 'cannon';
    }

    function onKey(event: KeyboardEvent) {
      ctrlDown = event.ctrlKey;
    }

    function onKeyDown(event: KeyboardEvent) {
      onKey(event);
      const digit = DIGIT_KEY.exec(event.code)?.[1];
      if (digit === undefined) return;
      if (keyHold?.code === event.code) {
        if (event.ctrlKey) event.preventDefault();
        return;
      }
      if (
        !lastMouse ||
        event.repeat ||
        event.metaKey ||
        event.altKey ||
        isTypingTarget(event.target) ||
        !isBackground(lastMouse, canvas)
      ) {
        return;
      }
      if (event.ctrlKey) event.preventDefault();
      keyHold = {
        code: event.code,
        color: PLAYER_COLORS[(Number(digit) + 9) % 10],
        next: performance.now() + HOLD_DELAY_MS,
        checked: lastMouse,
        onBackground: true,
      };
      addTank(
        lastMouse.clientX,
        lastMouse.clientY,
        tankKind(event.ctrlKey),
        keyHold.color,
      );
    }

    function onKeyUp(event: KeyboardEvent) {
      onKey(event);
      if (keyHold?.code === event.code) keyHold = null;
    }

    function onBlur() {
      endHold();
      keyHold = null;
    }

    function repeatKeyHold(now: number) {
      if (!keyHold || !lastMouse || now < keyHold.next) return;
      keyHold.next = now + REPEAT_MS;
      if (keyHold.checked !== lastMouse) {
        keyHold.checked = lastMouse;
        keyHold.onBackground = isBackground(lastMouse, canvas);
      }
      if (!keyHold.onBackground) return;
      addTank(
        lastMouse.clientX,
        lastMouse.clientY,
        tankKind(ctrlDown),
        keyHold.color,
      );
    }

    function addTank(x: number, y: number, kind: TankKind, color?: string) {
      spawnTank(world, x, y, kind, color);
      clampTanks(world);
    }

    function onPointerDown(event: PointerEvent) {
      ctrlDown = event.ctrlKey;
      pressedOnBackground = isBackground(event, canvas);
      const mouse = event.pointerType === 'mouse';
      blockDrag =
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
      lineHold =
        pressedOnBackground && mouse && event.button === 1
          ? event.ctrlKey
            ? 'mine'
            : 'barrier'
          : null;
      lineAnchor = null;
      if (lineHold) layLine(event, lineHold);
    }

    function layLine(event: PointerEvent, kind: LineKind) {
      const { clientX: x, clientY: y } = event;
      const { size, spawn } = LINES[kind];
      if (
        lineAnchor &&
        Math.max(Math.abs(x - lineAnchor.x), Math.abs(y - lineAnchor.y)) < size
      ) {
        return;
      }
      if (!isBackground(event, canvas)) lineAnchor = null;
      else if (lineAnchor) {
        lineAnchor = extendLine(world, lineAnchor, x, y, size, spawn);
      } else lineAnchor = spawn(world, x, y);
      redraw = true;
    }

    function onPointerMove(event: PointerEvent) {
      ctrlDown = event.ctrlKey;
      if (event.pointerType === 'mouse') lastMouse = event;
      if (lineHold) layLine(event, lineHold);
      if (!hold) return;
      hold.event = event;
      hold.moved = true;
    }

    function onPointerUp(event: PointerEvent) {
      endHold();
      if (event.pointerType === 'mouse') blockDrag = false;
    }

    function endHold() {
      hold = null;
      lineHold = null;
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

    function preventDrag(event: Event) {
      if (blockDrag) event.preventDefault();
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
      if (document.querySelector(COVERING_MODAL)) {
        lastScan = -Infinity;
        return;
      }
      const busy = world.tanks.length > 0 || world.shells.length > 0;
      const sinceScan = now - lastScan;
      if (busy && ((dirty && sinceScan > SCAN_MS) || sinceScan > RESCAN_MS)) {
        world.obstacles = scanObstacles(canvas);
        lastScan = now;
        dirty = false;
      }
      repeatHold(now);
      repeatKeyHold(now);
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
    window.addEventListener('blur', onBlur);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('mousedown', onMouseDown, true);
    window.addEventListener('click', onClick);
    window.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('dragstart', preventDrag);
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
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('mousedown', onMouseDown, true);
      window.removeEventListener('click', onClick);
      window.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('dragstart', preventDrag);
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
