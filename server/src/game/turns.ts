import { Game, TurnPhase } from '../types';
import { calculateDeployTroops } from './mechanics';

const PHASE_ORDER: TurnPhase[] = ['deploy', 'attack', 'fortify'];

const turnTimers = new Map<string, NodeJS.Timeout>();

export function clearTurnTimer(gameName: string) {
  const timer = turnTimers.get(gameName);
  if (timer) clearTimeout(timer);
  turnTimers.delete(gameName);
}

function scheduleTurnTimer(game: Game) {
  clearTurnTimer(game.name);
  game.turnStartedAt = Date.now();
  const timer = setTimeout(
    () => advanceToNextPlayer(game),
    game.turnDuration * 1000,
  );
  turnTimers.set(game.name, timer);
}

export function advanceToNextPlayer(game: Game) {
  const nextIndex = (game.turnPlayerIndex + 1) % game.playerIds.length;
  if (nextIndex === 0) game.turnNumber++;
  game.turnPlayerIndex = nextIndex;
  game.turnPhase = 'deploy';
  game.selectedTerritoryId = null;
  game.fortifyStartTerritoryId = null;
  game.fortifyEndTerritoryId = null;
  game.troopsToDeploy = calculateDeployTroops(game, game.playerIds[nextIndex]);
  scheduleTurnTimer(game);
}

export function advanceTurnPhase(game: Game) {
  const index = PHASE_ORDER.indexOf(game.turnPhase);
  if (index < PHASE_ORDER.length - 1) {
    game.turnPhase = PHASE_ORDER[index + 1];
    game.selectedTerritoryId = null;
    game.fortifyStartTerritoryId = null;
    game.fortifyEndTerritoryId = null;
  } else {
    advanceToNextPlayer(game);
  }
}

export function startTurns(game: Game) {
  game.turnNumber = 0;
  game.turnPlayerIndex = 0;
  game.turnPhase = 'deploy';
  game.selectedTerritoryId = null;
  game.fortifyStartTerritoryId = null;
  game.fortifyEndTerritoryId = null;
  game.troopsToDeploy = calculateDeployTroops(game, game.playerIds[0]);
  scheduleTurnTimer(game);
}
