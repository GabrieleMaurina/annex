import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ScenarioSpec, kinds, planScenario, primaryKind } from './testkit';

function line(...ids: number[]): [number, number][] {
  const edges: [number, number][] = [];
  for (let i = 0; i < ids.length - 1; i++) edges.push([ids[i], ids[i + 1]]);
  return edges;
}

function expectKind(spec: ScenarioSpec, kind: string, primary = true): void {
  const plan = planScenario(spec);
  const found = kinds(plan);
  assert.ok(
    found.includes(kind),
    `expected campaign "${kind}", got [${found.join(', ')}]`,
  );
  if (primary)
    assert.equal(
      primaryKind(plan),
      kind,
      `expected primary "${kind}", got "${primaryKind(plan)}" ([${found.join(', ')}])`,
    );
}

function expectTargetsPlayer(spec: ScenarioSpec, playerId: number): void {
  const plan = planScenario(spec);
  assert.ok(
    plan.objectives.some((o) => o.targetPlayerId === playerId),
    `expected an objective targeting player ${playerId}, got ${JSON.stringify(
      plan.objectives.map((o) => ({ kind: o.kind, target: o.targetPlayerId })),
    )}`,
  );
}

test('complete: last enemy tile in the bot continent', () => {
  const spec: ScenarioSpec = {
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
      bonuses: [6, 3, 3],
    },
    players: [1, 2, 3],
    owners: {
      0: 1,
      1: 1,
      2: 1,
      3: 2,
      4: 2,
      5: 3,
      6: 2,
      7: 3,
      8: 2,
      9: 3,
      10: 2,
      11: 3,
    },
    troops: { 2: 16, 3: 1, 4: 20, 5: 20, 6: 20, 7: 20 },
  };
  expectKind(spec, 'complete');
});

test('complete: two tiles left, generous staging stack', () => {
  const spec: ScenarioSpec = {
    map: {
      continents: [
        [0, 1, 2, 3, 4],
        [5, 6, 7, 8],
        [9, 10, 11, 12],
      ],
      edges: [
        ...line(0, 1, 2, 3, 4),
        [2, 5],
        ...line(5, 6, 7, 8),
        [8, 9],
        ...line(9, 10, 11, 12),
      ],
      bonuses: [8, 3, 3],
    },
    players: [1, 2, 3],
    owners: {
      0: 1,
      1: 1,
      2: 1,
      3: 2,
      4: 2,
      5: 2,
      6: 3,
      7: 2,
      8: 3,
      9: 2,
      10: 3,
      11: 2,
      12: 3,
    },
    troops: { 2: 24, 3: 2, 4: 2, 5: 25, 6: 25, 7: 25 },
    troopsToDeploy: 6,
  };
  expectKind(spec, 'complete');
});

test('break: enemy holds a full continent with a soft border', () => {
  const spec: ScenarioSpec = {
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
      bonuses: [4, 7, 4],
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
      9: 2,
      10: 3,
      11: 2,
    },
    troops: { 3: 22, 4: 1, 5: 6, 6: 6, 7: 6 },
  };
  expectKind(spec, 'break');
});

test('break: chip the weakest tile of a bonus continent', () => {
  const spec: ScenarioSpec = {
    map: {
      continents: [
        [0, 1, 2],
        [3, 4, 5, 6],
        [7, 8, 9],
      ],
      edges: [
        ...line(0, 1, 2),
        [2, 3],
        ...line(3, 4, 5, 6),
        [6, 7],
        ...line(7, 8, 9),
      ],
      bonuses: [3, 6, 3],
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
      7: 3,
      8: 2,
      9: 3,
    },
    troops: { 2: 15, 3: 2, 4: 7, 5: 7, 6: 7 },
    troopsToDeploy: 5,
  };
  expectKind(spec, 'break');
});

