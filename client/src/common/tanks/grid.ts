import type { Tank } from './world';

export const CELL_SIZE = 70;
const MAX_ROWS = 4096;

export type TankGrid = Map<number, Tank[]>;

function cellKey(x: number, y: number, dx = 0, dy = 0): number {
  return (
    (Math.floor(x / CELL_SIZE) + dx) * MAX_ROWS + Math.floor(y / CELL_SIZE) + dy
  );
}

export function buildTankGrid(tanks: Tank[]): TankGrid {
  const grid: TankGrid = new Map();
  tanks.forEach((tank) => {
    const key = cellKey(tank.x, tank.y);
    const cell = grid.get(key);
    if (cell) cell.push(tank);
    else grid.set(key, [tank]);
  });
  return grid;
}

export function forEachTankInRing(
  grid: TankGrid,
  x: number,
  y: number,
  ring: number,
  visit: (tank: Tank) => void,
) {
  for (let dx = -ring; dx <= ring; dx++) {
    const step = Math.abs(dx) === ring ? 1 : 2 * ring;
    for (let dy = -ring; dy <= ring; dy += step) {
      grid.get(cellKey(x, y, dx, dy))?.forEach(visit);
    }
  }
}

export function removeFromGrid(grid: TankGrid, tank: Tank) {
  const cell = grid.get(cellKey(tank.x, tank.y));
  if (cell) cell.splice(cell.indexOf(tank), 1);
}
