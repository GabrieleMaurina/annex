import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  expectedTrades,
  holdingGain,
} from '../../src/bots/features/cardOutlook';
import { buildContext, snapshotState } from '../../src/bots/planning/context';
import { planBotTurn } from '../../src/bots/planning/planBotTurn';
import { walkStack } from '../../src/bots/planning/simulate';
import { BotProfile, Card, CardSymbol, Game } from '../../src/types';
import { mulberry32 } from '../sim/randomize';
import { ScenarioSpec, buildGame, replayBotTurn } from '../testkit';

const S: CardSymbol = 'soldier';
const H: CardSymbol = 'humvee';
const T: CardSymbol = 'tank';

function hand(symbols: (CardSymbol | null)[], firstId = 100): Card[] {
  return symbols.map((symbol, i) => ({ territoryId: firstId + i, symbol }));
}

function calmBoard(
  cards: Game['cards'],
  hands: Record<number, Card[]>,
  settings: Partial<Game> = {},
): ScenarioSpec {
  return {
    map: {
      continents: [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
        [8, 9, 10, 11],
      ],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
        [5, 6],
        [6, 7],
        [7, 8],
        [8, 9],
        [9, 10],
        [10, 11],
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
    troops: { 0: 3, 1: 3, 2: 3, 3: 25, 4: 3, 5: 3, 6: 3, 7: 60, 8: 60 },
    troopsToDeploy: 9,
    difficulty: 'hard',
    cards,
    settings: {
      playerCards: new Map(
        [1, 2, 3].map((id) => [id, hands[id] ?? []] as [number, Card[]]),
      ),
      ...settings,
    },
  };
}

function deterministic<T>(run: () => T): T {
  const originalRandom = Math.random;
  Math.random = () => 0.5;
  try {
    return run();
  } finally {
    Math.random = originalRandom;
  }
}

function firstEvent(
  spec: ScenarioSpec,
  profile: BotProfile = { difficulty: 'hard', personality: 'balanced' },
): string | undefined {
  const { game, botId } = buildGame(spec);
  return deterministic(
    () => planBotTurn(game, botId, profile, null).actions[0]?.event,
  );
}

function setsPlayedInTurn(spec: ScenarioSpec): number {
  const { game, dispatchFailures } = replayBotTurn(spec);
  assert.equal(dispatchFailures, 0);
  return game.cardSetsPlayed.get(0) ?? 0;
}

const RIVALS_CASHING = {
  2: hand([S, S, H, H, T], 200),
  3: hand([S, H, T, T, T], 300),
};

test('rivals are expected to trade by hand size, forced from five cards', () => {
  assert.equal(expectedTrades(2), 0);
  assert.ok(expectedTrades(3) > 0 && expectedTrades(3) < expectedTrades(4));
  assert.ok(expectedTrades(4) < 1);
  assert.equal(expectedTrades(5), 1);
  assert.equal(expectedTrades(7), 1);
  assert.equal(expectedTrades(8), 2);
});

test('constant: a mixed set is played at once', () => {
  assert.equal(
    firstEvent(calmBoard('Constant', { 1: hand([S, H, T]) })),
    'game:playCardSet',
  );
});

test('constant: a soldier triple is cashed and the wild kept for a strong set', () => {
  const { game, botId } = buildGame(
    calmBoard('Constant', { 1: hand([S, S, S, null]) }),
  );
  const { actions } = deterministic(() =>
    planBotTurn(
      game,
      botId,
      { difficulty: 'hard', personality: 'balanced' },
      null,
    ),
  );
  assert.deepEqual(actions[0], {
    event: 'game:playCardSet',
    payload: { cards: [100, 101, 102] },
  });
});

test('constant: a mixed set barely more likely next turn is not worth waiting for', () => {
  assert.equal(
    firstEvent(calmBoard('Constant', { 1: hand([S, S, S, H]) })),
    'game:playCardSet',
  );
});

test('constant: a tank triple is worth more now than a gamble on a mixed set', () => {
  assert.equal(
    firstEvent(calmBoard('Constant', { 1: hand([T, T, T, H]) })),
    'game:playCardSet',
  );
});

test('constant: five cards are always traded', () => {
  assert.equal(
    firstEvent(calmBoard('Constant', { 1: hand([S, S, S, H, H]) })),
    'game:playCardSet',
  );
});

test('escalating: a set is held while rivals are about to cash theirs', () => {
  const spec = calmBoard(
    'Exponential',
    { 1: hand([S, S, S]), ...RIVALS_CASHING },
    { cardsLastSetValue: new Map([[0, 10]]) },
  );
  assert.notEqual(firstEvent(spec), 'game:playCardSet');
  assert.equal(setsPlayedInTurn(spec), 0);
});

test('every personality times its cards on hard, none below hard except balanced', () => {
  const spec = calmBoard(
    'Exponential',
    { 1: hand([S, S, S]), ...RIVALS_CASHING },
    { cardsLastSetValue: new Map([[0, 10]]) },
  );
  for (const personality of ['killer', 'taker', 'defensive'] as const) {
    assert.notEqual(
      firstEvent(spec, { difficulty: 'hard', personality }),
      'game:playCardSet',
    );
    assert.equal(
      firstEvent(spec, { difficulty: 'medium', personality }),
      'game:playCardSet',
    );
  }
  assert.notEqual(
    firstEvent(spec, { difficulty: 'medium', personality: 'balanced' }),
    'game:playCardSet',
  );
});

test('escalating: a bot down to its last few territories cashes instead of holding', () => {
  const spec = calmBoard(
    'Exponential',
    { 1: hand([S, S, S]), ...RIVALS_CASHING },
    { cardsLastSetValue: new Map([[0, 10]]) },
  );
  spec.owners[0] = 2;
  assert.equal(firstEvent(spec), 'game:playCardSet');
});

test('exponential: a big set waits even when only one rival might cash first', () => {
  const spec = calmBoard(
    'Exponential',
    { 1: hand([S, S, S]), 2: hand([S, H, T], 200) },
    { cardsLastSetValue: new Map([[0, 30]]) },
  );
  const { game, botId } = buildGame(spec);
  assert.ok(holdingGain(game, botId) >= 40);
  assert.notEqual(firstEvent(spec), 'game:playCardSet');
});

test('escalating: a set is played when no rival will raise its value', () => {
  assert.equal(
    firstEvent(
      calmBoard(
        'Exponential',
        { 1: hand([S, S, S]) },
        { cardsLastSetValue: new Map([[0, 10]]) },
      ),
    ),
    'game:playCardSet',
  );
});

test('per player: rivals trading never raise the bot set, so it plays now', () => {
  assert.equal(
    firstEvent(
      calmBoard('Exponential Per Player', {
        1: hand([S, S, S]),
        ...RIVALS_CASHING,
      }),
    ),
    'game:playCardSet',
  );
});

test('escalating: holding is worth more the more rivals are about to trade', () => {
  const gainWith = (hands: Record<number, Card[]>) => {
    const { game, botId } = buildGame(
      calmBoard('Linear', { 1: hand([S, S, S]), ...hands }),
    );
    return holdingGain(game, botId);
  };
  assert.ok(
    gainWith({ 2: hand([S, H, T, T, T], 200) }) < gainWith(RIVALS_CASHING),
  );
  assert.ok(gainWith({}) < gainWith({ 2: hand([S, H, T, T, T], 200) }));
});

test('troops that eliminate a rival now are not held back', () => {
  const spec: ScenarioSpec = {
    map: {
      continents: [[0, 1, 2, 3, 4]],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
      ],
      bonuses: [3],
    },
    players: [1, 2, 3],
    owners: { 0: 1, 1: 1, 2: 1, 3: 2, 4: 3 },
    troops: { 2: 4, 3: 14, 4: 30 },
    troopsToDeploy: 3,
    difficulty: 'hard',
    cards: 'Exponential',
    settings: {
      playerCards: new Map([
        [1, hand([S, S, S])],
        [2, hand([S, S, H, H, T], 200)],
        [3, hand([S, H, T, T, T], 300)],
      ]),
      cardsLastSetValue: new Map([[0, 15]]),
    },
  };
  assert.equal(firstEvent(spec), 'game:playCardSet');
});

