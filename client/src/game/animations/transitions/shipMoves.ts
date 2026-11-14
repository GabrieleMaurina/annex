import { animationNow } from '../clock';

export interface ArrowPoint {
  x: number;
  y: number;
  seaId?: number;
  shipOwnerId?: number;
}

interface ShipMove {
  startedAt: number;
  target: { x: number; y: number };
  startWeight: number;
  peak: number;
  outMs: number;
  holdMs: number;
  backMs: number;
  held: boolean;
  joining?: number;
}

export const SHIP_SLIDE_MS = 350;
const SHIP_HOLD_MS = 550;
const SHIP_ARRIVE_MS = 450;
const SHIP_RELEASE_GRACE_MS = 300;

let moves = new Map<string, ShipMove>();
let holds = new Map<string, ShipMove>();

function moveKey(seaId: number, playerId: number): string {
  return `${seaId}:${playerId}`;
}

function smooth(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

function weightOf(move: ShipMove, now: number): number {
  const t = now - move.startedAt;
  if (t < 0) return move.startWeight;
  if (t < move.outMs)
    return (
      move.startWeight + (move.peak - move.startWeight) * smooth(t / move.outMs)
    );
  if (t < move.outMs + move.holdMs) return move.peak;
  return move.peak * (1 - smooth((t - move.outMs - move.holdMs) / move.backMs));
}

function currentWeight(key: string): number {
  const now = animationNow();
  const move = moves.get(key);
  const hold = holds.get(key);
  return Math.max(
    move ? weightOf(move, now) : 0,
    hold ? weightOf(hold, now) : 0,
  );
}

export function startShipShuttle(
  seaId: number,
  playerId: number,
  target: { x: number; y: number },
  delayMs: number,
) {
  const key = moveKey(seaId, playerId);
  moves.set(key, {
    startedAt: animationNow() + delayMs,
    target,
    startWeight: currentWeight(key),
    peak: 1,
    outMs: SHIP_SLIDE_MS,
    holdMs: SHIP_HOLD_MS,
    backMs: SHIP_SLIDE_MS,
    held: false,
  });
}

export function holdShip(
  seaId: number,
  playerId: number,
  target: { x: number; y: number },
) {
  const key = moveKey(seaId, playerId);
  holds.set(key, {
    startedAt: animationNow(),
    target,
    startWeight: currentWeight(key),
    peak: 1,
    outMs: SHIP_SLIDE_MS,
    holdMs: Infinity,
    backMs: SHIP_SLIDE_MS,
    held: true,
  });
}

export function releaseShip(seaId: number, playerId: number) {
  const key = moveKey(seaId, playerId);
  const current = holds.get(key);
  if (!current?.held) return;
  const weight = weightOf(current, animationNow());
  holds.set(key, {
    startedAt: animationNow(),
    target: current.target,
    startWeight: weight,
    peak: weight,
    outMs: 0,
    holdMs: SHIP_RELEASE_GRACE_MS,
    backMs: SHIP_SLIDE_MS,
    held: false,
  });
}

export function startShipArrival(
  seaId: number,
  playerId: number,
  origin: { x: number; y: number },
  joining: number,
) {
  moves.set(moveKey(seaId, playerId), {
    startedAt: animationNow(),
    target: origin,
    startWeight: 1,
    peak: 1,
    outMs: 0,
    holdMs: 0,
    backMs: SHIP_ARRIVE_MS,
    held: false,
    joining,
  });
}

export function shipPull(
  seaId: number,
  playerId: number,
): {
  target: { x: number; y: number };
  weight: number;
  joining?: number;
} | null {
  const key = moveKey(seaId, playerId);
  const move = moves.get(key);
  const hold = holds.get(key);
  const owner = move ?? hold;
  if (!owner) return null;
  return {
    target: owner.target,
    weight: currentWeight(key),
    joining: move?.joining,
  };
}

function pruneFinished(all: Map<string, ShipMove>, now: number) {
  for (const [key, move] of all)
    if (now - move.startedAt >= move.outMs + move.holdMs + move.backMs)
      all.delete(key);
}

export function pruneShipMoves() {
  const now = animationNow();
  pruneFinished(moves, now);
  pruneFinished(holds, now);
}

export function shipMovesActive(): boolean {
  const now = animationNow();
  if (moves.size > 0) return true;
  for (const hold of holds.values())
    if (!hold.held || now - hold.startedAt < hold.outMs) return true;
  return false;
}

export function clearShipMoves() {
  moves = new Map();
  holds = new Map();
}
