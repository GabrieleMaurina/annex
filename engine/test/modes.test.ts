import assert from 'node:assert/strict';
import { test } from 'node:test';
import { supplyHubTerritoryIds } from '../src/game/mechanics';
import { connectedOwnedTerritories } from '../src/game/world/connectivity';
import { ScenarioSpec, buildGame, kinds, planScenario } from './testkit';

function line(...ids: number[]): [number, number][] {
  const edges: [number, number][] = [];
  for (let i = 0; i < ids.length - 1; i++) edges.push([ids[i], ids[i + 1]]);
  return edges;
}

test('fog: an unseen death stack does not change the plan', () => {
  const base: ScenarioSpec = {
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
    troops: { 2: 16, 3: 1, 4: 6, 5: 6 },
    settings: { fogOfWar: 'on' },
  };
  const seen = planScenario(base);
  const withHidden: ScenarioSpec = {
    ...base,
    troops: { ...base.troops, 9: 40, 10: 40, 11: 40 },
  };
  const hidden = planScenario(withHidden);
  assert.deepEqual(
    kinds(seen),
    kinds(hidden),
    'unseen tiles leaked into the plan',
  );
  assert.equal(kinds(seen)[0], 'complete');
});

test('capitals: the bot grabs a soft enemy capital', () => {
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
      bonuses: [0, 0, 0],
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
    troops: { 3: 16, 4: 2, 5: 12, 6: 12, 7: 12, 8: 12 },
    troopsToDeploy: 6,
    settings: { gameMode: 'Capitals' },
    capitals: [1, 4, 10],
  };
  const plan = planScenario(spec);
  assert.ok(
    plan.attackSteps.some((s) => s.endId === 4),
    `expected an attack on the enemy capital t4, steps: ${JSON.stringify(
      plan.attackSteps.map((s) => [s.startId, s.endId]),
    )}`,
  );
});

test('teams: the bot attacks the enemy, not its weak teammate', () => {
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
        [1, 5],
        ...line(4, 5, 6, 7),
        [7, 8],
        ...line(8, 9, 10, 11),
      ],
      bonuses: [5, 3, 3],
    },
    players: [1, 2, 3],
    teams: { 1: 0, 2: 0, 3: 1 },
    owners: {
      0: 1,
      1: 1,
      2: 1,
      3: 3,
      4: 2,
      5: 2,
      6: 3,
      7: 3,
      8: 3,
      9: 3,
      10: 3,
      11: 3,
    },
    troops: { 2: 16, 3: 2, 4: 2, 5: 2, 6: 6 },
    troopsToDeploy: 6,
  };
  const plan = planScenario(spec);
  assert.ok(
    plan.objectives.every((o) => o.targetPlayerId !== 2),
    'targeted a teammate',
  );
  assert.ok(
    plan.attackSteps.every((s) => s.endId !== 4 && s.endId !== 5),
    'attacked a teammate tile',
  );
  assert.ok(kinds(plan).includes('complete'));
});

test('alliances: the bot leaves an allied border alone', () => {
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
        [1, 8],
        ...line(4, 5, 6, 7),
        ...line(8, 9, 10, 11),
      ],
      bonuses: [5, 3, 3],
    },
    players: [1, 2, 3],
    allies: [[1, 3]],
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
      9: 3,
      10: 3,
      11: 3,
    },
    troops: { 2: 16, 3: 2, 8: 1, 9: 1 },
    troopsToDeploy: 6,
  };
  const plan = planScenario(spec);
  assert.ok(
    plan.objectives.every((o) => o.targetPlayerId !== 3),
    'targeted an ally',
  );
  assert.ok(
    plan.attackSteps.every((s) => ![8, 9, 10, 11].includes(s.endId)),
    'attacked allied territory',
  );
});

test('supply lines: deployments stay connected to the supply hub', () => {
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
      2: 2,
      3: 2,
      4: 2,
      5: 2,
      6: 2,
      7: 2,
      8: 3,
      9: 3,
      10: 1,
      11: 1,
    },
    troops: { 0: 8, 1: 4, 10: 14, 11: 4, 2: 2, 9: 3 },
    troopsToDeploy: 10,
    settings: { supplyLines: 'on' },
  };
  const { game } = buildGame(spec);
  const supplied = connectedOwnedTerritories(
    game,
    1,
    supplyHubTerritoryIds(game, 1),
  );
  const plan = planScenario(spec);
  for (const d of plan.deployments)
    assert.ok(
      supplied.has(d.territoryId),
      `deployed to unsupplied tile ${d.territoryId}`,
    );
});

