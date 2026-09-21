import {
  MAX_TERRITORY_TROOPS,
  supplyHubTerritoryIds,
} from '../../game/mechanics';
import { isFreeConquestTarget } from '../../game/toxins/toxins';
import { connectedFortifyTerritories } from '../../game/world/connectivity';
import { BotProfile, Game, GameMap } from '../../types';
import { attackWinProbability, defenceDiceFor } from '../features/combat';
import { modeGoalFor } from '../features/modeGoals';
import {
  PASSIVE_RELEASE_PRESSURE,
  frustrationLevel,
  stalematePressure,
  stalemateRamp,
} from '../features/pressure';
import {
  conquestEndShare,
  openStackWeight,
  openedEnemyStackPower,
  ownStackClosure,
} from '../goals/stackOpenness';
import {
  AttackChoice,
  attackOrder,
  chooseAttack,
  chooseAttackMoveTroops,
} from '../heuristics/attack';
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
import { chooseLosingAttack } from '../heuristics/sacrifice';
import {
  ShipPurchase,
  chooseSail,
  chooseShipAttack,
  chooseShipPurchase,
  chooseSupplyBridge,
} from '../heuristics/ships';
import {
  PlanContext,
  SimState,
  buildContext,
  planDepth,
  snapshotState,
} from './context';
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
const OVERWHELMING_RATIO = 10;
const FINISHER_OVERWHELMING_RATIO = 2;
const OPENED_STACK_PENALTY = 0.3;
const OWN_STACK_CLOSURE_PENALTY = 0.3;
const HOLD_GARRISON_SHARE = 0.6;
const MAX_FALLBACK_ATTACKS_PER_TURN = 16;
const MAX_OVERWHELMING_ATTACKS_PER_TURN = 40;

function result(actions: BotAction[], plan: TurnPlan): PlanBotTurnResult {
  return { actions, plan };
}

