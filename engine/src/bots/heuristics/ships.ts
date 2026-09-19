import { connectedSeaTerritories } from '../../game/world/connectivity';
import { SHIP_COST } from '../../territory/sea/buyShips';
import { Game } from '../../types';
import { attackWinProbability, defenceDiceFor } from '../features/combat';
import { isTeammate } from '../features/mode';
import {
  landingViable,
  navalOpportunities,
  scoutSite,
  seaThreats,
  supplyBridgeSite,
  supplyCarryingSeaIds,
} from '../features/navy';
import { frustrationLevel, minWinProbability } from '../features/pressure';
import { BotView } from '../view';

export interface ShipPurchase {
  sourceTerritoryId: number;
  seaTerritoryId: number;
  ships: number;
  fromPool: boolean;
}

export function chooseSupplyBridge(
  game: Game,
  botId: number,
  troopsToDeploy: number,
): ShipPurchase | null {
  if (troopsToDeploy < SHIP_COST + 1) return null;
  const site = supplyBridgeSite(game, botId);
  return site ? { ...site, ships: 1, fromPool: true } : null;
}

export function chooseShipPurchase(
  game: Game,
  view: BotView,
  botId: number,
  troopsToDeploy: number,
): ShipPurchase | null {
  const worstThreat = seaThreats(game, view, botId).sort(
    (a, b) => b.enemyShips - b.ownShips - (a.enemyShips - a.ownShips),
  )[0];
  if (worstThreat && troopsToDeploy >= SHIP_COST + 1) {
    const needed = worstThreat.enemyShips - worstThreat.ownShips + 1;
    const affordable = Math.min(needed, Math.floor(troopsToDeploy / SHIP_COST));
    if (affordable >= 1)
      return {
        sourceTerritoryId: worstThreat.sourceTerritoryId,
        seaTerritoryId: worstThreat.seaTerritoryId,
        ships: affordable,
        fromPool: true,
      };
  }

  const frustrated = Math.random() < frustrationLevel(game);
  const best = navalOpportunities(game, view, botId)
    .map((o) => ({
      ...o,
      fromPool: (o.shipsNeeded + 1) * SHIP_COST <= troopsToDeploy,
    }))
    .filter((o) => {
      const sourceTroops = game.territoryTroops.get(o.sourceTerritoryId) ?? 0;
      const attackers =
        (o.fromPool ? sourceTroops : sourceTroops - o.shipsNeeded * SHIP_COST) -
        1;
      return (
        attackers >= 1 &&
        (frustrated ||
          attackWinProbability(
            game,
            attackers,
            o.targetTroops,
            defenceDiceFor(game, o.targetId),
          ) >= minWinProbability(game))
      );
    })
    .sort((a, b) => a.shipsNeeded - b.shipsNeeded)[0];
  if (!best) {
    const scout = scoutSite(game, view, botId);
    if (!scout || troopsToDeploy < SHIP_COST) return null;
    return { ...scout, ships: 1, fromPool: true };
  }
  return {
    sourceTerritoryId: best.sourceTerritoryId,
    seaTerritoryId: best.seaTerritoryId,
    ships: best.shipsNeeded,
    fromPool: best.fromPool,
  };
}

export interface SailChoice {
  fromSeaTerritoryId: number;
  toSeaTerritoryId: number;
  ships: number;
}

export function chooseSail(
  game: Game,
  view: BotView,
  botId: number,
): SailChoice | null {
  const stacks: { seaTerritoryId: number; ships: number }[] = [];
  const carryingSupply = supplyCarryingSeaIds(game, botId);
  for (const [seaTerritoryId, shipsByPlayer] of game.seaShips) {
    const ships = shipsByPlayer.get(botId) ?? 0;
    if (ships > 0 && !carryingSupply.has(seaTerritoryId))
      stacks.push({ seaTerritoryId, ships });
  }
  if (stacks.length === 0) return null;

  const threats = seaThreats(game, view, botId).sort(
    (a, b) => b.enemyShips - b.ownShips - (a.enemyShips - a.ownShips),
  );
  for (const threat of threats) {
    const reachable = connectedSeaTerritories(game, [threat.seaTerritoryId]);
    const reinforcement = stacks
      .filter(
        (s) =>
          s.seaTerritoryId !== threat.seaTerritoryId &&
          reachable.has(s.seaTerritoryId),
      )
      .sort((a, b) => b.ships - a.ships)[0];
    if (reinforcement)
      return {
        fromSeaTerritoryId: reinforcement.seaTerritoryId,
        toSeaTerritoryId: threat.seaTerritoryId,
        ships: reinforcement.ships,
      };
  }

  const opportunities = navalOpportunities(game, view, botId).sort(
    (a, b) => a.shipsNeeded - b.shipsNeeded,
  );
  for (const opportunity of opportunities) {
    const reachable = connectedSeaTerritories(game, [
      opportunity.seaTerritoryId,
    ]);
    const reinforcement = stacks
      .filter(
        (s) =>
          s.seaTerritoryId !== opportunity.seaTerritoryId &&
          reachable.has(s.seaTerritoryId) &&
          s.ships >= opportunity.shipsNeeded,
      )
      .sort((a, b) => a.ships - b.ships)[0];
    if (reinforcement)
      return {
        fromSeaTerritoryId: reinforcement.seaTerritoryId,
        toSeaTerritoryId: opportunity.seaTerritoryId,
        ships: reinforcement.ships,
      };
  }

  return null;
}

export interface ShipAttack {
  seaTerritoryId: number;
  defenderId: number;
  ships: number;
  type: 'regular' | 'blitz';
}

export function chooseShipAttack(game: Game, botId: number): ShipAttack | null {
  let best: ShipAttack | null = null;
  let bestMargin = -Infinity;
  for (const [seaTerritoryId, shipsByPlayer] of game.seaShips) {
    const ownShips = shipsByPlayer.get(botId) ?? 0;
    if (ownShips < 1) continue;
    for (const [otherId, ships] of shipsByPlayer) {
      if (otherId === botId || isTeammate(game, botId, otherId)) continue;
      if (ships <= 0 || ownShips <= ships) continue;
      if (!landingViable(game, botId, otherId, seaTerritoryId)) continue;
      const margin = ownShips - ships;
      if (margin > bestMargin) {
        bestMargin = margin;
        best = {
          seaTerritoryId,
          defenderId: otherId,
          ships: ownShips,
          type: 'blitz',
        };
      }
    }
  }
  return best;
}
