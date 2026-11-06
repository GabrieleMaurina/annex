import { OsmLine, OsmRiver } from '../types';

const UNRANKED = Number.MAX_SAFE_INTEGER;
const NAME_SEPARATOR = /\s+-\s+|\//;

interface Endpoint {
  x: number;
  y: number;
  index: number;
}

function sameWord(a: string, b: string): boolean {
  return (
    a === b ||
    a.endsWith(` ${b}`) ||
    a.startsWith(`${b} `) ||
    b.endsWith(` ${a}`) ||
    b.startsWith(`${a} `)
  );
}

function sameRiver(a: string[], b: string[]): boolean {
  return a.some((x) => b.some((y) => sameWord(x, y)));
}

function nameParts(name: string): string[] {
  return name.split(NAME_SEPARATOR).map((part) => part.trim());
}

export function waterwayRivers(
  lines: OsmLine[],
  joinDistance: number,
): OsmRiver[] {
  const rivers = lines.filter(
    ({ layer, cls, name, points }) =>
      layer === 'waterway' && cls === 'river' && name && points.length >= 4,
  );
  const names = rivers.map(({ name }) => nameParts(name));
  const parent = rivers.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const cells = new Map<string, Endpoint[]>();
  const cellOf = (value: number) => Math.floor(value / joinDistance);
  rivers.forEach(({ points }, index) => {
    const ends = [
      [points[0], points[1]],
      [points[points.length - 2], points[points.length - 1]],
    ];
    for (const [x, y] of ends) {
      for (let cx = cellOf(x) - 1; cx <= cellOf(x) + 1; cx++)
        for (let cy = cellOf(y) - 1; cy <= cellOf(y) + 1; cy++)
          for (const other of cells.get(`${cx},${cy}`) ?? [])
            if (
              Math.hypot(other.x - x, other.y - y) <= joinDistance &&
              sameRiver(names[index], names[other.index])
            )
              parent[find(index)] = find(other.index);
      const key = `${cellOf(x)},${cellOf(y)}`;
      cells.set(key, [...(cells.get(key) ?? []), { x, y, index }]);
    }
  });
  const grouped = new Map<number, number[][]>();
  rivers.forEach(({ points }, index) => {
    const root = find(index);
    grouped.set(root, [...(grouped.get(root) ?? []), points]);
  });
  return [...grouped.values()].map((group) => ({
    rank: UNRANKED,
    lines: group,
  }));
}