test('eliminate: opponent down to one tile on our border', () => {
  const spec: ScenarioSpec = {
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
      4: 1,
      5: 1,
      6: 1,
      7: 1,
      8: 3,
      9: 2,
      10: 2,
      11: 2,
    },
    troops: { 7: 14, 8: 2, 9: 18, 10: 18, 11: 18 },
    troopsToDeploy: 4,
  };
  expectKind(spec, 'eliminate');
  expectTargetsPlayer(spec, 3);
});

test('eliminate: finish a two-tile opponent rather than just break it', () => {
  const spec: ScenarioSpec = {
    map: {
      continents: [
        [0, 1, 2, 3],
        [4, 5],
        [6, 7, 8, 9],
        [10, 11, 12, 13],
      ],
      edges: [
        ...line(0, 1, 2, 3),
        [3, 4],
        ...line(4, 5),
        [5, 6],
        ...line(6, 7, 8, 9),
        [9, 10],
        ...line(10, 11, 12, 13),
      ],
      bonuses: [4, 3, 4, 4],
    },
    players: [1, 2, 3],
    owners: {
      0: 1,
      1: 1,
      2: 1,
      3: 1,
      4: 3,
      5: 3,
      6: 1,
      7: 1,
      8: 1,
      9: 1,
      10: 2,
      11: 2,
      12: 2,
      13: 2,
    },
    troops: { 3: 16, 4: 2, 5: 2, 9: 12, 10: 22, 11: 22 },
    troopsToDeploy: 5,
  };
  expectKind(spec, 'eliminate');
  expectTargetsPlayer(spec, 3);
});

