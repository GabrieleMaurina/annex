import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withPortalEdges } from '../src/game/world/portals';
import { BotDifficulty, BotPersonality } from '../src/types';
import {
  MapSpec,
  ScenarioSpec,
  buildGame,
  planScenario,
  replayBotTurn,
} from './testkit';

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DIFFICULTIES: BotDifficulty[] = ['easy', 'medium', 'hard'];
const PERSONALITIES: BotPersonality[] = [
  'balanced',
  'taker',
  'breaker',
  'killer',
  'vengeful',
  'erratic',
];
const FORTIFICATIONS = ['Connected', 'Neighboring', 'Unrestricted'] as const;

function randomBoard(seed: number): ScenarioSpec {
  const rng = mulberry32(seed);
  const pick = <T>(xs: T[]): T => xs[Math.floor(rng() * xs.length)];
  const range = (lo: number, hi: number) =>
    lo + Math.floor(rng() * (hi - lo + 1));

  const territoryCount = range(10, 26);
  const ids = Array.from({ length: territoryCount }, (_, i) => i);

  const continents: number[][] = [];
  let cursor = 0;
  while (cursor < territoryCount) {
    const size = Math.min(range(2, 5), territoryCount - cursor);
    continents.push(ids.slice(cursor, cursor + size));
    cursor += size;
  }
  const bonuses = continents.map(() => range(0, 6));

  const edges: [number, number][] = [];
  for (let i = 1; i < territoryCount; i++) edges.push([i - 1, i]);
  const extra = range(territoryCount, territoryCount * 2);
  for (let i = 0; i < extra; i++) {
    const a = range(0, territoryCount - 1);
    const b = range(0, territoryCount - 1);
    if (a !== b) edges.push([a, b]);
  }

  const playerCount = range(2, 4);
  const players = Array.from({ length: playerCount }, (_, i) => i + 1);
  const botId = 1;

  const owners: Record<number, number> = {};
  const troops: Record<number, number> = {};
  for (const id of ids) {
    owners[id] = pick(players);
    troops[id] = rng() < 0.1 ? range(15, 40) : range(1, 10);
  }
  owners[0] = botId;
  owners[Math.min(2, territoryCount - 1)] = botId;
  troops[0] = range(4, 20);

  const map: MapSpec = { continents, edges, bonuses };
  const spec: ScenarioSpec = {
    map,
    players,
    botId,
    owners,
    troops,
    troopsToDeploy: range(0, 22),
    difficulty: pick(DIFFICULTIES),
    personality: pick(PERSONALITIES),
    settings: { fortification: pick([...FORTIFICATIONS]) },
  };
  if (rng() < 0.25) spec.settings!.fogOfWar = 'on';
  if (rng() < 0.15) {
    spec.settings!.gameMode = 'Capitals';
    spec.capitals = [1, 5, 9].filter((id) => id < territoryCount);
  }
  if (rng() < 0.15) spec.settings!.supplyLines = 'on';
  if (rng() < 0.15) {
    spec.settings!.entrenchments = 'on';
    spec.entrenched = ids.filter(() => rng() < 0.15);
  }
  if (rng() < 0.15) {
    const a = range(0, territoryCount - 1);
    const b = range(0, territoryCount - 1);
    if (a !== b) spec.portals = [a, b];
  }
  return spec;
}

function neighborMap(spec: ScenarioSpec): Map<number, Set<number>> {
  const { game } = buildGame(spec);
  const result = new Map<number, Set<number>>();
  const mapTerritories = [...game.territoryTroops.keys()];
  const raw = new Map<number, number[]>();
  for (const [a, b] of spec.map.edges) {
    if (!raw.has(a)) raw.set(a, []);
    if (!raw.has(b)) raw.set(b, []);
    if (!raw.get(a)!.includes(b)) raw.get(a)!.push(b);
    if (!raw.get(b)!.includes(a)) raw.get(b)!.push(a);
  }
  for (const id of mapTerritories)
    result.set(
      id,
      new Set(
        withPortalEdges(
          raw.get(id) ?? [],
          id,
          game.portalTerritoryIds,
          game.portalsEnabled,
        ),
      ),
    );
  return result;
}

