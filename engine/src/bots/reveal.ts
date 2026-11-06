import { playersById } from '../session/players';
import { BotProfile, Game, Player } from '../types';
import { resolveBotProfile } from './randomProfile';

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function botDisplayName(profile: BotProfile): string {
  const personality = profile.personalityHidden
    ? 'random'
    : profile.personality;
  const difficulty = profile.difficultyHidden ? 'random' : profile.difficulty;
  return `${capitalize(personality)} (${capitalize(difficulty)})`;
}

export function revealBotProfiles(game: Game): void {
  for (const id of game.playerIds) {
    const player = playersById.get(id);
    const profile = player?.botProfile;
    if (!player || !profile) continue;
    const wasNamedAfterProfile = player.name === botDisplayName(profile);
    profile.personalityHidden = false;
    profile.difficultyHidden = false;
    if (wasNamedAfterProfile) player.name = botDisplayName(profile);
  }
}

export function rerollBotProfile(bot: Player): void {
  const { difficulty, personality, rolledDifficulty, rolledPersonality } =
    bot.botProfile!;
  bot.botProfile = resolveBotProfile(
    rolledDifficulty ? 'random' : difficulty,
    rolledPersonality ? 'random' : personality,
  );
  bot.name = botDisplayName(bot.botProfile);
}
