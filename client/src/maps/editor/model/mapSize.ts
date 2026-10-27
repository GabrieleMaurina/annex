import {
  aspectLabel,
  MAP_ASPECT_VALUES,
  MAP_SIZE_VALUES,
  mapImageSize,
  mapSizeLabel,
} from 'engine';

export function mapSizeText(width: number, height: number): string {
  for (const aspect of MAP_ASPECT_VALUES)
    for (const size of MAP_SIZE_VALUES) {
      const m = mapImageSize(size, aspect);
      if (m.width === width && m.height === height)
        return aspect === 'wide'
          ? mapSizeLabel(size)
          : `${mapSizeLabel(size)} ${aspectLabel(aspect)}`;
    }
  return 'Custom';
}