function captureBoard(rivalCards: Card[]): ScenarioSpec {
  return {
    map: {
      continents: [[0, 1, 2, 3, 4, 5, 6]],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
        [5, 6],
      ],
      bonuses: [0],
    },
    players: [1, 2, 3],
    owners: { 0: 1, 1: 2, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3 },
    troops: { 0: 20, 1: 2, 2: 12, 3: 12, 4: 12, 5: 12, 6: 12 },
    troopsToDeploy: 3,
    difficulty: 'hard',
    cards: 'Exponential',
    settings: {
      playerCards: new Map([
        [1, hand([S, S, H])],
        [2, rivalCards],
        [3, []],
      ]),
      cardsLastSetValue: new Map([[0, 30]]),
    },
  };
}

test('the planner cashes cards captured from an eliminated rival onto the attacking stack', () => {
  const walk = (rivalCards: Card[]) => {
    const { game, botId } = buildGame(captureBoard(rivalCards));
    const ctx = buildContext(
      game,
      botId,
      { difficulty: 'hard', personality: 'balanced' },
      null,
    );
    const state = snapshotState(ctx);
    walkStack(ctx, state, { startId: 0, route: [1], objectiveIndex: 0 }, []);
    return state;
  };
  const cashed = walk(hand([T, H], 200));
  const plain = walk([]);
  assert.equal(cashed.cards, 2);
  assert.equal(plain.cards, 3);
  assert.ok(cashed.troops.get(1)! >= plain.troops.get(1)! + 39);
});

test('a rival eliminated for its cards lets the bot cash mid-turn and keep conquering', () => {
  const originalRandom = Math.random;
  Math.random = mulberry32(3);
  try {
    const { game, dispatchFailures } = replayBotTurn(
      captureBoard(hand([T, H], 200)),
    );
    assert.equal(dispatchFailures, 0);
    assert.equal(game.cardSetsPlayed.get(0), 1);
    const conquered = [2, 3, 4, 5, 6].filter(
      (id) => game.territoryOwners.get(id) === 1,
    );
    assert.ok(conquered.length >= 2);
  } finally {
    Math.random = originalRandom;
  }
});