test('buildTurnPlan output is structurally valid on random boards', () => {
  for (let seed = 1; seed <= 800; seed++) {
    const spec = randomBoard(seed);
    const plan = planScenario(spec);
    const { game } = buildGame(spec);
    const botId = spec.botId!;
    const ownedInitially = new Set(
      [...game.territoryOwners.entries()]
        .filter(([, o]) => o === botId)
        .map(([id]) => id),
    );
    const validTiles = new Set(game.territoryTroops.keys());
    const nbrs = neighborMap(spec);
    const budget = spec.troopsToDeploy!;
    const ctx = `seed ${seed}`;

    assert.ok(plan.objectives.length >= 1, `${ctx}: no objective`);
    assert.equal(plan.step, 0, `${ctx}: step not 0`);
    assert.equal(plan.deployCursor, 0, `${ctx}: cursor not 0`);
    assert.equal(plan.attacksIssued, 0, `${ctx}: attacksIssued not 0`);
    assert.equal(plan.cardSet, null, `${ctx}: unexpected card set`);

    const deployed = plan.deployments.reduce((s, d) => s + d.troops, 0);
    assert.ok(deployed <= budget, `${ctx}: deployed ${deployed} > ${budget}`);
    for (const d of plan.deployments) {
      assert.ok(d.troops >= 1, `${ctx}: non-positive deploy`);
      assert.ok(
        ownedInitially.has(d.territoryId),
        `${ctx}: deploy to non-owned ${d.territoryId}`,
      );
    }

    const conquered = new Set<number>();
    for (const step of plan.attackSteps) {
      assert.ok(validTiles.has(step.startId), `${ctx}: bad step start`);
      assert.ok(validTiles.has(step.endId), `${ctx}: bad step end`);
      assert.notEqual(step.startId, step.endId, `${ctx}: self attack`);
      assert.ok(
        ownedInitially.has(step.startId) || conquered.has(step.startId),
        `${ctx}: attack from unheld ${step.startId}`,
      );
      assert.ok(
        !ownedInitially.has(step.endId),
        `${ctx}: attack own tile ${step.endId}`,
      );
      assert.ok(!conquered.has(step.endId), `${ctx}: re-attack ${step.endId}`);
      assert.ok(
        nbrs.get(step.startId)?.has(step.endId),
        `${ctx}: ${step.endId} not adjacent to ${step.startId}`,
      );
      assert.ok(
        step.minWinProb >= 0 && step.minWinProb <= 1,
        `${ctx}: minWinProb ${step.minWinProb}`,
      );
      conquered.add(step.endId);
    }

    if (plan.fortify) {
      assert.notEqual(
        plan.fortify.startId,
        plan.fortify.endId,
        `${ctx}: fortify to self`,
      );
      assert.ok(plan.fortify.troops >= 1, `${ctx}: fortify non-positive`);
      assert.ok(
        validTiles.has(plan.fortify.startId) &&
          validTiles.has(plan.fortify.endId),
        `${ctx}: fortify bad tile`,
      );
    }
  }
});

test('the bot always finishes its turn cleanly on random boards', () => {
  let failures = 0;
  let stalls = 0;
  for (let seed = 1000; seed < 1320; seed++) {
    const spec = randomBoard(seed);
    const replay = replayBotTurn(spec);
    if (replay.dispatchFailures > 0) failures += replay.dispatchFailures;
    if (!replay.terminated) stalls++;
  }
  assert.equal(stalls, 0, `${stalls} turns failed to terminate`);
  assert.ok(failures <= 3, `${failures} unrecovered dispatch failures`);
});
