import {
  DEFAULT_MIN_REPUTATION,
  joinReputation,
  MIN_REPUTATION_VALUES,
  type OsmGeneratedMap,
} from 'engine';
import { connector } from '../connector';
import { publish } from '../connector/inbound';
import {
  loadEarthRecipe,
  rememberEarthRecipe,
  type Preset,
} from '../lobby/settings/presets';
import { readSurface, surfaceToDataUrl } from '../maps/editor/paint/surface';
import type { EarthRecipe } from '../maps/editor/world/generateWorldMap';
import { randomMapInput } from '../maps/randomMap';
import {
  getGameBots,
  getGameLocalPlayers,
  getGameSettings,
  getGameSlots,
  getOwnAccount,
  isLoggedIn,
  recordRestoredBotInput,
  resetRestoredBotInputs,
} from './player';
import type {
  Ack,
  GameRulesSettings,
  GameState,
  GenerateMapInput,
  SavedBot,
} from './types';

const GUEST_SLOTS = 6;
const GUEST_BOTS: SavedBot[] = Array.from({ length: 5 }, () => ({
  difficulty: 'easy',
  personality: 'random',
}));

let regeneratingMap = false;
let mapLoad = 0;
let cancelledAt = -1;
let cancelEarthJob: (() => void) | null = null;

export function isRegeneratingMap(): boolean {
  return regeneratingMap;
}

function setRegeneratingMap(value: boolean): void {
  regeneratingMap = value;
  publish('map:regenerating', value);
}

function startMapLoad(): number {
  mapLoad += 1;
  setRegeneratingMap(true);
  return mapLoad;
}

function apply(res: Ack): void {
  if (res.ok) publish('game:state', res.game);
}

export function cancelMapLoad(): void {
  mapLoad += 1;
  cancelledAt = mapLoad;
  cancelEarthJob?.();
  cancelEarthJob = null;
  setRegeneratingMap(false);
  connector.clearMap(apply);
}

function generateMap(
  input: GenerateMapInput,
  onAck: (res: Ack) => void = apply,
): void {
  const load = startMapLoad();
  connector.generateMap(input, (res) => {
    if (load !== mapLoad) return;
    setRegeneratingMap(false);
    onAck(res);
  });
}

export function uploadEarthMap(
  map: OsmGeneratedMap,
  onAck: (res: Ack) => void,
): Promise<void> {
  const { imageSrc, ...rest } = map;
  return readSurface(imageSrc)
    .then(surfaceToDataUrl)
    .then((image) =>
      connector.selectEarthMap({ ...rest, wraps: [], image }, onAck),
    );
}

function regenerateEarthMap(
  recipe: EarthRecipe,
  onAck: (res: Ack) => void,
): void {
  const load = startMapLoad();
  import('../maps/editor/world/generateWorldMap')
    .then(({ generateEarthMap }) => {
      const job = generateEarthMap(Promise.resolve(recipe), () => {});
      cancelEarthJob = job.cancel;
      return job.promise;
    })
    .then((map) => {
      if (load !== mapLoad) return;
      cancelEarthJob = null;
      return uploadEarthMap(map, (res) => {
        if (load !== mapLoad) {
          if (res.ok && mapLoad === cancelledAt) connector.clearMap(apply);
          return;
        }
        setRegeneratingMap(false);
        if (res.ok) rememberEarthRecipe(res.game.mapName, recipe);
        onAck(res);
      });
    })
    .catch(() => {
      if (load !== mapLoad) return;
      setRegeneratingMap(false);
      onAck({ ok: false, error: 'could not regenerate the Earth map' });
    });
}

function applyOrRandom(res: Ack): void {
  if (res.ok) apply(res);
  else generateMap(randomMapInput());
}

function applySavedEarthMap(): void {
  loadEarthRecipe()
    .then((recipe) => {
      if (recipe) regenerateEarthMap(recipe, applyOrRandom);
      else generateMap(randomMapInput());
    })
    .catch(() => generateMap(randomMapInput()));
}

function applySavedMap(
  mapGeneration: GenerateMapInput | undefined,
  playerMapId: string | null | undefined,
): void {
  if (mapGeneration) {
    generateMap(mapGeneration);
  } else if (playerMapId) {
    connector.selectPlayerMap({ mapId: playerMapId }, applyOrRandom);
  } else if (isLoggedIn()) {
    applySavedEarthMap();
  } else {
    generateMap(randomMapInput());
  }
}

function seatBots(
  slots: number,
  bots: SavedBot[],
  onAck: (res: Ack) => void = apply,
): void {
  resetRestoredBotInputs();
  connector.updateSettings({ slots }, onAck);
  bots.forEach((bot, index) => {
    connector.addBot(
      { difficulty: bot.difficulty, personality: bot.personality },
      (res: Ack) => {
        onAck(res);
        if (!res.ok) return;
        const seated = res.game.players.filter((p) => p.isBot);
        if (seated[index]) recordRestoredBotInput(seated[index].id, bot);
      },
    );
  });
}

function reachableMinReputation(saved: number): number {
  if (connector.isOffline()) return saved;
  const account = getOwnAccount();
  const own = joinReputation(
    {
      reputation: account?.reputation ?? null,
      reputationRecoveryFrom: null,
      accountCreatedAt: account?.createdAt ?? null,
    },
    Date.now(),
  );
  const highest = Math.max(
    ...MIN_REPUTATION_VALUES.filter((value) => value <= own),
  );
  return Math.min(saved, highest);
}

function applyRules(
  {
    minAccountAge,
    minGames,
    minRank,
    minReputation,
    ...rules
  }: Omit<GameRulesSettings, 'mapName' | 'mapGeneration' | 'playerMapId'>,
  onAck: (res: Ack) => void = apply,
): void {
  if (Object.keys(rules).length > 0) connector.updateSettings(rules, onAck);
  connector.updateSettings({ minAccountAge, minGames, minRank }, onAck);
  connector.updateSettings(
    {
      minReputation: reachableMinReputation(
        minReputation ?? DEFAULT_MIN_REPUTATION,
      ),
    },
    onAck,
  );
}

export function applySavedGameSettings(): void {
  const { mapGeneration, playerMapId, mapName, ...rules } = getGameSettings();
  void mapName;
  if (!isLoggedIn()) {
    applySavedMap(mapGeneration, playerMapId);
    seatBots(GUEST_SLOTS, GUEST_BOTS);
    return;
  }
  applyRules(rules);
  applySavedMap(mapGeneration, playerMapId);
  seatBots(getGameSlots(), getGameBots());
  if (connector.isOffline())
    for (const name of getGameLocalPlayers()) connector.addLocalPlayer(name);
}

export function applyPreset(
  preset: Preset,
  game: GameState,
  onAck: (res: Ack) => void,
): void {
  const { mapName, mapGeneration, playerMapId, slots, bots, ...rules } =
    preset.settings;
  void mapName;
  applyRules(rules, onAck);
  const currentBots = game.players.filter((p) => p.isBot);
  for (const bot of currentBots)
    connector.removeBot({ botPlayerId: bot.id }, onAck);
  const humans = game.players.length - currentBots.length;
  const seats = Math.max(slots, humans);
  seatBots(seats, bots.slice(0, seats - humans), onAck);
  if (mapGeneration) generateMap(mapGeneration, onAck);
  else if (playerMapId)
    connector.selectPlayerMap({ mapId: playerMapId }, onAck);
  else if (preset.earth) regenerateEarthMap(preset.earth, onAck);
}
