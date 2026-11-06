import { MapSwitch, SwitchedLink, Territory } from '../types';
import { GridDimensions } from './core/params';
import { randomInt, Rng } from './core/rng';

const SHARE_CHANCE = 0.3;
const SECOND_SWITCH_CHANCE = 0.25;
const SPACING_PER_LONGEST_SIDE = 25;
const NEAR_CHOICES = 3;
const FAR_CHANCE = 0.1;
const SHARE_REACH_SPACINGS = 2;

interface Spot {
  a: number;
  b: number;
  x: number;
  y: number;
}

interface GeneratedSwitches {
  switches: MapSwitch[];
  switchedLinks: SwitchedLink[];
}

function borderSpots(territories: Territory[]): Spot[] {
  const byId = new Map(territories.map((t) => [t.id, t]));
  return territories.flatMap((t) =>
    t.neighbors.flatMap((n) => {
      const other = byId.get(n);
      if (!other || n < t.id) return [];
      return [
        {
          a: t.id,
          b: n,
          x: Math.round((t.x + other.x) / 2),
          y: Math.round((t.y + other.y) / 2),
        },
      ];
    }),
  );
}

function distanceToSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const t =
    lengthSq === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq),
        );
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function generateSwitches(
  rng: Rng | null,
  territories: Territory[],
  links: { a: number; b: number }[],
  dims: GridDimensions,
): GeneratedSwitches {
  if (!rng || links.length === 0) return { switches: [], switchedLinks: [] };
  const byId = new Map(territories.map((t) => [t.id, t]));
  const spacing = Math.max(dims.width, dims.height) / SPACING_PER_LONGEST_SIDE;
  const taken = links.map(({ a, b }) => ({
    x: (byId.get(a)!.x + byId.get(b)!.x) / 2,
    y: (byId.get(a)!.y + byId.get(b)!.y) / 2,
  }));
  const spots = borderSpots(territories);
  const switches: MapSwitch[] = [];
  const switchedLinks: SwitchedLink[] = [];

  const distanceTo = (
    link: { a: number; b: number },
    p: { x: number; y: number },
  ) => distanceToSegment(p, byId.get(link.a)!, byId.get(link.b)!);

  const placeSwitch = (
    link: { a: number; b: number },
    far: boolean,
  ): number | null => {
    const free = spots.filter(
      (spot) =>
        ![spot.a, spot.b].some((id) => id === link.a || id === link.b) &&
        taken.every((p) => Math.hypot(p.x - spot.x, p.y - spot.y) >= spacing),
    );
    if (free.length === 0) return null;
    const choices = far
      ? free
      : [...free]
          .sort((p, q) => distanceTo(link, p) - distanceTo(link, q))
          .slice(0, NEAR_CHOICES);
    const spot = choices[randomInt(rng, 0, choices.length - 1)];
    taken.push(spot);
    switches.push({
      x: spot.x,
      y: spot.y,
      on: rng() < 0.5,
      neighbors: [spot.a, spot.b],
    });
    return switches.length - 1;
  };

  const pickSwitch = (
    link: { a: number; b: number },
    used: number[],
  ): number | null => {
    const far = rng() < FAR_CHANCE;
    const shared = switches.flatMap((s, i) =>
      used.includes(i) ||
      (!far && distanceTo(link, s) > spacing * SHARE_REACH_SPACINGS)
        ? []
        : [i],
    );
    if (shared.length > 0 && rng() < SHARE_CHANCE)
      return shared[randomInt(rng, 0, shared.length - 1)];
    return placeSwitch(link, far);
  };

  const pool = [...links];
  const count = randomInt(rng, 1, Math.ceil(links.length / 2));
  for (let i = 0; i < count; i++) {
    const [link] = pool.splice(randomInt(rng, 0, pool.length - 1), 1);
    const first = pickSwitch(link, []);
    if (first === null) continue;
    const ids = [first];
    if (rng() < SECOND_SWITCH_CHANCE) {
      const second = pickSwitch(link, ids);
      if (second !== null) ids.push(second);
    }
    switchedLinks.push({
      a: link.a,
      b: link.b,
      switches: ids,
      gate: ids.length > 1 && rng() < 0.5 ? 'and' : 'or',
    });
  }
  return { switches, switchedLinks };
}
