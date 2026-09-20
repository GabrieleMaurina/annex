import { Game, Player } from '../types';
import { resolveBotProfile } from './randomProfile';

export function startTakeover(game: Game, player: Player): void {
  if (player.isBot) return;
  player.isBot = true;
  player.botProfile = resolveBotProfile(
    game.disconnectBotDifficulty,
    game.disconnectBotPersonality,
  );
}

export function endTakeover(player: Player): void {
  if (!player.isBot) return;
  player.isBot = false;
  player.botProfile = undefined;
}
