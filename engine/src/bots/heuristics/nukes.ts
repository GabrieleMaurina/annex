import {
  ANTI_NUKE_INSTALLMENT,
  NUKE_INSTALLMENT,
  playerArsenal,
  playerProjects,
} from '../../game/nukes/nukes';
import { BotPersonality, Game } from '../../types';
import type { PlanContext } from '../planning/context';
import { isVisible } from '../view';

export interface NukeAction {
  event: string;
  payload: unknown;
}

const PERSONALITY_AGGRESSION: Record<BotPersonality, number> = {
  killer: 1,
  breaker: 0.9,
  vengeful: 0.75,
  erratic: 0.6,
  balanced: 0.5,
  taker: 0.35,
};

const PERSONALITY_MIN_STACK: Record<BotPersonality, number> = {
  killer: 8,
  breaker: 9,
  vengeful: 10,
  erratic: 10,
  balanced: 12,
  taker: 14,
};

function aggression(ctx: PlanContext): number {
  return (
    PERSONALITY_AGGRESSION[ctx.personality] * ctx.params.planningConfidence
  );
}

function ownerTerritoryCounts(game: Game): Map<number, number> {
  const counts = new Map<number, number>();
  for (const owner of game.territoryOwners.values())
    counts.set(owner, (counts.get(owner) ?? 0) + 1);
  return counts;
}

function isHighValuePlayer(game: Game, botId: number): boolean {
  if (game.gameMode === 'Capitals') {
    for (const id of game.capitalTerritoryIds)
      if (game.territoryOwners.get(id) === botId) return true;
  }
  const counts = ownerTerritoryCounts(game);
  const mine = counts.get(botId) ?? 0;
  let stronger = 0;
  for (const [id, count] of counts)
    if (id !== botId && count > mine) stronger++;
  return stronger <= 1;
}

export function chooseNukeConstruction(ctx: PlanContext): NukeAction | null {
  const { game, botId } = ctx;
  if (game.nukes !== 'on') return null;
  const aggr = aggression(ctx);
  if (aggr <= 0) return null;

  const troops = game.troopsToDeploy;
  const projects = playerProjects(game, botId);
  const arsenal = playerArsenal(game, botId);

  const advanceable = projects
    .map((project, index) => ({ project, index }))
    .filter(({ project }) => project.lastPaidRound < game.roundNumber)
    .sort((a, b) => b.project.installmentsPaid - a.project.installmentsPaid);
  for (const { project, index } of advanceable) {
    const cost =
      project.kind === 'nuke' ? NUKE_INSTALLMENT : ANTI_NUKE_INSTALLMENT;
    const reserve = project.installmentsPaid >= 3 ? 2 : 8;
    if (troops - cost >= reserve)
      return { event: 'game:advanceNuke', payload: { index } };
  }

  const startReserve = Math.round(18 - 10 * aggr);
  if (
    arsenal.nukes === 0 &&
    !projects.some((project) => project.kind === 'nuke') &&
    game.roundNumber >= 2 &&
    troops - NUKE_INSTALLMENT >= startReserve
  )
    return { event: 'game:buildNuke', payload: {} };

  if (
    arsenal.antiNukes === 0 &&
    !projects.some((project) => project.kind === 'antiNuke') &&
    game.roundNumber >= 3 &&
    isHighValuePlayer(game, botId) &&
    troops - ANTI_NUKE_INSTALLMENT >= startReserve
  )
    return { event: 'game:buildAntiNuke', payload: {} };

  return null;
}

export function chooseNukeLaunch(
  ctx: PlanContext,
): { territoryId: number } | null {
  const { game, view, botId } = ctx;
  if (game.nukes !== 'on' || playerArsenal(game, botId).nukes < 1) return null;

  const counts = ownerTerritoryCounts(game);
  const enemyTiles: { id: number; owner: number; troops: number }[] = [];
  for (const [id, owner] of game.territoryOwners) {
    if (owner === botId || ctx.friendlyIds.has(owner)) continue;
    if (!isVisible(view, id)) continue;
    enemyTiles.push({ id, owner, troops: game.territoryTroops.get(id) ?? 0 });
  }
  if (enemyTiles.length === 0) return null;

  const killShots = enemyTiles
    .filter((tile) => (counts.get(tile.owner) ?? 0) === 1)
    .sort((a, b) => b.troops - a.troops);
  if (killShots.length > 0) return { territoryId: killShots[0].id };

  if (game.gameMode === 'Capitals') {
    const capitals = enemyTiles
      .filter(
        (tile) => game.capitalTerritoryIds.has(tile.id) && tile.troops >= 3,
      )
      .sort((a, b) => b.troops - a.troops);
    if (capitals.length > 0) return { territoryId: capitals[0].id };
  }

  const strongest = enemyTiles.sort((a, b) => b.troops - a.troops)[0];
  if (strongest.troops >= PERSONALITY_MIN_STACK[ctx.personality])
    return { territoryId: strongest.id };

  return null;
}

export function chooseAntiNukeDeploy(
  ctx: PlanContext,
): { territoryId: number } | null {
  const { game, botId } = ctx;
  if (game.nukes !== 'on' || playerArsenal(game, botId).antiNukes < 1)
    return null;

  const owned = [...game.territoryOwners]
    .filter(
      ([id, owner]) => owner === botId && !game.antiNukeTerritoryIds.has(id),
    )
    .map(([id]) => id);
  if (owned.length === 0) return null;

  const capitals = owned.filter((id) => game.capitalTerritoryIds.has(id));
  const pool = capitals.length > 0 ? capitals : owned;
  const best = pool.sort(
    (a, b) =>
      (game.territoryTroops.get(b) ?? 0) - (game.territoryTroops.get(a) ?? 0),
  )[0];
  return { territoryId: best };
}
