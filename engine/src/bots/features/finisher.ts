import { Game } from '../../types';
import { PASSIVE_RELEASE_PRESSURE, stalematePressure } from './pressure';

const MAX_FINISHER_RIVALS = 2;
const SURGE_RATIO = 2;
const SURGE_START_ROUND = 50;

function rivalUnitCount(game: Game, rivals: number[]): number {
  if (game.gameMode !== 'Team Deathmatch') return rivals.length;
  return new Set(rivals.map((id) => game.playerTeams.get(id) ?? id)).size;
}

export function finisherMode(
  game: Game,
  botId: number,
  friendlyIds: Set<number>,
): boolean {
  const dead = new Set(game.deathOrder);
  const rivals = game.playerIds.filter(
    (id) => id !== botId && !dead.has(id) && !friendlyIds.has(id),
  );
  if (rivals.length === 0 || rivalUnitCount(game, rivals) > MAX_FINISHER_RIVALS)
    return false;
  if (stalematePressure(game) >= PASSIVE_RELEASE_PRESSURE) return true;
  if (game.roundNumber < SURGE_START_ROUND) return false;

  let own = game.turnPhase === 'deploy' ? game.troopsToDeploy : 0;
  let enemy = 0;
  for (const [id, ownerId] of game.territoryOwners) {
    const troops = game.territoryTroops.get(id) ?? 0;
    if (ownerId === botId) own += troops;
    else if (!friendlyIds.has(ownerId)) enemy += troops;
  }
  return enemy > 0 && own >= SURGE_RATIO * enemy;
}
