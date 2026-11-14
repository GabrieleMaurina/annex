import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanupCandidates } from '../../src/bots/cleanup/cleanup';
import { difficultyParams } from '../../src/bots/difficulty';
import { buildContext, snapshotState } from '../../src/bots/planning/context';
import { simulateTurn } from '../../src/bots/planning/simulate';
import { TurnPlan } from '../../src/bots/planning/turnPlan';
import {
  ScenarioSpec,
  buildGame,
  kinds,
  planScenario,
  replayBotTurn,
} from '../testkit';

const COLUMNS = 5;
const BOT = 1;
const ENEMY = 2;
const THIRD = 3;
const ROWS_TOTAL = 4;
const HOME_START = 50;
const HOME_SIZE = 10;

function at(row: number, column: number): number {
  return row * COLUMNS + column;
}

function gridEdges(rows: number): [number, number][] {
  const edges: [number, number][] = [];
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < COLUMNS; column++) {
      if (column + 1 < COLUMNS)
        edges.push([at(row, column), at(row, column + 1)]);
      if (row + 1 < rows) edges.push([at(row, column), at(row + 1, column)]);
    }
  return edges;
}

function cleanupSpec(
  enemies: Record<number, number>,
  options: {
    deploy: number;
    botTroops?: Record<number, number>;
    settings?: ScenarioSpec['settings'];
    rows?: number;
    thirdParty?: number[];
    link?: number;
  },
): ScenarioSpec {
  const rows = options.rows ?? ROWS_TOTAL;
  const grid = Array.from({ length: rows * COLUMNS }, (_, id) => id);
  const home = Array.from(
    { length: HOME_SIZE },
    (_, index) => HOME_START + index,
  );
  const owners: Record<number, number> = {};
  const troops: Record<number, number> = {};
  for (const id of grid) {
    owners[id] = enemies[id] !== undefined ? ENEMY : BOT;
    troops[id] = enemies[id] ?? options.botTroops?.[id] ?? 1;
  }
  for (const id of options.thirdParty ?? []) {
    owners[id] = THIRD;
    troops[id] = 5;
  }
  for (const id of home) {
    owners[id] = ENEMY;
    troops[id] = 3;
  }
  const edges = [
    ...gridEdges(rows),
    ...home.slice(1).map((id) => [id - 1, id] as [number, number]),
    ...(options.link === undefined
      ? []
      : [[options.link, HOME_START] as [number, number]]),
  ];
  return {
    map: { continents: [[...grid, ...home]], edges, bonuses: [0] },
    players: options.thirdParty ? [BOT, ENEMY, THIRD] : [BOT, ENEMY],
    owners,
    troops,
    troopsToDeploy: options.deploy,
    difficulty: 'hard',
    personality: 'balanced',
    cards: 'off',
    settings: options.settings,
  };
}

function deployedTotal(plan: TurnPlan): number {
  return plan.deployments.reduce((sum, d) => sum + d.troops, 0);
}

function conqueredIds(plan: TurnPlan): number[] {
  return plan.attackSteps.map((step) => step.endId);
}

const ISOLATED_SINGLES = { [at(1, 1)]: 1, [at(1, 3)]: 1, [at(2, 2)]: 1 };

test('cleanup plan deploys exactly what is needed to take isolated singles', () => {
  const plan = planScenario(cleanupSpec(ISOLATED_SINGLES, { deploy: 12 }));
  assert.ok(kinds(plan).includes('cleanup'));
  assert.deepEqual(
    [...new Set(conqueredIds(plan))].sort((a, b) => a - b),
    Object.keys(ISOLATED_SINGLES)
      .map(Number)
      .sort((a, b) => a - b),
  );
  assert.equal(deployedTotal(plan), 12);
  for (const deployment of plan.deployments)
    assert.ok(deployment.troops >= 3, 'no troops wasted on thin spots');
});

test('cleanup plan does not spread troops around an enclosed enemy', () => {
  const plan = planScenario(cleanupSpec({ [at(1, 2)]: 1 }, { deploy: 3 }));
  assert.ok(kinds(plan).includes('cleanup'));
  const staging = plan.deployments.filter(
    (d) =>
      d.troops > 0 && plan.attackSteps.some((s) => s.startId === d.territoryId),
  );
  assert.equal(staging.length, 1);
  assert.ok(staging[0].troops <= 5);
});

test('cleanup plan uses fewer troops where the bot already has a stack', () => {
  const plan = planScenario(
    cleanupSpec(ISOLATED_SINGLES, {
      deploy: 12,
      botTroops: { [at(1, 2)]: 9 },
    }),
  );
  assert.ok(kinds(plan).includes('cleanup'));
  assert.equal(new Set(conqueredIds(plan)).size, 3);
});

function minimumBudget(
  enemies: Record<number, number>,
  settings?: ScenarioSpec['settings'],
): number {
  const targets = Object.keys(enemies).map(Number);
  for (let deploy = 1; deploy <= 80; deploy++) {
    const { game, botId } = buildGame(
      cleanupSpec(enemies, { deploy, settings }),
    );
    const ctx = buildContext(
      game,
      botId,
      { difficulty: 'hard', personality: 'balanced' },
      null,
    );
    const candidate = cleanupCandidates(ctx, snapshotState(ctx), deploy)[0];
    if (!candidate) continue;
    const taken = new Set(
      simulateTurn(ctx, candidate).attackSteps.map((step) => step.endId),
    );
    if (targets.every((id) => taken.has(id))) return deploy;
  }
  return Infinity;
}