test('entrenchment: the bot routes around the hardened tile', () => {
  const spec: ScenarioSpec = {
    map: {
      continents: [
        [0, 1],
        [2, 3, 4],
        [5, 6, 7],
      ],
      edges: [[0, 1], [1, 2], [1, 3], [2, 4], [3, 4], [4, 5], ...line(5, 6, 7)],
      bonuses: [0, 0, 5],
    },
    players: [1, 2, 3],
    owners: {
      0: 1,
      1: 1,
      2: 2,
      3: 2,
      4: 2,
      5: 3,
      6: 3,
      7: 3,
    },
    troops: { 1: 20, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: 4 },
    troopsToDeploy: 6,
    settings: { entrenchments: 'on' },
    entrenched: [2],
  };
  const plan = planScenario(spec);
  assert.ok(kinds(plan).includes('break'), `kinds: ${kinds(plan)}`);
  assert.ok(
    plan.attackSteps.every((s) => s.endId !== 2),
    `routed through the entrenched t2: ${JSON.stringify(
      plan.attackSteps.map((s) => [s.startId, s.endId]),
    )}`,
  );
});

test('portals: an objective is reached through the portal', () => {
  const spec: ScenarioSpec = {
    map: {
      continents: [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
      ],
      edges: [...line(0, 1, 2), ...line(3, 4, 5), ...line(6, 7, 8), [5, 6]],
      bonuses: [3, 5, 3],
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
    troops: { 2: 18, 3: 2, 4: 2, 5: 2 },
    troopsToDeploy: 6,
    portals: [2, 3],
  };
  const plan = planScenario(spec);
  assert.ok(
    plan.attackSteps.some((s) => s.startId === 2 && s.endId === 3),
    `expected a portal hop t2->t3: ${JSON.stringify(
      plan.attackSteps.map((s) => [s.startId, s.endId]),
    )}`,
  );
});

test('assassin: the bot lines up a kill on a mid-sized opponent', () => {
  const spec: ScenarioSpec = {
    map: {
      continents: [
        [0, 1, 2, 3],
        [4, 5, 6],
        [7, 8, 9, 10],
      ],
      edges: [
        ...line(0, 1, 2, 3),
        [3, 4],
        ...line(4, 5, 6),
        [6, 7],
        ...line(7, 8, 9, 10),
      ],
      bonuses: [3, 3, 3],
    },
    players: [1, 2, 3],
    owners: {
      0: 1,
      1: 1,
      2: 1,
      3: 1,
      4: 3,
      5: 3,
      6: 3,
      7: 2,
      8: 2,
      9: 2,
      10: 2,
    },
    troops: { 3: 20, 4: 2, 5: 2, 6: 2, 7: 20 },
    troopsToDeploy: 6,
    settings: { gameMode: 'Assassin' },
  };
  const plan = planScenario(spec);
  assert.ok(kinds(plan).includes('eliminate'), `kinds: ${kinds(plan)}`);
  assert.ok(plan.objectives.some((o) => o.targetPlayerId === 3));
});

test('bounties: with a kill bounty the bot prioritises the elimination', () => {
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
        [2, 3],
        [3, 4],
        [4, 5],
        [5, 6],
        ...line(6, 7, 8, 9),
        [9, 10],
        ...line(10, 11, 12, 13),
      ],
      bonuses: [6, 0, 4, 4],
    },
    players: [1, 2, 3],
    owners: {
      0: 1,
      1: 1,
      2: 1,
      3: 3,
      4: 3,
      5: 2,
      6: 2,
      7: 2,
      8: 2,
      9: 2,
      10: 2,
      11: 2,
      12: 2,
      13: 2,
    },
    troops: { 2: 20, 3: 2, 4: 2, 5: 25, 6: 25 },
    troopsToDeploy: 8,
    settings: { bounties: 'on' },
  };
  const plan = planScenario(spec);
  assert.equal(plan.objectives[0].kind, 'eliminate', `kinds: ${kinds(plan)}`);
  assert.ok(plan.objectives.some((o) => o.targetPlayerId === 3));
});

test('teams: a continent shared with a teammate is not a completion target', () => {
  const spec: ScenarioSpec = {
    map: {
      continents: [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
      ],
      edges: [...line(0, 1, 2, 3), [3, 4], ...line(4, 5, 6, 7)],
      bonuses: [6, 3],
    },
    players: [1, 2, 3],
    teams: { 1: 0, 2: 0, 3: 1 },
    owners: {
      0: 1,
      1: 1,
      2: 2,
      3: 3,
      4: 3,
      5: 3,
      6: 3,
      7: 3,
    },
    troops: { 1: 14, 2: 4, 3: 2, 4: 6, 5: 6 },
    troopsToDeploy: 6,
  };
  const plan = planScenario(spec);
  assert.ok(
    !kinds(plan).includes('complete'),
    'planned to complete a continent held partly by a teammate',
  );
});
