export interface CellLayer {
  width: number;
  height: number;
  cellCount: number;
  cellNeighbors: number[][];
  pixelCell: Int32Array;
  chambers: number[][];
}