test('cleanup plan sizes the force to the defenders', () => {
  const single = minimumBudget({ [at(1, 2)]: 1 });
  const double = minimumBudget({ [at(1, 2)]: 2 });
  const triple = minimumBudget({ [at(1, 2)]: 4 });
  assert.equal(single, 3);
  assert.ok(double > single);
  assert.ok(triple > double);
  assert.ok(triple < Infinity);
});

test('cleanup plan chains a pocket of connected enemies', () => {
  const pocket = { [at(1, 1)]: 1, [at(1, 2)]: 1, [at(2, 2)]: 2 };
  const plan = planScenario(cleanupSpec(pocket, { deploy: 14 }));
  assert.ok(kinds(plan).includes('cleanup'));
  assert.deepEqual(
    [...new Set(conqueredIds(plan))].sort((a, b) => a - b),
    Object.keys(pocket)
      .map(Number)
      .sort((a, b) => a - b),
  );
});

test('cleanup plan accounts for other dice settings', () => {
  const enemies = { [at(1, 2)]: 2 };
  const normal = minimumBudget(enemies);
  const weakAttack = minimumBudget(enemies, { attackDice: 1 });
  const strongDefence = minimumBudget(enemies, { defenceDice: 3 });
  assert.ok(weakAttack > normal);
  assert.ok(strongDefence >= normal);
});

test('cleanup plan takes the affordable subset when troops run short', () => {
  const plan = planScenario(cleanupSpec(ISOLATED_SINGLES, { deploy: 8 }));
  assert.ok(new Set(conqueredIds(plan)).size >= 2);
});

function captureRate(spec: ScenarioSpec, enemyIds: number[], runs: number) {
  let cleared = 0;
  for (let run = 0; run < runs; run++) {
    const { game } = replayBotTurn(spec);
    if (enemyIds.every((id) => game.territoryOwners.get(id) === BOT)) cleared++;
  }
  return cleared / runs;
}

test('cleanup clears every enclosed enemy in one turn', () => {
  const runs = 40;
  const singles = {
    [at(0, 1)]: 1,
    [at(0, 3)]: 1,
    [at(1, 2)]: 1,
    [at(2, 1)]: 1,
    [at(2, 3)]: 1,
  };
  const ids = Object.keys(singles).map(Number);
  const spec = cleanupSpec(singles, { deploy: minimumBudget(singles) });
  const rate = captureRate(spec, ids, runs);
  const params = difficultyParams('hard');
  params.cleanup = false;
  const baseline = captureRate(spec, ids, runs);
  params.cleanup = true;
  console.log(`  singles cleared: cleanup ${rate}, without ${baseline}`);
  assert.ok(rate >= 0.85);
  assert.ok(rate > baseline);
});

test('cleanup clears a mixed field of singles, doubles and a pocket', () => {
  const field = {
    [at(0, 1)]: 1,
    [at(1, 3)]: 2,
    [at(2, 0)]: 1,
    [at(2, 2)]: 1,
    [at(2, 3)]: 1,
  };
  const ids = Object.keys(field).map(Number);
  const spec = cleanupSpec(field, { deploy: 28, rows: 4 });
  const rate = captureRate(spec, ids, 40);
  const params = difficultyParams('hard');
  params.cleanup = false;
  const baseline = captureRate(spec, ids, 40);
  params.cleanup = true;
  console.log(`  mixed field cleared: cleanup ${rate}, without ${baseline}`);
  assert.ok(rate >= 0.8);
  assert.ok(rate > baseline);
});

function cleanupTargets(spec: ScenarioSpec): number[] {
  const { game, botId } = buildGame(spec);
  const ctx = buildContext(
    game,
    botId,
    { difficulty: 'hard', personality: 'balanced' },
    null,
  );
  const candidate = cleanupCandidates(
    ctx,
    snapshotState(ctx),
    game.troopsToDeploy,
  )[0];
  if (!candidate) return [];
  const objective = candidate.objectives.find((o) => o.kind === 'cleanup')!;
  return [...objective.mustVisit].sort((a, b) => a - b);
}

test('cleanup also takes a pocket that is partly walled in by another player', () => {
  const spec = cleanupSpec(
    { [at(1, 2)]: 1 },
    { deploy: 10, thirdParty: [at(0, 2)] },
  );
  assert.deepEqual(cleanupTargets(spec), [at(1, 2)]);
});

test('cleanup takes the deep tip of an enemy branch but not the part joined to its land', () => {
  const branch = { [at(3, 2)]: 1, [at(2, 2)]: 1, [at(1, 2)]: 1 };
  const spec = cleanupSpec(branch, { deploy: 10, link: at(3, 2) });
  assert.deepEqual(cleanupTargets(spec), [at(1, 2)]);
});

test('cleanup leaves an enemy front line alone', () => {
  const front = { [at(1, 0)]: 1, [at(1, 1)]: 1, [at(1, 2)]: 1, [at(1, 3)]: 1 };
  const spec = cleanupSpec(front, {
    deploy: 10,
    thirdParty: [at(2, 0), at(2, 1), at(2, 2), at(2, 3), at(2, 4), at(1, 4)],
  });
  assert.deepEqual(cleanupTargets(spec), []);
});
