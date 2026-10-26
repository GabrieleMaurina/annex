import { connector } from '../connector';
import { publish } from '../connector/inbound';
import { randomMapInput } from '../maps/randomMap';
import {
  getGameBots,
  getGameLocalPlayers,
  getGameSettings,
  getGameSlots,
  isLoggedIn,
  recordRestoredBotInput,
  resetRestoredBotInputs,
} from './player';
import type { Ack, GenerateMapInput, SavedBot } from './types';

const GUEST_SLOTS = 6;
const GUEST_BOTS: SavedBot[] = Array.from({ length: 5 }, () => ({
  difficulty: 'easy',
  personality: 'random',
}));

let regeneratingMap = false;

export function isRegeneratingMap(): boolean {
  return regeneratingMap;
}

function setRegeneratingMap(value: boolean): void {
  regeneratingMap = value;
  publish('map:regenerating', value);
}

function apply(res: Ack): void {
  if (res.ok) publish('game:state', res.game);
}

function generateMap(input: GenerateMapInput): void {
  setRegeneratingMap(true);
  connector.generateMap(input, (res) => {
    setRegeneratingMap(false);
    apply(res);
  });
}

function applySavedMap(
  mapGeneration: GenerateMapInput | undefined,
  playerMapId: string | null | undefined,
): void {
  if (mapGeneration) {
    generateMap(mapGeneration);
  } else if (playerMapId) {
    connector.selectPlayerMap({ mapId: playerMapId }, (res) => {
      if (res.ok) apply(res);
      else generateMap(randomMapInput());
    });
  } else {
    generateMap(randomMapInput());
  }
}

function seatBots(slots: number, bots: SavedBot[]): void {
  resetRestoredBotInputs();
  connector.updateSettings({ slots }, apply);
  bots.forEach((bot, index) => {
    connector.addBot(
      { difficulty: bot.difficulty, personality: bot.personality },
      (res: Ack) => {
        apply(res);
        if (!res.ok) return;
        const seated = res.game.players.filter((p) => p.isBot);
        if (seated[index]) recordRestoredBotInput(seated[index].id, bot);
      },
    );
  });
}

export function applySavedGameSettings(): void {
  const {
    mapGeneration,
    playerMapId,
    mapName,
    minAccountAge,
    minGames,
    minRank,
    ...rules
  } = getGameSettings();
  void mapName;
  if (!isLoggedIn()) {
    applySavedMap(mapGeneration, playerMapId);
    seatBots(GUEST_SLOTS, GUEST_BOTS);
    return;
  }
  if (Object.keys(rules).length > 0) connector.updateSettings(rules, apply);
  connector.updateSettings({ minAccountAge, minGames, minRank }, apply);
  applySavedMap(mapGeneration, playerMapId);
  seatBots(getGameSlots(), getGameBots());
  if (connector.isOffline())
    for (const name of getGameLocalPlayers()) connector.addLocalPlayer(name);
}
