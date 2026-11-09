import assert from 'node:assert/strict';
import { test } from 'node:test';
import { erraticStyle } from '../src/bots/personality/erratic';
import { buildContext } from '../src/bots/planning/context';
import { planBotTurn } from '../src/bots/planning/planBotTurn';
import { BotPersonality } from '../src/types';
import { mulberry32 } from './sim/randomize';
import {
  ScenarioSpec,
  buildGame,
  kinds,
  planScenario,
  primaryKind,
  replayBotTurn,
} from './testkit';

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

test('defensive keeps attacks few and reinforces its borders', () => {
  const plan = planScenario(withPersonality(completeVsBreak, 'defensive'));
  assert.ok(
    ['card', 'defensive'].includes(primaryKind(plan) ?? 'none'),
    `defensive picked ${primaryKind(plan)}`,
  );
  assert.ok(plan.attackSteps.length <= 3);
  assert.ok(new Set(plan.deployments.map((d) => d.territoryId)).size >= 2);
});

function fightBoard(
  attackerTroops: number,
  firstDefenders: number,
  secondDefenders: number,
): ScenarioSpec {
  return {
    map: {
      continents: [[0, 1, 2, 3, 4, 5, 6, 7]],
      edges: line(0, 1, 2, 3, 4, 5, 6, 7),
      bonuses: [4],
    },
    players: [1, 2],
    owners: { 0: 1, 1: 1, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2 },
    troops: {
      0: 2,
      1: attackerTroops,
      2: firstDefenders,
      3: secondDefenders,
      4: 4,
      5: 4,
      6: 4,
      7: 4,
    },
    troopsToDeploy: 1,
    difficulty: 'hard',
  };
}

function attackCount(spec: ScenarioSpec): number {
  return planScenario(withPersonality(spec, 'defensive')).attackSteps.length;
}

test('defensive never attacks when the attack is not safe', () => {
  assert.equal(attackCount(fightBoard(8, 5, 4)), 0);
});

test('defensive pushes into its home bonus while the odds are favorable', () => {
  const plan = planScenario(withPersonality(fightBoard(14, 3, 4), 'defensive'));
  assert.equal(primaryKind(plan), 'complete');
  assert.equal(plan.attackSteps[0]?.endId, 2);
});

test('defensive completes its home bonus with overwhelming force', () => {
  assert.equal(attackCount(fightBoard(30, 2, 3)), 6);
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
  'defensive',
  'erratic',
  'police',
  'hoarder',
  'opportunist',
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

function seededReplay(spec: ScenarioSpec, seed: number) {
  const originalRandom = Math.random;
  Math.random = mulberry32(seed);
  try {
    return replayBotTurn(spec);
  } finally {
    Math.random = originalRandom;
  }
}

const bonusesOnBothSides: ScenarioSpec = {
  map: {
    continents: [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
    ],
    edges: line(0, 1, 2, 3, 4, 5, 6, 7, 8),
    bonuses: [3, 2, 3],
  },
  players: [1, 2, 3],
  owners: { 0: 2, 1: 2, 2: 2, 3: 1, 4: 1, 5: 1, 6: 3, 7: 3, 8: 3 },
  troops: { 0: 4, 1: 4, 2: 2, 3: 12, 4: 2, 5: 12, 6: 2, 7: 4, 8: 4 },
  troopsToDeploy: 6,
  difficulty: 'hard',
};

test('police breaks every enemy bonus it can reach in one turn', () => {
  const plan = planScenario(withPersonality(bonusesOnBothSides, 'police'));
  const ends = plan.attackSteps.map((step) => step.endId);
  assert.ok(
    ends.includes(2) && ends.includes(6),
    `police hit: ${ends.join(', ')}`,
  );
});

const hoardBoard: ScenarioSpec = {
  map: {
    continents: [[0, 1, 2, 3, 4, 5, 6, 7]],
    edges: line(0, 1, 2, 3, 4, 5, 6, 7),
    bonuses: [0],
  },
  players: [1, 2],
  owners: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 2, 7: 2 },
  troops: { 0: 3, 1: 3, 2: 3, 3: 10, 4: 2, 5: 2, 6: 2, 7: 2 },
  troopsToDeploy: 6,
  botCards: 4,
  difficulty: 'hard',
};

test('hoarder conquers once, holds its cards and piles its troops on one stack', () => {
  const { game, dispatchFailures } = seededReplay(
    withPersonality(hoardBoard, 'hoarder'),
    1,
  );
  assert.equal(dispatchFailures, 0);
  const owned = [...game.territoryOwners]
    .filter(([, ownerId]) => ownerId === 1)
    .map(([id]) => id);
  assert.equal(owned.length, 5);
  assert.equal(game.playerCards.get(1)?.length, hoardBoard.botCards);
  assert.ok((game.territoryTroops.get(3) ?? 0) > hoardBoard.troops[3]);
  for (const id of owned.filter((id) => id !== 3))
    assert.ok((game.territoryTroops.get(id) ?? 0) <= 3, `stray stack on ${id}`);
});

test('hoarder in capitals mode piles its troops on its capital', () => {
  const plan = planScenario({
    ...withPersonality(hoardBoard, 'hoarder'),
    capitals: [1],
    settings: { gameMode: 'capitals' },
  });
  const onCapital = plan.deployments
    .filter((d) => d.territoryId === 1)
    .reduce((sum, d) => sum + d.troops, 0);
  assert.equal(onCapital, hoardBoard.troopsToDeploy);
  assert.equal(plan.attackSteps.length, 1);
  assert.equal(plan.fortify?.endId, 1);
});

const loneTroops: ScenarioSpec = {
  map: {
    continents: [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]],
    edges: line(0, 1, 2, 3, 4, 5, 6, 7, 8, 9),
    bonuses: [0],
  },
  players: [1, 2],
  owners: { 0: 2, 1: 2, 2: 2, 3: 2, 4: 1, 5: 1, 6: 2, 7: 2, 8: 2, 9: 2 },
  troops: { 0: 9, 4: 8, 5: 8, 9: 9 },
  troopsToDeploy: 4,
  difficulty: 'hard',
};

