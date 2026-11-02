import {
  DEFAULT_BORDER_COLORS,
  EARTH_TONES,
  SEA_COLOR,
  type PlayerGameMap,
} from 'engine';

export type TutorialGameMap = PlayerGameMap & { name: string };

interface Layout {
  name: string;
  coastRadius: number;
  centers: number[][];
  neighbors: number[][];
  continents: number[];
  bonuses: number[];
  seas: { x: number; y: number; neighbors: number[] }[];
}

const WIDTH = 1800;
const HEIGHT = 1080;
const COAST_WOBBLE = 16;
const BORDER_HALF_WIDTH = 3;
const SEA = -1;

export const LAND: Layout = {
  name: 'Tutorial',
  coastRadius: 235,
  centers: [
    [590, 390],
    [900, 360],
    [1210, 400],
    [440, 700],
    [750, 700],
    [1060, 720],
    [1360, 690],
  ],
  neighbors: [
    [1, 3, 4],
    [0, 2, 4, 5],
    [1, 5, 6],
    [0, 4],
    [0, 1, 3, 5],
    [1, 2, 4, 6],
    [2, 5],
  ],
  continents: [0, 1, 1, 0, 0, 1, 1],
  bonuses: [2, 3],
  seas: [],
};

const NAVAL: Layout = {
  name: 'Naval Tutorial',
  coastRadius: 240,
  centers: [
    [420, 330],
    [420, 750],
    [760, 540],
    [1400, 380],
    [1400, 720],
  ],
  neighbors: [
    [1, 2, 5],
    [0, 2, 5],
    [0, 1, 5],
    [4, 5],
    [3, 5],
  ],
  continents: [0, 0, 0, 1, 1],
  bonuses: [2, 1],
  seas: [{ x: 1080, y: 540, neighbors: [0, 1, 2, 3, 4] }],
};

const cache = new Map<string, TutorialGameMap>();

function rgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function labelAt(layout: Layout, x: number, y: number): number {
  let nearest = SEA;
  let nearestDistance = Infinity;
  layout.centers.forEach(([cx, cy], id) => {
    const distance = (x - cx) ** 2 + (y - cy) ** 2;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = id;
    }
  });
  const coast =
    layout.coastRadius + COAST_WOBBLE * Math.sin(x / 57) * Math.cos(y / 43);
  return nearestDistance < coast * coast ? nearest : SEA;
}

function drawImage(layout: Layout): string {
  const labels = new Int8Array(WIDTH * HEIGHT);
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++)
      labels[y * WIDTH + x] = labelAt(layout, x, y);

  const labelNear = (x: number, y: number) =>
    labels[
      Math.min(HEIGHT - 1, Math.max(0, y)) * WIDTH +
        Math.min(WIDTH - 1, Math.max(0, x))
    ];
  const border = rgb(DEFAULT_BORDER_COLORS[0]);
  const sea = rgb(SEA_COLOR);
  const lands = layout.bonuses.map((_, continent) =>
    rgb(EARTH_TONES[continent]),
  );

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(WIDTH, HEIGHT);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const label = labels[y * WIDTH + x];
      const onBorder =
        labelNear(x - BORDER_HALF_WIDTH, y) !== label ||
        labelNear(x + BORDER_HALF_WIDTH, y) !== label ||
        labelNear(x, y - BORDER_HALF_WIDTH) !== label ||
        labelNear(x, y + BORDER_HALF_WIDTH) !== label;
      const color = onBorder
        ? border
        : label === SEA
          ? sea
          : lands[layout.continents[label]];
      const offset = (y * WIDTH + x) * 4;
      image.data[offset] = color[0];
      image.data[offset + 1] = color[1];
      image.data[offset + 2] = color[2];
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}

function buildMap(layout: Layout): TutorialGameMap {
  const cached = cache.get(layout.name);
  if (cached) return cached;
  const map: TutorialGameMap = {
    id: null,
    name: layout.name,
    territories: layout.centers.map(([x, y], id) => ({
      id,
      continentId: layout.continents[id],
      x,
      y,
      neighbors: layout.neighbors[id],
    })),
    seaTerritories: layout.seas.map((sea, i) => ({
      id: layout.centers.length + i,
      ...sea,
    })),
    bonuses: layout.bonuses,
    wraps: [],
    timedConnections: [],
    lockedTiles: [],
    imageSrc: drawImage(layout),
    borderColors: DEFAULT_BORDER_COLORS,
    territoryNames: null,
    seaNames: null,
    continentNames: null,
  };
  cache.set(layout.name, map);
  return map;
}

export function tutorialMap(): TutorialGameMap {
  return buildMap(LAND);
}

export function navalTutorialMap(): TutorialGameMap {
  return buildMap(NAVAL);
}