test('spoilContinent: deny the last tile of a rich bonus', () => {
  const spec: ScenarioSpec = {
    map: {
      continents: [
        [0, 1, 2, 3],
        [4, 5, 6, 7, 8],
        [9, 10, 11],
      ],
      edges: [
        ...line(0, 1, 2, 3),
        [3, 4],
        ...line(4, 5, 6, 7, 8),
        [8, 9],
        ...line(9, 10, 11),
      ],
      bonuses: [4, 9, 3],
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
    troops: { 3: 18, 4: 2, 5: 26, 6: 26, 7: 26, 8: 30, 9: 30, 10: 30, 11: 30 },
  };
  expectKind(spec, 'spoilContinent');
  expectTargetsPlayer(spec, 2);
});

test('spoilContinent: block a 4-of-5 continent grab', () => {
  const spec: ScenarioSpec = {
    map: {
      continents: [
        [0, 1, 2],
        [3, 4, 5, 6, 7],
        [8, 9, 10],
      ],
      edges: [
        ...line(0, 1, 2),
        [2, 3],
        ...line(3, 4, 5, 6, 7),
        [7, 8],
        ...line(8, 9, 10),
      ],
      bonuses: [3, 8, 3],
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
      7: 3,
      8: 3,
      9: 3,
      10: 3,
    },
    troops: { 2: 16, 3: 2, 4: 25, 5: 25, 6: 25, 7: 30, 8: 30, 9: 30, 10: 30 },
  };
  expectKind(spec, 'spoilContinent');
});

test('antiLeader: hit the runaway leader we border', () => {
  const owners: Record<number, number> = {};
  for (const id of [0, 1, 2, 3]) owners[id] = 1;
  for (const id of [4, 6, 8, 10, 12, 14, 16, 18]) owners[id] = 2;
  for (const id of [5, 7, 9, 11, 13, 15, 17, 19]) owners[id] = 3;
  const spec: ScenarioSpec = {
    map: {
      continents: [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
        [8, 9, 10, 11],
        [12, 13, 14, 15],
        [16, 17, 18, 19],
      ],
      edges: [
        ...line(0, 1, 2, 3),
        [3, 4],
        ...line(4, 5, 6, 7),
        [7, 8],
        ...line(8, 9, 10, 11),
        [11, 12],
        ...line(12, 13, 14, 15),
        [15, 16],
        ...line(16, 17, 18, 19),
      ],
      bonuses: [4, 4, 4, 4, 4],
    },
    players: [1, 2, 3],
    owners,
    troops: { 3: 20, 4: 5, 6: 5, 8: 5, 10: 5 },
  };
  expectKind(spec, 'antiLeader');
  expectTargetsPlayer(spec, 2);
});

test('antiLeader: leader dominates two continents but stays reachable', () => {
  const owners: Record<number, number> = {};
  for (const id of [0, 1, 2, 3]) owners[id] = 1;
  for (const id of [4, 5, 6, 8, 9, 10, 12, 14]) owners[id] = 2;
  for (const id of [7, 11, 13, 15]) owners[id] = 3;
  const spec: ScenarioSpec = {
    map: {
      continents: [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
        [8, 9, 10, 11],
        [12, 13, 14, 15],
      ],
      edges: [
        ...line(0, 1, 2, 3),
        [3, 4],
        ...line(4, 5, 6, 7),
        [7, 8],
        ...line(8, 9, 10, 11),
        [11, 12],
        ...line(12, 13, 14, 15),
      ],
      bonuses: [4, 4, 4, 4],
    },
    players: [1, 2, 3],
    owners,
    troops: { 3: 22, 4: 6, 5: 6, 6: 6 },
    troopsToDeploy: 8,
  };
  expectTargetsPlayer(spec, 2);
});

test('neutralizeThreat: smash the stack aimed at our weak point', () => {
  const spec: ScenarioSpec = {
    map: {
      continents: [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
        [8, 9, 10, 11],
      ],
      edges: [
        ...line(0, 1, 2, 3),
        [0, 3],
        [1, 4],
        [3, 4],
        ...line(4, 5, 6, 7),
        [7, 8],
        ...line(8, 9, 10, 11),
      ],
      bonuses: [4, 4, 4],
    },
    players: [1, 2, 4],
    owners: {
      0: 1,
      1: 1,
      2: 1,
      3: 1,
      4: 2,
      5: 2,
      6: 2,
      7: 2,
      8: 4,
      9: 4,
      10: 4,
      11: 4,
    },
    troops: {
      1: 3,
      3: 18,
      4: 17,
      5: 4,
      6: 4,
      7: 4,
      8: 12,
      9: 12,
      10: 12,
      11: 12,
    },
  };
  expectKind(spec, 'neutralizeThreat');
});

test('neutralizeThreat: preempt the stack that would sweep our border', () => {
  const spec: ScenarioSpec = {
    map: {
      continents: [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
      ],
      edges: [
        ...line(0, 1, 2),
        [0, 2],
        [1, 3],
        [2, 3],
        ...line(3, 4, 5),
        [5, 6],
        ...line(6, 7, 8),
      ],
      bonuses: [3, 3, 3],
    },
    players: [1, 2, 4],
    owners: {
      0: 1,
      1: 1,
      2: 1,
      3: 2,
      4: 2,
      5: 2,
      6: 4,
      7: 4,
      8: 4,
    },
    troops: { 1: 3, 2: 16, 3: 15, 4: 5, 5: 5, 6: 14, 7: 14, 8: 14 },
    troopsToDeploy: 6,
  };
  expectKind(spec, 'neutralizeThreat');
});

test('merge: link two stacks through one enemy tile', () => {
  const spec: ScenarioSpec = {
    map: {
      continents: [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
        [8, 9, 10, 11],
      ],
      edges: [
        ...line(0, 1, 2, 3),
        [1, 5],
        ...line(4, 5, 6, 7),
        [3, 4],
        [4, 8],
        ...line(8, 9, 10, 11),
      ],
      bonuses: [4, 4, 4],
    },
    players: [1, 2, 3],
    owners: {
      1: 1,
      2: 1,
      6: 1,
      7: 1,
      0: 2,
      3: 2,
      4: 2,
      5: 2,
      8: 3,
      9: 3,
      10: 3,
      11: 3,
    },
    troops: { 1: 12, 2: 3, 6: 11, 7: 3, 5: 1, 0: 5, 3: 5, 4: 5, 8: 20, 9: 20 },
    troopsToDeploy: 5,
    difficulty: 'hard',
  };
  expectKind(spec, 'merge');
});

test('merge: two stacks two hops apart', () => {
  const spec: ScenarioSpec = {
    map: {
      continents: [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
      ],
      edges: [
        ...line(0, 1, 2),
        [1, 3],
        ...line(3, 4, 5),
        [2, 5],
        ...line(6, 7, 8),
        [4, 6],
      ],
      bonuses: [3, 3, 3],
    },
    players: [1, 2, 3],
    owners: {
      0: 1,
      1: 1,
      5: 1,
      2: 2,
      3: 2,
      4: 2,
      6: 3,
      7: 3,
      8: 3,
    },
    troops: { 1: 12, 0: 3, 5: 11, 2: 1, 3: 1, 4: 6, 6: 18, 7: 18 },
    troopsToDeploy: 6,
    difficulty: 'hard',
  };
  expectKind(spec, 'merge');
});

test('shrinkBorder: eat the enclosed pocket in our region', () => {
  const spec: ScenarioSpec = {
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
        [3, 0],
        [0, 4],
        [1, 4],
        [2, 4],
        [3, 4],
        [3, 7],
        [5, 6],
        [6, 7],
        ...line(7, 8, 9, 10),
      ],
      bonuses: [5, 3, 4],
    },
    players: [1, 2, 3],
    owners: {
      0: 1,
      1: 1,
      2: 1,
      3: 1,
      4: 2,
      5: 3,
      6: 3,
      7: 2,
      8: 2,
      9: 3,
      10: 3,
    },
    troops: { 0: 10, 1: 5, 2: 5, 3: 7, 4: 2, 5: 8, 6: 8, 7: 6, 8: 10 },
    troopsToDeploy: 5,
  };
  expectKind(spec, 'shrinkBorder');
});