function buyShipsAction(purchase: ShipPurchase): BotAction {
  return {
    event: 'game:buyShips',
    payload: {
      sourceTerritoryId: purchase.sourceTerritoryId,
      seaTerritoryId: purchase.seaTerritoryId,
      ships: purchase.ships,
      fromPool: purchase.fromPool,
    },
  };
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

  if (phase === 'deploy' && !isPlanFresh(cachedPlan, game, botId)) {
    const bridge = chooseSupplyBridge(game, botId, game.troopsToDeploy);
    if (bridge) return result([buyShipsAction(bridge)], stale);
  }

  const ctx = buildContext(game, botId, botProfile, cachedPlan);
  const plan = resolvePlan(ctx, game, botId, cachedPlan);

  if (phase === 'deploy') return planDeploy(ctx, game, plan);
  if (phase === 'sail') return planSail(ctx, game, plan);
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

  const shipPurchase = chooseShipPurchase(
    game,
    ctx.view,
    ctx.botId,
    game.troopsToDeploy,
  );
  if (shipPurchase) return result([buyShipsAction(shipPurchase)], plan);

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

function troopRoom(game: Game, territoryId: number): number {
  return MAX_TERRITORY_TROOPS - (game.territoryTroops.get(territoryId) ?? 0);
}

function canDeployTo(
  ctx: PlanContext,
  game: Game,
  territoryId: number,
): boolean {
  if (game.territoryOwners.get(territoryId) !== ctx.botId) return false;
  if (troopRoom(game, territoryId) < 1) return false;
  if (game.supplyLines !== 'on') return true;
  return connectedFortifyTerritories(
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
    const troops = Math.min(
      entry.troops,
      game.troopsToDeploy,
      troopRoom(game, entry.territoryId),
    );
    if (troops >= 1) return { territoryId: entry.territoryId, troops };
  }
  const fallback = chooseDeploy(game, ctx.view, ctx.botId, ctx.weights);
  if (fallback && canDeployTo(ctx, game, fallback.territoryId))
    return {
      territoryId: fallback.territoryId,
      troops: Math.min(fallback.troops, troopRoom(game, fallback.territoryId)),
    };
  const connected = [...game.territoryOwners.keys()]
    .filter((id) => canDeployTo(ctx, game, id))
    .sort(
      (a, b) =>
        (game.territoryTroops.get(b) ?? 0) - (game.territoryTroops.get(a) ?? 0),
    )[0];
  if (connected === undefined) return null;
  return {
    territoryId: connected,
    troops: Math.min(game.troopsToDeploy, troopRoom(game, connected)),
  };
}

function planAttack(
  ctx: PlanContext,
  game: Game,
  plan: TurnPlan,
): PlanBotTurnResult {
  if (game.attackConquestMinTroops !== null) {
    const chained = continuesFromConquest(ctx, game, plan);
    const endShare = chained ? 1 : conquestShare(ctx, game);
    const troops = chooseAttackMoveTroops(game, chained, endShare);
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

  const candidateShipAttack = chooseShipAttack(game, ctx.botId);
  const continuingShipAttack =
    candidateShipAttack !== null &&
    game.blitz === 'Off' &&
    game.attackSeaTerritoryId === candidateShipAttack.seaTerritoryId &&
    game.attackSeaDefenderId === candidateShipAttack.defenderId;
  const shipAttack =
    continuingShipAttack || plan.shipAttacksIssued < ctx.params.maxPlanDepth
      ? candidateShipAttack
      : null;
  if (shipAttack && game.attackStartTerritoryId !== null)
    return result(
      [{ event: 'game:attackSelectStart', payload: { territoryId: null } }],
      plan,
    );
  if (shipAttack) {
    if (!continuingShipAttack) plan.shipAttacksIssued++;
    return result(
      [
        {
          event: 'game:attackSeaSelectStart',
          payload: { territoryId: shipAttack.seaTerritoryId },
        },
        {
          event: 'game:attackSeaSelectDefender',
          payload: { defenderId: shipAttack.defenderId },
        },
        {
          event: 'game:attackSea',
          payload: { type: shipAttack.type, ships: shipAttack.ships },
        },
      ],
      plan,
    );
  }
  if (game.attackSeaTerritoryId !== null)
    return result(
      [{ event: 'game:attackSeaSelectStart', payload: { territoryId: null } }],
      plan,
    );

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
      if (!isContinuation(game, step.startId, step.endId)) plan.attacksIssued++;
      if (game.blitz !== 'Off') plan.step++;
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
            payload: attackOrder(game, attackers),
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
  const frustration = frustrationLevel(game);
  const fallbackBudget = Math.min(
    MAX_FALLBACK_ATTACKS_PER_TURN,
    Math.ceil(planDepth(ctx) / 3) + Math.round(frustration * planDepth(ctx)),
  );
  const capped = plan.attacksIssued >= plan.attackSteps.length + fallbackBudget;
  const desperate = Math.random() < stalemateRamp(game);
  const sacrifice = desperate ? chooseLosingAttack(ctx, frustration) : null;
  let boardNow: SimState | null = null;
  const stackRisk = (startId: number, endId: number) => {
    boardNow ??= snapshotState(ctx);
    const opened =
      ctx.weights.defense *
      OPENED_STACK_PENALTY *
      Math.min(
        1,
        openedEnemyStackPower(ctx, boardNow, endId) /
          (game.territoryTroops.get(startId) ?? 1),
      );
    const closed =
      openStackWeight(ctx) *
      OWN_STACK_CLOSURE_PENALTY *
      ownStackClosure(ctx, boardNow, startId, endId);
    return opened + closed;
  };
  const passive =
    ctx.personality === 'defensive' &&
    stalematePressure(game) < PASSIVE_RELEASE_PRESSURE;
  const attack = passive
    ? sacrifice
    : (sacrifice ??
      chooseAttack(
        game,
        ctx.view,
        ctx.botId,
        ctx.weights,
        ctx.params.noise,
        ctx.standing,
        stackRisk,
      ) ??
      chooseLosingAttack(ctx, frustration));
  if (!attack) return result([NEXT_PHASE], plan);
  const overwhelming = isOverwhelming(ctx, game, attack);
  const continuing = isContinuation(game, attack.startId, attack.endId);
  const overwhelmingCapped =
    plan.overwhelmingAttacksIssued >= MAX_OVERWHELMING_ATTACKS_PER_TURN;
  if (!continuing) {
    if (overwhelming) {
      if (overwhelmingCapped) return result([NEXT_PHASE], plan);
    } else if (capped) return result([NEXT_PHASE], plan);
  }
  if (!continuing) {
    if (overwhelming) plan.overwhelmingAttacksIssued++;
    else plan.attacksIssued++;
  }
  return result(
    [
      {
        event: 'game:attackSelectStart',
        payload: { territoryId: attack.startId },
      },
      { event: 'game:attackSelectEnd', payload: { territoryId: attack.endId } },
      {
        event: 'game:attack',
        payload: { type: attack.type, troops: attack.troops },
      },
    ],
    plan,
  );
}

function continuesFromConquest(
  ctx: PlanContext,
  game: Game,
  plan: TurnPlan,
): boolean {
  if (ctx.personality === 'defensive') return false;
  const firstUpcoming = game.blitz === 'Off' ? plan.step + 1 : plan.step;
  return plan.attackSteps
    .slice(firstUpcoming)
    .some((step) => step.startId === game.attackEndTerritoryId);
}

function conquestShare(ctx: PlanContext, game: Game): number {
  const startId = game.attackStartTerritoryId!;
  const endId = game.attackEndTerritoryId!;
  const attackers = (game.territoryTroops.get(startId) ?? 0) - 1;
  const share = conquestEndShare(
    ctx,
    snapshotState(ctx),
    startId,
    endId,
    attackers,
  );
  return modeGoalFor(ctx).holdSet.has(endId)
    ? Math.max(share, HOLD_GARRISON_SHARE)
    : share;
}

function isContinuation(game: Game, startId: number, endId: number): boolean {
  return (
    game.blitz === 'Off' &&
    game.attackStartTerritoryId === startId &&
    game.attackEndTerritoryId === endId
  );
}

function isOverwhelming(
  ctx: PlanContext,
  game: Game,
  attack: AttackChoice,
): boolean {
  const attackers = game.territoryTroops.get(attack.startId) ?? 0;
  const defenders = game.territoryTroops.get(attack.endId) ?? 0;
  const ratio = ctx.finisher ? FINISHER_OVERWHELMING_RATIO : OVERWHELMING_RATIO;
  return attackers >= defenders * ratio;
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
  if (
    !game.territoryOwners.has(step.endId) &&
    !isFreeConquestTarget(game, step.endId)
  )
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

function planSail(
  ctx: PlanContext,
  game: Game,
  plan: TurnPlan,
): PlanBotTurnResult {
  const choice = chooseSail(game, ctx.view, ctx.botId);
  if (!choice) return result([NEXT_PHASE], plan);
  return result(
    [
      {
        event: 'game:sailSelectStart',
        payload: { territoryId: choice.fromSeaTerritoryId },
      },
      {
        event: 'game:sailSelectEnd',
        payload: { territoryId: choice.toSeaTerritoryId },
      },
      { event: 'game:sail', payload: { ships: choice.ships } },
    ],
    plan,
  );
}

function cappedFortifyTroops(game: Game, move: FortifyMove): number {
  return Math.min(
    move.troops,
    (game.territoryTroops.get(move.startId) ?? 0) - 1,
    troopRoom(game, move.endId),
  );
}

function planFortify(
  ctx: PlanContext,
  game: Game,
  plan: TurnPlan,
): PlanBotTurnResult {
  if (plan.fortify && fortifyValid(ctx, game, plan.fortify)) {
    const move = plan.fortify;
    const troops = cappedFortifyTroops(game, move);
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
  const choiceTroops = cappedFortifyTroops(game, choice);
  if (choiceTroops < 1) return result([NEXT_PHASE], plan);
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
      { event: 'game:fortify', payload: { troops: choiceTroops } },
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
  return connectedFortifyTerritories(game, ctx.botId, [move.startId]).has(
    move.endId,
  );
}

function planEntrench(
  ctx: PlanContext,
  game: Game,
  plan: TurnPlan,
): PlanBotTurnResult {
  const choice =
    plan.entrenchesIssued < ctx.params.maxPlanDepth
      ? chooseEntrench(game, ctx.view, ctx.botId, ctx.weights)
      : null;
  if (choice) {
    plan.entrenchesIssued++;
    return result([{ event: 'game:entrench', payload: choice }], plan);
  }
  return result([NEXT_PHASE], plan);
}
