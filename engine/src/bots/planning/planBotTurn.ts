import { supplyHubTerritoryIds } from '../../game/mechanics';
import { connectedOwnedTerritories } from '../../game/world/connectivity';
import { BotProfile, Game, GameMap } from '../../types';
import { attackWinProbability, defenceDiceFor } from '../features/combat';
import { chooseAttack, chooseAttackMoveTroops } from '../heuristics/attack';
import { chooseCardSet } from '../heuristics/cards';
import { chooseDeploy } from '../heuristics/deploy';
import { chooseFortify } from '../heuristics/fortify';
import {
  chooseCapital,
  chooseEntrench,
  chooseTerritoryClaim,
  chooseTroopPlacement,
} from '../heuristics/misc';
import {
  chooseAntiNukeDeploy,
  chooseNukeConstruction,
  chooseNukeLaunch,
} from '../heuristics/nukes';
import { PlanContext, buildContext } from './context';
import { buildTurnPlan, repairPlan } from './enumerate';
import {
  AttackStep,
  FortifyMove,
  TurnPlan,
  emptyPlan,
  isPlanFresh,
} from './turnPlan';

export interface BotAction {
  event: string;
  payload: unknown;
}

export type TurnPlanCache = TurnPlan;

export interface PlanBotTurnResult {
  actions: BotAction[];
  plan: TurnPlan;
}

export interface PlanBotTurnInput {
  game: Game;
  map: GameMap;
  botId: number;
  botProfile: BotProfile;
  cachedPlan: TurnPlanCache | null;
}

const NEXT_PHASE: BotAction = { event: 'game:nextPhase', payload: undefined };

function result(actions: BotAction[], plan: TurnPlan): PlanBotTurnResult {
  return { actions, plan };
}

function resolvePlan(
  ctx: PlanContext,
  game: Game,
  botId: number,
  cached: TurnPlanCache | null,
): TurnPlan {
  if (isPlanFresh(cached, game, botId)) return cached;
  return buildTurnPlan(
    ctx,
    game.turnPhase === 'deploy' ? game.troopsToDeploy : 0,
  );
}

export function planBotTurn(
  game: Game,
  botId: number,
  botProfile: BotProfile,
  cachedPlan: TurnPlanCache | null,
): PlanBotTurnResult {
  const phase = game.turnPhase;
  const stale = emptyPlan(-1, botId);

  if (phase === 'territory') {
    const territoryId = chooseTerritoryClaim(game);
    return result(
      territoryId !== null
        ? [{ event: 'game:claimTerritory', payload: { territoryId } }]
        : [],
      stale,
    );
  }
  if (phase === 'troop') {
    const territoryId = chooseTroopPlacement(game, botId);
    const pool = game.placementTroopPools.get(botId) ?? 0;
    const troops = Math.min(3, game.troopsToDeploy, pool);
    return result(
      territoryId !== null && troops >= 1
        ? [{ event: 'game:placeTroop', payload: { territoryId, troops } }]
        : [],
      stale,
    );
  }
  if (phase === 'capital') {
    const territoryId = chooseCapital(game, botId);
    return result(
      territoryId !== null
        ? [{ event: 'game:selectCapital', payload: { territoryId } }]
        : [],
      stale,
    );
  }
  if (phase === 'toxins') return result([NEXT_PHASE], stale);

  const ctx = buildContext(game, botId, botProfile);
  const plan = resolvePlan(ctx, game, botId, cachedPlan);

  if (phase === 'deploy') return planDeploy(ctx, game, plan);
  if (phase === 'attack') return planAttack(ctx, game, plan);
  if (phase === 'fortify') return planFortify(ctx, game, plan);
  if (phase === 'entrench') return planEntrench(ctx, game, plan);
  return result([], plan);
}