test('shrinkBorder: swallow the notch that keeps three tiles exposed', () => {
  const spec: ScenarioSpec = {
    map: {
      continents: [
        [0, 1, 2, 3, 4],
        [5, 6, 7],
        [8, 9, 10, 11],
      ],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 0],
        [1, 5],
        [2, 5],
        [3, 5],
        [4, 9],
        [6, 7],
        [7, 8],
        ...line(8, 9, 10, 11),
      ],
      bonuses: [6, 3, 4],
    },
    players: [1, 2, 3],
    owners: {
      0: 1,
      1: 1,
      2: 1,
      3: 1,
      4: 1,
      5: 2,
      6: 3,
      7: 3,
      8: 2,
      9: 2,
      10: 3,
      11: 3,
    },
    troops: { 0: 4, 1: 5, 2: 5, 3: 5, 4: 8, 5: 2, 6: 9, 7: 9, 8: 14, 9: 14 },
    troopsToDeploy: 5,
  };
  expectKind(spec, 'shrinkBorder');
});

test('holdChokepoint: stack the sole link between our two halves', () => {
  const spec: ScenarioSpec = {
    map: {
      continents: [
        [0, 1, 2, 3, 4],
        [5, 6, 7, 8],
        [9, 10, 11],
      ],
      edges: [
        ...line(0, 1, 2, 3, 4),
        [2, 5],
        ...line(5, 6, 7, 8),
        [8, 9],
        ...line(9, 10, 11),
      ],
      bonuses: [5, 4, 3],
    },
    players: [1, 2, 3],
    owners: {
      0: 1,
      1: 1,
      2: 1,
      3: 1,
      4: 1,
      5: 2,
      6: 2,
      7: 2,
      8: 3,
      9: 3,
      10: 3,
      11: 3,
    },
    troops: { 0: 2, 1: 2, 2: 3, 3: 2, 4: 2, 5: 24, 6: 6, 7: 6, 8: 6 },
    troopsToDeploy: 10,
  };
  expectKind(spec, 'holdChokepoint');
});

