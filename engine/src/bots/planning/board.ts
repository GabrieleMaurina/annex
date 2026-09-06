import { upcomingSetValues } from '../../game/progression/cards';
import { grudgeAgainst } from '../features/grudge';
import {
  PlanContext,
  SimState,
  bonusOf,
  cloneState,
  heldContinentBonus,
  isBotBorder,
  isFriendly,
  neighborsOf,
  ownedClusters,
  ownedIds,
  strongestOpponent,
  strongestThreatAt,
  troopsIn,
} from './context';

const ENEMY_SWEEP_LIMIT = 5;

function applyEnemyResponse(ctx: PlanContext, state: SimState): SimState {
  const s = cloneState(state);
  const enemyStacks: number[] = [];
  for (const [id, ownerId] of s.owners) {
    if (isFriendly(ctx, ownerId)) continue;
    if (troopsIn(s, id) >= 2) enemyStacks.push(id);
  }
  enemyStacks.sort((a, b) => troopsIn(s, b) - troopsIn(s, a));

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
      if (target === null || attackers <= targetTroops * 1.05 + 1) break;
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
const CAPITAL_RISK = 2;
const ANTI_LEADER = 0.15;
const GRUDGE = 0.1;
const CARD = 0.5;
const TROOP_LOSS = 0.25;
const ELIMINATION = 9;

function eliminationBonus(ctx: PlanContext, state: SimState): number {
  let bonus = 0;
  for (const opponentId of ctx.preTurnOpponents) {
    let alive = false;
    for (const ownerId of state.owners.values())
      if (ownerId === opponentId) {
        alive = true;
        break;
      }
    if (alive) continue;
    bonus += ELIMINATION;
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
  return Math.max(3, Math.floor(owned / 3)) + capitals;
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
    } else {
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
  return upcoming ?? 6;
}

function scoreState(ctx: PlanContext, state: SimState): number {
  const { risk, waste, concentration } = riskAndWaste(ctx, state);
  const leader = strongestOpponent(ctx, state);
  let score = 0;
  score += INCOME * incomeEstimate(ctx, state, ctx.botId);
  score += HELD_BONUS * heldContinentBonus(ctx, state, ctx.botId);
  score += CONTINENT_PROGRESS * continentProgress(ctx, state);
  score += denial(ctx, state);
  score -= ctx.weights.defense * FRONTIER_RISK * risk;
  score -= INTERIOR_WASTE * waste;
  score -= ctx.weights.defense * EXPOSURE * exposure(ctx, state);
  score += CONCENTRATION * concentration;
  score -= CAPITAL_RISK * capitalRisk(ctx, state);
  if (leader && leader.playerId !== ctx.botId)
    score -= ctx.weights.antiLeader * ANTI_LEADER * leader.strength;
  score += ctx.weights.grudge * GRUDGE * grudgeSatisfaction(ctx, state);
  if (state.conquered) score += CARD * cardValue(ctx);
  score -= TROOP_LOSS * state.troopsLost;
  score += eliminationBonus(ctx, state);
  return score;
}

export function evaluateBoard(ctx: PlanContext, state: SimState): number {
  const raw = scoreState(ctx, state);
  const afterResponse = scoreState(ctx, applyEnemyResponse(ctx, state));
  return 0.25 * raw + 0.75 * afterResponse;
}
