export interface Territory {
  id: number;
  continentId: number;
  x: number;
  y: number;
  neighbors: number[];
}

export interface Map {
  name: string;
  territories: Territory[];
  bonuses: number[];
  image: string | null;
  imageMime: string | null;
}
