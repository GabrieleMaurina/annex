import { upcomingSetValues } from '../../game/progression/cards';
import { grudgeAgainst } from '../features/grudge';
import { SideProgress, modeGoalFor } from '../features/mode/modeGoals';
import { stalematePressure } from '../features/pressure';
import { antiLeaderActive } from '../features/standing';
import { modeScore } from '../goals/modeScore';
import { openStackWeight, stackScores } from '../goals/stackOpenness';
import { standingScore } from '../goals/standingScore';
import {
  PlanContext,
  SimState,
  bonusOf,
  cloneState,
  heldContinentBonus,
  isBotBorder,
  isFriendly,
  neighborsOf,
  opponentIds,
  ownedClusters,
  ownedIds,
  strongestOpponent,
  strongestThreatAt,
  troopsIn,
} from './context';

const ENEMY_SWEEP_LIMIT = 5;

function addEnemyRoundTroops(ctx: PlanContext, s: SimState): void {
  if (ctx.game.roundTroops !== 'on') return;
  const strongest = new Map<number, number>();
  for (const [id, ownerId] of s.owners) {
    if (isFriendly(ctx, ownerId)) continue;
    const best = strongest.get(ownerId);
    if (best === undefined || troopsIn(s, id) > troopsIn(s, best))
      strongest.set(ownerId, id);
  }
  for (const id of strongest.values())
    s.troops.set(id, troopsIn(s, id) + ctx.game.roundNumber + 1);
}

export function applyEnemyResponse(
  ctx: PlanContext,
  state: SimState,
): SimState {
  const s = cloneState(state);
  addEnemyRoundTroops(ctx, s);
  const enemyStacks: number[] = [];
  for (const [id, ownerId] of s.owners) {
    if (isFriendly(ctx, ownerId)) continue;
    if (troopsIn(s, id) >= 2) enemyStacks.push(id);
  }
  enemyStacks.sort((a, b) => troopsIn(s, b) - troopsIn(s, a));
  const attackRatio = BASE_ATTACK_RATIO - DUEL_ATTACK_EDGE * ctx.duel.rolling;

  for (const start of enemyStacks) {
    const ownerId = s.owners.get(start);
    if (ownerId === undefined || isFriendly(ctx, ownerId)) continue;
    let from = start;
    for (let sweep = 0; sweep < ENEMY_SWEEP_LIMIT; sweep++) {
      const attackers = troopsIn(s, from) - 1;
      if (attackers < 2) break;
      let target: number | null = null;
      let targetTroops = Infinity;
      for (const n of neighborsOf(ctx, from)) {
        if (s.owners.get(n) !== ctx.botId) continue;
        const t = troopsIn(s, n);
        if (t < targetTroops) {
          targetTroops = t;
          target = n;
        }
      }
      if (target === null || attackers <= targetTroops * attackRatio + 1) break;
      const survivors = Math.max(1, Math.round(attackers - targetTroops * 0.9));
      s.troops.set(from, 1);
      s.owners.set(target, ownerId);
      s.troops.set(target, survivors);
      from = target;
    }
  }
  return s;
}

const INCOME = 1;
const HELD_BONUS = 1.6;
const CONTINENT_PROGRESS = 0.6;
const DENIAL = 0.3;
const FRONTIER_RISK = 0.5;
const INTERIOR_WASTE = 0.12;
const EXPOSURE = 0.35;
const CONCENTRATION = 0.05;
const OPEN_STACK = 0.03;
const STACK_PRESSURE = 0.03;
const DUEL_BREAK = 4;
const DUEL_PRESSURE = 2;
const DUEL_STACK_MASS = 0.05;
const BASE_ATTACK_RATIO = 1.05;
const DUEL_ATTACK_EDGE = 0.15;
const CAPITAL_RISK = 2;
const ANTI_LEADER = 0.15;
const GRUDGE = 0.1;
const CARD = 0.5;
const TROOP_LOSS = 0.25;
const ELIMINATION = 9;
const DAMAGE = 0.15;
const CARD_VALUE_CAP = 40;
const TROOP_SCALE_BASE = 20;

function troopScale(state: SimState): number {
  let total = 0;
  for (const troops of state.troops.values()) total += troops;
  return Math.max(1, total / Math.max(1, state.troops.size) / TROOP_SCALE_BASE);
}

function eliminationBonus(ctx: PlanContext, state: SimState): number {
  const killWeight = modeGoalFor(ctx).killWeight;
  const pressure = stalematePressure(ctx.game);
  const remaining = new Map<number, number>();
  for (const ownerId of state.owners.values())
    remaining.set(ownerId, (remaining.get(ownerId) ?? 0) + 1);
  let bonus = 0;
  for (const [opponentId, before] of ctx.preTurnOpponents) {
    const left = remaining.get(opponentId);
    if (left !== undefined) {
      const cleared = Math.max(0, 1 - left / before);
      bonus += ELIMINATION * killWeight * pressure * cleared * cleared;
      continue;
    }
    bonus += ELIMINATION * killWeight;
    if (ctx.game.bounties === 'on') bonus += 8;
    bonus += (ctx.game.playerCards.get(opponentId)?.length ?? 0) * 1.5;
  }
  return bonus;
}

function incomeEstimate(
  ctx: PlanContext,
  state: SimState,
  playerId: number,
): number {
  const owned = ownedIds(state, playerId).length;
  const capitals =
    ctx.game.gameMode === 'Capitals'
      ? [...ctx.game.capitalTerritoryIds].filter(
          (id) => state.owners.get(id) === playerId,
        ).length * 2
      : 0;
  return (
    (Math.max(3, Math.floor(owned / 3)) + capitals) *
    modeGoalFor(ctx).incomeFactor
  );
}