function planDeploy(
  ctx: PlanContext,
  game: Game,
  plan: TurnPlan,
): PlanBotTurnResult {
  if (plan.cardSet && !plan.cardSetPlayed) {
    plan.cardSetPlayed = true;
    return result(
      [{ event: 'game:playCardSet', payload: { cards: plan.cardSet } }],
      plan,
    );
  }

  const construction = chooseNukeConstruction(ctx);
  if (construction) return result([construction], plan);

  if (game.troopsToDeploy > 0) {
    const deployment = nextDeployment(ctx, game, plan);
    if (deployment)
      return result([{ event: 'game:deploy', payload: deployment }], plan);
  }

  const forcedSet = chooseCardSet(game, ctx.botId);
  if (forcedSet)
    return result(
      [{ event: 'game:playCardSet', payload: { cards: forcedSet } }],
      plan,
    );
  return result([NEXT_PHASE], plan);
}

function canDeployTo(
  ctx: PlanContext,
  game: Game,
  territoryId: number,
): boolean {
  if (game.territoryOwners.get(territoryId) !== ctx.botId) return false;
  if (game.supplyLines !== 'on') return true;
  return connectedOwnedTerritories(
    game,
    ctx.botId,
    supplyHubTerritoryIds(game, ctx.botId),
  ).has(territoryId);
}

function nextDeployment(
  ctx: PlanContext,
  game: Game,
  plan: TurnPlan,
): { territoryId: number; troops: number } | null {
  while (plan.deployCursor < plan.deployments.length) {
    const entry = plan.deployments[plan.deployCursor];
    plan.deployCursor++;
    if (!canDeployTo(ctx, game, entry.territoryId)) continue;
    const troops = Math.min(entry.troops, game.troopsToDeploy);
    if (troops >= 1) return { territoryId: entry.territoryId, troops };
  }
  const fallback = chooseDeploy(game, ctx.view, ctx.botId, ctx.weights);
  if (fallback && canDeployTo(ctx, game, fallback.territoryId)) return fallback;
  const connected = [...game.territoryOwners.keys()]
    .filter((id) => canDeployTo(ctx, game, id))
    .sort(
      (a, b) =>
        (game.territoryTroops.get(b) ?? 0) - (game.territoryTroops.get(a) ?? 0),
    )[0];
  if (connected === undefined) return null;
  return { territoryId: connected, troops: game.troopsToDeploy };
}

function planAttack(
  ctx: PlanContext,
  game: Game,
  plan: TurnPlan,
): PlanBotTurnResult {
  if (game.attackConquestMinTroops !== null) {
    const scripted = plan.step < plan.attackSteps.length;
    const troops = chooseAttackMoveTroops(game, ctx.view, ctx.botId, scripted);
    return result([{ event: 'game:attackMove', payload: { troops } }], plan);
  }

  if (!plan.antiNukeDeployed) {
    plan.antiNukeDeployed = true;
    const antiNuke = chooseAntiNukeDeploy(ctx);
    if (antiNuke)
      return result(
        [{ event: 'game:deployAntiNuke', payload: antiNuke }],
        plan,
      );
  }
  if (!plan.nukeLaunched) {
    plan.nukeLaunched = true;
    const launch = chooseNukeLaunch(ctx);
    if (launch)
      return result([{ event: 'game:launchNuke', payload: launch }], plan);
  }

  let repaired = false;
  while (plan.step < plan.attackSteps.length) {
    const step = plan.attackSteps[plan.step];
    const status = stepStatus(ctx, game, step);
    if (status === 'done') {
      plan.step++;
      continue;
    }
    if (status === 'ok') {
      const attackers = (game.territoryTroops.get(step.startId) ?? 0) - 1;
      plan.step++;
      plan.attacksIssued++;
      return result(
        [
          {
            event: 'game:attackSelectStart',
            payload: { territoryId: step.startId },
          },
          {
            event: 'game:attackSelectEnd',
            payload: { territoryId: step.endId },
          },
          {
            event: 'game:attack',
            payload: { type: 'blitz', troops: attackers },
          },
        ],
        plan,
      );
    }
    if (!repaired && repairPlan(ctx, plan)) {
      repaired = true;
      continue;
    }
    break;
  }

  plan.step = plan.attackSteps.length;
  const fallbackBudget = Math.ceil(ctx.params.maxPlanDepth / 3);
  if (plan.attacksIssued >= plan.attackSteps.length + fallbackBudget)
    return result([NEXT_PHASE], plan);
  const choice = chooseAttack(
    game,
    ctx.view,
    ctx.botId,
    ctx.weights,
    ctx.params.noise,
  );
  if (!choice) return result([NEXT_PHASE], plan);
  plan.attacksIssued++;
  return result(
    [
      {
        event: 'game:attackSelectStart',
        payload: { territoryId: choice.startId },
      },
      { event: 'game:attackSelectEnd', payload: { territoryId: choice.endId } },
      {
        event: 'game:attack',
        payload: { type: choice.type, troops: choice.troops },
      },
    ],
    plan,
  );
}