test('opportunist picks off every lone troop it can reach', () => {
  const { game, dispatchFailures } = seededReplay(
    withPersonality(loneTroops, 'opportunist'),
    1,
  );
  assert.equal(dispatchFailures, 0);
  const missed = [1, 2, 3, 6, 7, 8].filter(
    (id) => game.territoryOwners.get(id) !== 1,
  );
  assert.deepEqual(missed, []);
});

test('erratic sometimes plays a turn as police, hoarder or opportunist', () => {
  const originalRandom = Math.random;
  Math.random = mulberry32(7);
  try {
    const drawn = new Set(
      Array.from({ length: 200 }, () => erraticStyle().personality),
    );
    assert.deepEqual([...drawn].sort(), [
      'erratic',
      'hoarder',
      'opportunist',
      'police',
    ]);
  } finally {
    Math.random = originalRandom;
  }
});

test('erratic keeps the personality it drew for the rest of its turn', () => {
  const { game, botId } = buildGame(withPersonality(plainBoard, 'erratic'));
  const profile = { difficulty: 'hard', personality: 'erratic' } as const;
  const plan = planBotTurn(game, botId, profile, null).plan;
  assert.ok(plan.style);
  for (let i = 0; i < 10; i++)
    assert.equal(
      buildContext(game, botId, profile, plan).personality,
      plan.style.personality,
    );
});

test('hoarder takes the easiest attack even away from its stack', () => {
  const plan = planScenario({
    ...withPersonality(hoardBoard, 'hoarder'),
    owners: { ...hoardBoard.owners, 8: 2 },
    map: {
      ...hoardBoard.map,
      continents: [[0, 1, 2, 3, 4, 5, 6, 7, 8]],
      edges: [...hoardBoard.map.edges, [0, 8]],
    },
    troops: { ...hoardBoard.troops, 4: 5, 8: 1 },
  });
  assert.deepEqual(
    plan.attackSteps.map((step) => [step.startId, step.endId]),
    [[0, 8]],
  );
});

const twoRivals: ScenarioSpec = {
  map: {
    continents: [[0, 1, 2, 3, 4, 5, 6, 7, 8]],
    edges: line(0, 1, 2, 3, 4, 5, 6, 7, 8),
    bonuses: [0],
  },
  players: [1, 2, 3],
  owners: { 0: 2, 1: 2, 2: 2, 3: 2, 4: 1, 5: 3, 6: 3, 7: 3, 8: 3 },
  troops: { 0: 20, 1: 20, 2: 20, 3: 5, 4: 12, 5: 3, 6: 3, 7: 3, 8: 3 },
  troopsToDeploy: 4,
  difficulty: 'hard',
};

test('police goes after the strongest player even when the weaker one is easier', () => {
  const firstTarget = (personality: BotPersonality) =>
    planScenario(withPersonality(twoRivals, personality)).attackSteps[0]?.endId;
  assert.equal(firstTarget('balanced'), 5);
  assert.equal(firstTarget('police'), 3);
  const plan = planScenario(withPersonality(twoRivals, 'police'));
  assert.ok(plan.attackSteps.every((step) => step.endId !== 5));
});