function continentProgress(ctx: PlanContext, state: SimState): number {
  let score = 0;
  for (const [continentId, territoryIds] of ctx.continentTerritories) {
    const owned = territoryIds.filter(
      (id) => state.owners.get(id) === ctx.botId,
    ).length;
    if (owned === 0 || owned === territoryIds.length) continue;
    const ratio = owned / territoryIds.length;
    score += bonusOf(ctx, continentId) * ratio * ratio;
  }
  return score;
}

function denial(ctx: PlanContext, state: SimState): number {
  let score = 0;
  for (const [continentId, territoryIds] of ctx.continentTerritories) {
    const botOwns = territoryIds.filter(
      (id) => state.owners.get(id) === ctx.botId,
    ).length;
    if (botOwns === 0 || botOwns === territoryIds.length) continue;
    score += DENIAL * bonusOf(ctx, continentId);
  }
  return score;
}

function riskAndWaste(
  ctx: PlanContext,
  state: SimState,
): { risk: number; waste: number; concentration: number } {
  let risk = 0;
  let waste = 0;
  let concentration = 0;
  for (const id of ownedIds(state, ctx.botId)) {
    const troops = troopsIn(state, id);
    if (isBotBorder(ctx, state, id)) {
      const threat = strongestThreatAt(ctx, state, id);
      risk += Math.max(0, threat - troops);
      concentration += Math.pow(Math.max(1, troops), 1.15);
    } else if (!ctx.game.capitalTerritoryIds.has(id)) {
      waste += Math.max(0, troops - 1);
    }
  }
  return { risk, waste, concentration };
}

function exposure(ctx: PlanContext, state: SimState): number {
  const clusters = ownedClusters(ctx, state);
  if (clusters.length === 0) return 0;
  const main = clusters.reduce((a, b) => (a.length >= b.length ? a : b));
  return main.filter((id) => isBotBorder(ctx, state, id)).length;
}

function opponentHeldBonus(ctx: PlanContext, state: SimState): number {
  if (ctx.duel.breaking <= 0) return 0;
  return opponentIds(ctx, state).reduce(
    (sum, id) => sum + heldContinentBonus(ctx, state, id),
    0,
  );
}

function capitalRisk(ctx: PlanContext, state: SimState): number {
  let penalty = 0;
  for (const id of ctx.game.capitalTerritoryIds) {
    if (state.owners.get(id) !== ctx.botId) continue;
    const threat = strongestThreatAt(ctx, state, id);
    penalty += Math.max(0, threat * 1.2 - troopsIn(state, id));
  }
  return penalty;
}

function grudgeSatisfaction(ctx: PlanContext, state: SimState): number {
  let score = 0;
  for (const [playerId, damage] of state.damageByPlayer) {
    const grudge = grudgeAgainst(ctx.game, ctx.botId, playerId);
    if (grudge <= 0) continue;
    score += damage * Math.min(grudge / 10, 1);
  }
  return score;
}

function cardValue(ctx: PlanContext): number {
  const upcoming = upcomingSetValues(ctx.game, ctx.botId, 1)[0];
  return Math.min(upcoming ?? 6, CARD_VALUE_CAP);
}

function damageDealt(state: SimState): number {
  let total = 0;
  for (const damage of state.damageByPlayer.values()) total += damage;
  return total;
}

function scoreState(
  ctx: PlanContext,
  state: SimState,
  cachedProgress?: SideProgress,
): number {
  const { risk, waste, concentration } = riskAndWaste(ctx, state);
  const leader = antiLeaderActive(ctx.standing)
    ? strongestOpponent(ctx, state)
    : null;
  const scale = troopScale(state);
  let score = 0;
  score += INCOME * incomeEstimate(ctx, state, ctx.botId);
  score += HELD_BONUS * heldContinentBonus(ctx, state, ctx.botId);
  score += CONTINENT_PROGRESS * continentProgress(ctx, state);
  score += denial(ctx, state);
  score -= (ctx.weights.defense * FRONTIER_RISK * risk) / scale;
  score -= (INTERIOR_WASTE * waste) / scale;
  score -= ctx.weights.defense * EXPOSURE * exposure(ctx, state);
  score += (CONCENTRATION * concentration) / scale;
  const stacks = stackScores(ctx, state);
  score += (OPEN_STACK * openStackWeight(ctx) * stacks.open) / scale;
  score -=
    (STACK_PRESSURE *
      (ctx.weights.defense + DUEL_PRESSURE * ctx.duel.stacking) *
      stacks.pressure) /
    scale;
  score -= DUEL_BREAK * ctx.duel.breaking * opponentHeldBonus(ctx, state);
  score -= (DUEL_STACK_MASS * ctx.duel.rolling * stacks.mass) / scale;
  score -= CAPITAL_RISK * capitalRisk(ctx, state);
  if (leader && leader.playerId !== ctx.botId)
    score -=
      ctx.weights.antiLeader *
      ANTI_LEADER *
      ctx.standing.gangUp *
      leader.strength;
  score += ctx.weights.grudge * GRUDGE * grudgeSatisfaction(ctx, state);
  if (state.conquered && ctx.game.cards !== 'Off')
    score += CARD * cardValue(ctx);
  score -= (TROOP_LOSS * state.troopsLost) / scale;
  score += eliminationBonus(ctx, state);
  score += (DAMAGE * damageDealt(state)) / scale;
  score += standingScore(ctx, state);
  score += modeScore(ctx, state, cachedProgress);
  return score;
}

export function evaluateBoard(
  ctx: PlanContext,
  state: SimState,
  cachedProgress?: SideProgress,
): number {
  const raw = scoreState(ctx, state, cachedProgress);
  const afterResponse = scoreState(ctx, applyEnemyResponse(ctx, state));
  return 0.25 * raw + 0.75 * afterResponse;
}
