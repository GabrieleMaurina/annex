import { Game, Player } from '../types';
import { resolveDifficulty, resolvePersonality } from './randomProfile';

// Only ever called for a real human's Player object going offline mid-game
// (lobby-added bots have no reconnect path at all). Marks the seat as
// bot-controlled until the human reconnects.
export function startTakeover(game: Game, player: Player): void {
  if (player.isBot) return;
  player.isBot = true;
  player.botProfile = {
    difficulty: resolveDifficulty(game.disconnectBotDifficulty),
    personality: resolvePersonality(game.disconnectBotPersonality),
  };
}

export function endTakeover(player: Player): void {
  if (!player.isBot) return;
  player.isBot = false;
  player.botProfile = undefined;
}