function stepStatus(
  ctx: PlanContext,
  game: Game,
  step: AttackStep,
): 'ok' | 'done' | 'invalid' {
  if (game.territoryOwners.get(step.endId) === ctx.botId) return 'done';
  if (game.territoryOwners.get(step.startId) !== ctx.botId) return 'invalid';
  const startTroops = game.territoryTroops.get(step.startId) ?? 0;
  if (startTroops < 2) return 'invalid';
  if (!(ctx.neighbors.get(step.startId) ?? []).includes(step.endId))
    return 'invalid';
  const endTroops = game.territoryTroops.get(step.endId) ?? 0;
  const winProb = attackWinProbability(
    game,
    startTroops - 1,
    endTroops,
    defenceDiceFor(game, step.endId),
  );
  return winProb >= step.minWinProb ? 'ok' : 'invalid';
}

function planFortify(
  ctx: PlanContext,
  game: Game,
  plan: TurnPlan,
): PlanBotTurnResult {
  if (plan.fortify && fortifyValid(ctx, game, plan.fortify)) {
    const move = plan.fortify;
    const troops = Math.min(
      move.troops,
      (game.territoryTroops.get(move.startId) ?? 0) - 1,
    );
    if (troops >= 1)
      return result(
        [
          {
            event: 'game:fortifySelectStart',
            payload: { territoryId: move.startId },
          },
          {
            event: 'game:fortifySelectEnd',
            payload: { territoryId: move.endId },
          },
          { event: 'game:fortify', payload: { troops } },
        ],
        plan,
      );
  }

  const choice = chooseFortify(game, ctx.view, ctx.botId, ctx.weights);
  if (!choice) return result([NEXT_PHASE], plan);
  return result(
    [
      {
        event: 'game:fortifySelectStart',
        payload: { territoryId: choice.startId },
      },
      {
        event: 'game:fortifySelectEnd',
        payload: { territoryId: choice.endId },
      },
      { event: 'game:fortify', payload: { troops: choice.troops } },
    ],
    plan,
  );
}

function fortifyValid(
  ctx: PlanContext,
  game: Game,
  move: FortifyMove,
): boolean {
  if (game.territoryOwners.get(move.startId) !== ctx.botId) return false;
  if (game.territoryOwners.get(move.endId) !== ctx.botId) return false;
  if ((game.territoryTroops.get(move.startId) ?? 0) < 2) return false;
  if (game.fortification === 'Unrestricted') return true;
  if (game.fortification === 'Neighboring')
    return (ctx.neighbors.get(move.startId) ?? []).includes(move.endId);
  return connectedOwnedTerritories(game, ctx.botId, [move.startId]).has(
    move.endId,
  );
}

function planEntrench(
  ctx: PlanContext,
  game: Game,
  plan: TurnPlan,
): PlanBotTurnResult {
  const choice = chooseEntrench(game, ctx.view, ctx.botId, ctx.weights);
  if (choice)
    return result([{ event: 'game:entrench', payload: choice }], plan);
  return result([NEXT_PHASE], plan);
}