test('holdChokepoint: fortify the neck against a mild but real threat', () => {
  const spec: ScenarioSpec = {
    map: {
      continents: [
        [0, 1, 2, 3, 4, 5],
        [6, 7, 8],
        [9, 10, 11],
      ],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
        [3, 6],
        ...line(6, 7, 8),
        [8, 9],
        ...line(9, 10, 11),
      ],
      bonuses: [6, 3, 3],
    },
    players: [1, 2, 3],
    owners: {
      0: 1,
      1: 1,
      2: 1,
      3: 1,
      4: 1,
      5: 1,
      6: 2,
      7: 2,
      8: 3,
      9: 3,
      10: 3,
      11: 3,
    },
    troops: { 0: 2, 1: 2, 2: 2, 3: 4, 4: 2, 5: 2, 6: 22, 7: 6, 8: 6 },
    troopsToDeploy: 9,
    personality: 'balanced',
  };
  expectKind(spec, 'holdChokepoint');
});

test('card: safely pocket one soft tile for the draw', () => {
  const spec: ScenarioSpec = {
    map: {
      continents: [[0, 1, 2], [3], [4, 5, 6, 7]],
      edges: [...line(0, 1, 2), [2, 3], [3, 4], ...line(4, 5, 6, 7)],
      bonuses: [3, 0, 4],
    },
    players: [1, 2, 3],
    owners: {
      0: 1,
      1: 1,
      2: 1,
      3: 2,
      4: 2,
      5: 3,
      6: 3,
      7: 3,
    },
    troops: { 2: 6, 3: 1, 4: 3, 5: 8, 6: 8, 7: 8 },
    troopsToDeploy: 3,
    botCards: 2,
  };
  expectKind(spec, 'card');
});

test('card: nothing strategic, one safe grab available', () => {
  const spec: ScenarioSpec = {
    map: {
      continents: [[0, 1, 2, 3], [4], [5, 6, 7, 8]],
      edges: [...line(0, 1, 2, 3), [3, 4], [4, 5], ...line(5, 6, 7, 8)],
      bonuses: [4, 0, 4],
    },
    players: [1, 2, 3],
    owners: {
      0: 1,
      1: 1,
      2: 1,
      3: 1,
      4: 2,
      5: 2,
      6: 3,
      7: 3,
      8: 3,
    },
    troops: { 3: 7, 4: 1, 5: 3, 6: 9, 7: 9, 8: 9 },
    troopsToDeploy: 2,
    botCards: 3,
  };
  expectKind(spec, 'card');
});

test('defensive: no viable attack anywhere', () => {
  const spec: ScenarioSpec = {
    map: {
      continents: [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
        [8, 9, 10, 11],
      ],
      edges: [
        ...line(0, 1, 2, 3),
        [3, 4],
        [2, 5],
        ...line(4, 5, 6, 7),
        [7, 8],
        ...line(8, 9, 10, 11),
      ],
      bonuses: [4, 4, 4],
    },
    players: [1, 2, 3],
    owners: {
      1: 1,
      2: 1,
      0: 2,
      3: 2,
      4: 2,
      5: 2,
      6: 2,
      7: 3,
      8: 3,
      9: 3,
      10: 3,
      11: 3,
    },
    troops: { 1: 2, 2: 2, 0: 12, 3: 12, 4: 12, 5: 12 },
    troopsToDeploy: 3,
  };
  expectKind(spec, 'defensive');
});

test('defensive: thin holdings ringed by strong stacks', () => {
  const spec: ScenarioSpec = {
    map: {
      continents: [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
      ],
      edges: [
        ...line(0, 1, 2),
        [0, 3],
        [2, 4],
        ...line(3, 4, 5),
        [5, 6],
        ...line(6, 7, 8),
      ],
      bonuses: [3, 3, 3],
    },
    players: [1, 2, 3],
    owners: {
      0: 1,
      1: 1,
      2: 1,
      3: 2,
      4: 2,
      5: 2,
      6: 3,
      7: 3,
      8: 3,
    },
    troops: { 0: 2, 1: 2, 2: 2, 3: 14, 4: 14, 5: 14 },
    troopsToDeploy: 4,
  };
  expectKind(spec, 'defensive');
});
