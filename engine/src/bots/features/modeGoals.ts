import { findKillerId } from '../../game/progression/stats';
import {
  PlanContext,
  SimState,
  isFriendly,
  isHazard,
  ownedIds,
  snapshotState,
  troopsIn,
} from '../planning/context';
import { isVisible } from '../view';

const PASSIVE_WEIGHT = 0.4;
const SURVIVOR_KILL_WEIGHT = 1.25;
const PLAYER_KILLS_WEIGHT = 1.6;
const PLAYER_KILLS_ELIMINATE_THRESHOLD = 0;
const TROOP_KILLS_DAMAGE = 0.35;
const TROOP_KILLS_LOSS_REFUND = 0.15;
const OPPONENT_MISSION_FRACTION = 3 / 4;
const OPPONENT_MISSION_WEIGHT = 0.5;
const ASSASSIN_FALLBACK_FRACTION = 3 / 4;
const NUKE_THREAT_PROGRESS = 0.75;

export interface ModeGoal {
  active: boolean;
  teams: Map<number, number> | null;
  ownSide: number;
  total: number;
  ownWeight: number;
  threatWeight: number;
  threshold: number;
  threatThreshold: number;
  minTroops: number;
  holdIds: number[];
  holdSet: Set<number>;
  roundLimit: number;
  turnsLeft: number;
  incomeFactor: number;
  expand: boolean;
  assassinId: number | null;
  assassinBase: number;
  killWeight: number;
  eliminateThreshold: number;
  damageBonus: number;
  lossRefund: number;
}

export interface Threat {
  side: number;
  progress: number;
  hold: boolean;
}

export interface SideProgress {
  own: number[];
  threats: Threat[];
}

function neutralGoal(ctx: PlanContext): ModeGoal {
  const { game, botId } = ctx;
  const teams = game.gameMode === 'Team Deathmatch' ? game.playerTeams : null;
  let total = 0;
  for (const territory of ctx.map.territories)
    if (
      !isVisible(ctx.view, territory.id) ||
      game.territoryOwners.has(territory.id)
    )
      total++;
  return {
    active: false,
    teams,
    ownSide: teams ? (teams.get(botId) ?? 0) : botId,
    total,
    ownWeight: 1,
    threatWeight: 1,
    threshold: 0,
    threatThreshold: 0,
    minTroops: 1,
    holdIds: [],
    holdSet: new Set(),
    roundLimit: 0,
    turnsLeft: 0,
    incomeFactor: 1,
    expand: false,
    assassinId: null,
    assassinBase: 0,
    killWeight: 1,
    eliminateThreshold: 0,
    damageBonus: 0,
    lossRefund: 0,
  };
}

function setRace(goal: ModeGoal, fraction: number): void {
  goal.threshold = Math.ceil(goal.total * fraction);
  goal.threatThreshold = goal.threshold;
  goal.expand = true;
  goal.killWeight = SURVIVOR_KILL_WEIGHT;
}

function setHold(goal: ModeGoal, ids: number[]): void {
  goal.holdIds = ids;
  goal.holdSet = new Set(ids);
  goal.killWeight = SURVIVOR_KILL_WEIGHT;
}

function setRounds(ctx: PlanContext, goal: ModeGoal, limit: number): void {
  goal.roundLimit = limit;
  goal.turnsLeft = Math.max(1, limit - ctx.game.roundNumber);
  goal.incomeFactor = Math.min(1, Math.max(0, (goal.turnsLeft - 1) / 2));
  goal.expand = true;
}

function setAssassin(ctx: PlanContext, goal: ModeGoal, targetId: number): void {
  const { game, botId } = ctx;
  const killerId = findKillerId(game, targetId);
  if (killerId !== undefined) {
    if (killerId !== botId) {
      goal.threshold = Math.ceil(goal.total * ASSASSIN_FALLBACK_FRACTION);
      goal.expand = true;
    }
    return;
  }
  if (game.deathOrder.includes(targetId) || ctx.friendlyIds.has(targetId))
    return;
  let visibleCount = 0;
  for (const [id, ownerId] of game.territoryOwners)
    if (ownerId === targetId && isVisible(ctx.view, id)) visibleCount++;
  if (visibleCount === 0) return;
  goal.assassinId = targetId;
  goal.assassinBase = visibleCount;
}

function setMission(ctx: PlanContext, goal: ModeGoal): void {
  const mission = ctx.game.playerMissions.get(ctx.botId);
  goal.killWeight = SURVIVOR_KILL_WEIGHT;
  if (!mission) return;
  goal.threatThreshold = Math.ceil(goal.total * OPPONENT_MISSION_FRACTION);
  goal.threatWeight = OPPONENT_MISSION_WEIGHT;
  if (mission.type === 'territories') {
    goal.threshold = Math.ceil(goal.total * mission.fraction);
    goal.minTroops = mission.minTroopsPerTerritory;
    goal.expand = true;
  } else if (mission.type === 'continents') {
    setHold(
      goal,
      mission.continentIds
        .flatMap(
          (continentId) => ctx.continentTerritories.get(continentId) ?? [],
        )
        .filter((id) => !isHazard(ctx, id)),
    );
  } else {
    setAssassin(ctx, goal, mission.targetId);
  }
}

