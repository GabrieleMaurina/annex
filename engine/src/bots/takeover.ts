import { Game, Player } from '../types';
import { resolveDifficulty, resolvePersonality } from './randomProfile';

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
