import { httpGet, httpSend } from '../../lib/http';
import type {
  GameRulesSettings,
  GenerateMapInput,
  SavedBot,
} from '../../lib/types';
import type { EarthRecipe } from '../../maps/editor/world/generateWorldMap';

export const MAX_PRESET_NAME_LENGTH = 30;

export type PresetSettings = Omit<
  GameRulesSettings,
  'mapName' | 'mapGeneration' | 'playerMapId'
> & {
  mapName: string;
  mapGeneration: GenerateMapInput | null;
  playerMapId: string | null;
  slots: number;
  bots: SavedBot[];
};

export interface Preset {
  name: string;
  settings: PresetSettings;
  earth: EarthRecipe | null;
}

export type Presets = (Preset | null)[];

type PresetsReply =
  { ok: true; presets: Presets } | { ok: false; error: string };

const earthRecipes = new Map<string, EarthRecipe>();

export function loadPresets(): Promise<PresetsReply> {
  return httpGet<PresetsReply>('/presets');
}

export function savePresets(presets: Presets): Promise<PresetsReply> {
  return httpSend<PresetsReply>('POST', '/presets', { presets });
}

export function rememberEarthRecipe(mapName: string, recipe: EarthRecipe) {
  earthRecipes.set(mapName, recipe);
}

export function earthRecipeFor(mapName: string): EarthRecipe | null {
  return earthRecipes.get(mapName) ?? null;
}

export function exportPreset(preset: Preset): void {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${preset.name}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function readPresetFile(file: File): Promise<Preset> {
  return file.text().then((text) => {
    const parsed = JSON.parse(text) as Partial<Preset> | null;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.name !== 'string' ||
      !parsed.settings ||
      typeof parsed.settings !== 'object'
    )
      throw new Error('invalid preset file');
    return {
      name: parsed.name.slice(0, MAX_PRESET_NAME_LENGTH),
      settings: parsed.settings,
      earth: parsed.earth ?? null,
    };
  });
}