function buildModeGoal(ctx: PlanContext): ModeGoal {
  const { game } = ctx;
  const goal = neutralGoal(ctx);
  switch (game.gameMode) {
    case 'Supremacy':
    case 'Team Deathmatch':
      goal.threshold = goal.total;
      goal.threatThreshold = goal.total;
      goal.ownWeight = PASSIVE_WEIGHT;
      goal.threatWeight = PASSIVE_WEIGHT;
      break;
    case 'Supremacy 3/4':
      setRace(goal, 3 / 4);
      break;
    case 'Supremacy 2/3':
      setRace(goal, 2 / 3);
      break;
    case 'Capitals':
      if (game.capitalTerritoryIds.size >= 2)
        setHold(goal, [...game.capitalTerritoryIds]);
      break;
    case 'Continent':
      if (game.continentId !== null)
        setHold(
          goal,
          (ctx.continentTerritories.get(game.continentId) ?? []).filter(
            (id) => !isHazard(ctx, id),
          ),
        );
      break;
    case '5-Round':
      setRounds(ctx, goal, 5);
      break;
    case '10-Round':
      setRounds(ctx, goal, 10);
      break;
    case 'Assassin':
      setMission(ctx, goal);
      if (goal.assassinId === null) goal.eliminateThreshold = 1;
      break;
    case 'Mission':
      setMission(ctx, goal);
      break;
    case 'Player Kills':
      goal.killWeight = PLAYER_KILLS_WEIGHT;
      goal.eliminateThreshold = PLAYER_KILLS_ELIMINATE_THRESHOLD;
      break;
    case 'Troop Kills':
      goal.damageBonus = TROOP_KILLS_DAMAGE;
      goal.lossRefund = TROOP_KILLS_LOSS_REFUND;
      break;
  }
  goal.active =
    goal.threshold > 0 ||
    goal.threatThreshold > 0 ||
    goal.holdIds.length > 0 ||
    goal.roundLimit > 0 ||
    goal.assassinId !== null;
  return goal;
}

const goalCache = new WeakMap<PlanContext, ModeGoal>();

export function modeGoalFor(ctx: PlanContext): ModeGoal {
  let goal = goalCache.get(ctx);
  if (!goal) {
    goal = buildModeGoal(ctx);
    goalCache.set(ctx, goal);
  }
  return goal;
}

export function sideOf(goal: ModeGoal, playerId: number): number {
  return goal.teams ? (goal.teams.get(playerId) ?? 0) : playerId;
}

export function territoryCounts(
  ctx: PlanContext,
  goal: ModeGoal,
  state: SimState,
): Map<number, number> {
  const counts = new Map<number, number>();
  for (const [id, ownerId] of state.owners) {
    if (ownerId === ctx.botId && troopsIn(state, id) < goal.minTroops) continue;
    const side = sideOf(goal, ownerId);
    counts.set(side, (counts.get(side) ?? 0) + 1);
  }
  return counts;
}

function holdCounts(goal: ModeGoal, state: SimState): Map<number, number> {
  const counts = new Map<number, number>();
  for (const id of goal.holdIds) {
    const ownerId = state.owners.get(id);
    if (ownerId === undefined) continue;
    const side = sideOf(goal, ownerId);
    counts.set(side, (counts.get(side) ?? 0) + 1);
  }
  return counts;
}

function collect(
  goal: ModeGoal,
  counts: Map<number, number>,
  ownDenominator: number,
  threatDenominator: number,
  hold: boolean,
  result: SideProgress,
): void {
  for (const [side, count] of counts) {
    if (side === goal.ownSide) {
      if (ownDenominator > 0) result.own.push(count / ownDenominator);
    } else if (threatDenominator > 0) {
      result.threats.push({ side, progress: count / threatDenominator, hold });
    }
  }
}

export function sideProgress(
  ctx: PlanContext,
  goal: ModeGoal,
  state: SimState,
): SideProgress {
  const result: SideProgress = { own: [], threats: [] };
  if (goal.threshold > 0 || goal.threatThreshold > 0)
    collect(
      goal,
      territoryCounts(ctx, goal, state),
      goal.threshold,
      goal.threatThreshold,
      false,
      result,
    );
  if (goal.holdIds.length > 0)
    collect(
      goal,
      holdCounts(goal, state),
      goal.holdIds.length,
      goal.holdIds.length,
      true,
      result,
    );
  return result;
}

export function assassinKillShot(ctx: PlanContext): number | null {
  const goal = modeGoalFor(ctx);
  if (goal.assassinId === null) return null;
  const owned = ownedIds(snapshotState(ctx), goal.assassinId);
  return owned.length === 1 ? owned[0] : null;
}

export function threatTile(ctx: PlanContext): number | null {
  const goal = modeGoalFor(ctx);
  if (!goal.active) return null;
  const state = snapshotState(ctx);
  const threat = sideProgress(ctx, goal, state)
    .threats.filter((t) => t.progress >= NUKE_THREAT_PROGRESS)
    .sort((a, b) => b.progress - a.progress)[0];
  if (!threat) return null;
  let best: number | null = null;
  let bestTroops = -1;
  for (const [id, ownerId] of state.owners) {
    if (isFriendly(ctx, ownerId) || sideOf(goal, ownerId) !== threat.side)
      continue;
    if (threat.hold && !goal.holdSet.has(id)) continue;
    const troops = troopsIn(state, id);
    if (troops > bestTroops) {
      bestTroops = troops;
      best = id;
    }
  }
  return best;
}
