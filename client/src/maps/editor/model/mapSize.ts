import { MAP_SIZE_VALUES, mapImageSize, mapSizeLabel } from 'engine';

export function mapSizeText(width: number, height: number): string {
  const match = MAP_SIZE_VALUES.find((s) => {
    const m = mapImageSize(s);
    return m.width === width && m.height === height;
  });
  return match ? mapSizeLabel(match) : 'Custom';
}
