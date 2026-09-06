import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BotPersonality } from '../src/types';
import { ScenarioSpec, kinds, planScenario, primaryKind } from './testkit';

function line(...ids: number[]): [number, number][] {
  const edges: [number, number][] = [];
  for (let i = 0; i < ids.length - 1; i++) edges.push([ids[i], ids[i + 1]]);
  return edges;
}

function withPersonality(
  spec: ScenarioSpec,
  personality: BotPersonality,
): ScenarioSpec {
  return { ...spec, personality };
}

function primaryFor(spec: ScenarioSpec, personality: BotPersonality): string {
  return (
    primaryKind(planScenario(withPersonality(spec, personality))) ?? 'none'
  );
}

function targetsFor(
  spec: ScenarioSpec,
  personality: BotPersonality,
): (number | null)[] {
  return planScenario(withPersonality(spec, personality)).objectives.map(
    (o) => o.targetPlayerId,
  );
}

const completeVsBreak: ScenarioSpec = {
  map: {
    continents: [
      [0, 1, 2, 3],
      [4, 5, 6, 7],
      [8, 9, 10, 11],
    ],
    edges: [
      ...line(0, 1, 2, 3),
      [0, 4],
      ...line(4, 5, 6, 7),
      [7, 8],
      ...line(8, 9, 10, 11),
    ],
    bonuses: [4, 6, 3],
  },
  players: [1, 2, 3],
  owners: {
    0: 1,
    1: 1,
    2: 1,
    3: 2,
    4: 2,
    5: 2,
    6: 2,
    7: 2,
    8: 3,
    9: 2,
    10: 3,
    11: 2,
  },
  troops: { 1: 4, 2: 14, 0: 14, 3: 2, 4: 4, 5: 4, 6: 4, 7: 4 },
  troopsToDeploy: 10,
  difficulty: 'hard',
};

test('taker finishes its own continent', () => {
  assert.equal(primaryFor(completeVsBreak, 'taker'), 'complete');
});

test('breaker cracks the enemy bonus continent', () => {
  assert.equal(primaryFor(completeVsBreak, 'breaker'), 'break');
});

test('balanced commits to one of the two offensives', () => {
  assert.ok(
    ['complete', 'break'].includes(primaryFor(completeVsBreak, 'balanced')),
    `balanced picked ${primaryFor(completeVsBreak, 'balanced')}`,
  );
});

const killVsComplete: ScenarioSpec = {
  map: {
    continents: [
      [0, 1, 2, 3],
      [4, 5, 6, 7],
      [8, 9, 10, 11],
    ],
    edges: [
      ...line(0, 1, 2, 3),
      ...line(3, 4, 5, 6, 7),
      [7, 8],
      ...line(8, 9, 10, 11),
    ],
    bonuses: [5, 3, 4],
  },
  players: [1, 2, 3],
  owners: {
    0: 1,
    1: 1,
    2: 1,
    3: 3,
    4: 3,
    5: 3,
    6: 2,
    7: 2,
    8: 2,
    9: 2,
    10: 2,
    11: 2,
  },
  troops: { 1: 4, 2: 16, 3: 2, 4: 2, 5: 2, 6: 22, 7: 22, 8: 22 },
  troopsToDeploy: 8,
  difficulty: 'hard',
};

test('killer finishes off the weak opponent', () => {
  assert.ok(
    kinds(planScenario(withPersonality(killVsComplete, 'killer'))).includes(
      'eliminate',
    ),
    `killer kinds: ${kinds(planScenario(withPersonality(killVsComplete, 'killer'))).join(', ')}`,
  );
  assert.ok(targetsFor(killVsComplete, 'killer').includes(3));
});

test('taker takes the continent instead of chasing the kill', () => {
  assert.equal(primaryFor(killVsComplete, 'taker'), 'complete');
});

