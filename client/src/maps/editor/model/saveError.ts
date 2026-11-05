import {
  duplicatePlaceNames,
  isValidPlaceName,
  MAX_PLACE_NAME_LENGTH,
} from 'engine';
import { graphError } from '../graph';
import type { EditorTile } from '../tiles/editorTiles';
import { allPlaceNames, type EditorTerritory } from './editorTypes';

interface SaveInput {
  name: string;
  nameError: string;
  territories: EditorTerritory[];
  tiles: EditorTile[];
  continentCount: number;
  continentNames: string[];
  width: number;
  height: number;
}

export function saveError({
  name,
  nameError,
  territories,
  tiles,
  continentCount,
  continentNames,
  width,
  height,
}: SaveInput): string | null {
  if (!name) return 'Enter a map name.';
  if (nameError) return nameError;
  if (territories.length === 0)
    return 'Add at least one territory before saving.';
  const outside = tiles.some((tile) =>
    tile.points.some(([x, y]) => x < 0 || y < 0 || x > width || y > height),
  );
  if (outside) return 'Tiles must fit inside the image.';
  const graphProblem = graphError(territories, continentCount);
  if (graphProblem) return graphProblem;
  const placeNames = allPlaceNames(territories, continentNames);
  const badNames = [
    ...placeNames.filter((n) => !isValidPlaceName(n)),
    ...duplicatePlaceNames(placeNames),
  ];
  if (badNames.length > 0)
    return `Names must be unique, at most ${MAX_PLACE_NAME_LENGTH} characters, with no profanity: ${badNames.join(', ')}`;
  return null;
}
