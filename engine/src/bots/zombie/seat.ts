import { nextFreeColor } from '../../game/mechanics';
import { createBotPlayer, playersById } from '../../session/players';
import { BotDifficulty, Game, Player } from '../../types';

const ZOMBIE_COLOR = 2;
const ZOMBIE_NAME = 'Zombies';
const ZOMBIE_DIFFICULTIES: BotDifficulty[] = ['easy', 'medium', 'hard'];
const DEFAULT_ZOMBIE_DIFFICULTY: BotDifficulty = 'hard';

export function isZombieDifficulty(value: unknown): value is BotDifficulty {
  return (ZOMBIE_DIFFICULTIES as unknown[]).includes(value);
}

export function addZombieSeat(game: Game): void {
  const zombie = createBotPlayer(ZOMBIE_NAME, {
    difficulty: DEFAULT_ZOMBIE_DIFFICULTY,
    personality: 'balanced',
  });
  zombie.gameName = game.name;
  game.zombieId = zombie.id;
  game.zombieAddedSlot = game.playerIds.length >= game.slots;
  if (game.zombieAddedSlot) {
    game.slots++;
    game.teamSlots = [game.slots];
  }
  game.playerIds.unshift(zombie.id);
  game.playerTeams.set(zombie.id, 0);
  const used = new Set(game.playerColors.values());
  for (const [id, color] of game.playerColors) {
    if (color === ZOMBIE_COLOR)
      game.playerColors.set(
        id,
        nextFreeColor(color, used, game.playerIds.length),
      );
  }
  game.playerColors.set(zombie.id, ZOMBIE_COLOR);
}

export function removeZombieSeat(game: Game): void {
  const id = game.zombieId;
  if (id === null) return;
  game.playerIds = game.playerIds.filter((playerId) => playerId !== id);
  game.playerTeams.delete(id);
  game.playerColors.delete(id);
  game.playerOdds.delete(id);
  playersById.delete(id);
  game.zombieId = null;
  if (game.zombieAddedSlot) {
    game.slots--;
    game.teamSlots = [game.slots];
    game.zombieAddedSlot = false;
  }
}

export function setZombieDifficulty(
  zombie: Player,
  difficulty: BotDifficulty,
): void {
  zombie.botProfile = { difficulty, personality: 'balanced' };
}

export function zombieLast(game: Game, playerIds: number[]): number[] {
  return [
    ...playerIds.filter((id) => id !== game.zombieId),
    ...playerIds.filter((id) => id === game.zombieId),
  ];
}