const grudgeBoard: ScenarioSpec = {
  map: {
    continents: [
      [0, 1, 2, 3],
      [4, 5, 6, 7],
      [8, 9, 10, 11],
    ],
    edges: [
      ...line(0, 1, 2, 3),
      [0, 4],
      ...line(4, 5, 6, 7),
      [7, 8],
      ...line(8, 9, 10, 11),
    ],
    bonuses: [6, 4, 3],
  },
  players: [1, 2, 3],
  owners: {
    0: 1,
    1: 1,
    2: 1,
    3: 2,
    4: 2,
    5: 2,
    6: 2,
    7: 2,
    8: 3,
    9: 2,
    10: 3,
    11: 2,
  },
  troops: { 1: 4, 2: 14, 0: 14, 3: 2, 4: 3, 5: 3, 6: 3, 7: 3 },
  troopsToDeploy: 10,
  difficulty: 'hard',
  grudges: [{ attacker: 2, conquered: true, defenceLosses: 6, count: 4 }],
};

test('vengeful turns on the player that has been attacking it', () => {
  assert.ok(
    targetsFor(grudgeBoard, 'vengeful').includes(2),
    `vengeful targets: ${targetsFor(grudgeBoard, 'vengeful').join(', ')}`,
  );
});

test('taker ignores the grudge and finishes its continent', () => {
  assert.equal(primaryFor(grudgeBoard, 'taker'), 'complete');
});

const twinContinents: ScenarioSpec = {
  map: {
    continents: [
      [0, 1, 2, 3],
      [4, 5, 6],
      [7, 8, 9, 10],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [2, 4],
      ...line(4, 5, 6),
      [6, 8],
      [7, 8],
      ...line(8, 9, 10),
    ],
    bonuses: [5, 3, 5],
  },
  players: [1, 2, 3],
  owners: {
    0: 1,
    1: 1,
    2: 1,
    3: 2,
    4: 1,
    5: 1,
    6: 1,
    7: 3,
    8: 1,
    9: 1,
    10: 1,
  },
  troops: { 2: 12, 8: 12, 3: 2, 7: 2 },
  troopsToDeploy: 4,
  difficulty: 'hard',
};

test('erratic keeps producing valid but differing plans', () => {
  const originalRandom = Math.random;
  let s = 0x9e3779b9;
  Math.random = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  try {
    const firstTargets = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const plan = planScenario(
        withPersonality(twinContinents, 'erratic'),
        false,
      );
      assert.ok(plan.objectives.length > 0, 'erratic produced no objective');
      const deployed = plan.deployments.reduce((sum, d) => sum + d.troops, 0);
      assert.ok(deployed <= twinContinents.troopsToDeploy!, 'over-deployed');
      const target = plan.objectives[0].mustVisit[0];
      if (target !== undefined) firstTargets.add(target);
    }
    assert.ok(
      firstTargets.size >= 2,
      `erratic always hit the same tile: ${[...firstTargets].join(', ')}`,
    );
  } finally {
    Math.random = originalRandom;
  }
});

const plainBoard: ScenarioSpec = {
  map: {
    continents: [
      [0, 1, 2, 3],
      [4, 5, 6, 7],
      [8, 9, 10, 11],
    ],
    edges: [
      ...line(0, 1, 2, 3),
      [3, 4],
      ...line(4, 5, 6, 7),
      [7, 8],
      ...line(8, 9, 10, 11),
    ],
    bonuses: [4, 4, 4],
  },
  players: [1, 2, 3],
  owners: {
    0: 1,
    1: 1,
    2: 1,
    3: 1,
    4: 2,
    5: 2,
    6: 2,
    7: 2,
    8: 3,
    9: 3,
    10: 3,
    11: 3,
  },
  troops: { 3: 12, 4: 6, 5: 6, 6: 6, 7: 6, 8: 6 },
  troopsToDeploy: 8,
};

for (const personality of [
  'balanced',
  'taker',
  'breaker',
  'killer',
  'vengeful',
  'erratic',
] as BotPersonality[]) {
  test(`${personality} produces a feasible plan on a plain board`, () => {
    const plan = planScenario(withPersonality(plainBoard, personality));
    assert.ok(plan.objectives.length > 0, `${personality}: empty plan`);
    assert.ok(
      plan.deployments.reduce((s, d) => s + d.troops, 0) <=
        plainBoard.troopsToDeploy!,
      `${personality}: over-deployed`,
    );
  });
}
