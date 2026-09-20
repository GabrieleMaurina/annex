import { playersById } from '../session/players';
import { BotProfile, Game } from '../types';

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
