import { startCapitalPlacement } from '../game/turns';
import { addSeaShips } from '../game/world/seaShips';
import { hasMap } from '../maps/maps';
import { GameResponse } from '../session/context';
import { playersById } from '../session/players';
import { games, respondGameState, sendPlayerCards } from '../session/store';
import { Card } from '../types';
import { prepareGameStart } from './start';

const SEAT_COLORS = [2, 0, 1];

export interface TutorialScenario {
  territories: {
    id: number;
    seat: number;
    troops: number;
    capital?: boolean;
  }[];
  phase: 'deploy' | 'attack' | 'fortify' | 'capital';
  troopsToDeploy: number;
  cards: Card[][];
  ships?: { sea: number; seat: number; ships: number }[];
}

export function startTutorial(
  playerId: number,
  scenario: TutorialScenario,
): GameResponse {
  const player = playersById.get(playerId);
  if (!player || !player.gameName) return { ok: false, error: 'not in a game' };

  const game = games.get(player.gameName);
  if (!game) return { ok: false, error: 'game not found' };
  if (!game.offline || game.hostId !== player.id)
    return { ok: false, error: 'not the host' };
  if (game.state !== 'lobby') return { ok: false, error: 'already started' };
  if (!hasMap(game)) return { ok: false, error: 'no map selected' };

  const seats = [...game.playerIds];
  game.tutorial = true;
  prepareGameStart(game);
  game.playerIds = seats;
  seats.forEach((id, seat) => game.playerColors.set(id, SEAT_COLORS[seat]));
  game.territoryOwners = new Map(
    scenario.territories.map((t) => [t.id, seats[t.seat]]),
  );
  game.territoryTroops = new Map(
    scenario.territories.map((t) => [t.id, t.troops]),
  );
  game.capitalTerritoryIds = new Set(
    scenario.territories.filter((t) => t.capital).map((t) => t.id),
  );
  scenario.cards.forEach((hand, seat) => {
    game.playerCards.set(seats[seat], [...hand]);
    sendPlayerCards(game, seats[seat]);
  });
  for (const fleet of scenario.ships ?? [])
    addSeaShips(game, fleet.sea, seats[fleet.seat], fleet.ships);
  game.turnPlayerIndex = 0;
  if (scenario.phase === 'capital') {
    startCapitalPlacement(game);
  } else {
    game.turnPhase = scenario.phase;
    game.troopsToDeploy = scenario.troopsToDeploy;
    game.turnStartedAt = Date.now();
  }
  return respondGameState(game, player.id);
}
