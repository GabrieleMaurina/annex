export interface Territory {
  id: number;
  continentId: number;
  x: number;
  y: number;
  neighbors: number[];
}

export interface MapFile {
  territories: Territory[];
  image: string;
}
