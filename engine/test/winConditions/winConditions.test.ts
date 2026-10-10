import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyPlayerStats } from '../../src/game/progression/stats';
import { ScenarioSpec, replayBotTurn } from '../testkit';

function line(...ids: number[]): [number, number][] {
  const edges: [number, number][] = [];
  for (let i = 0; i < ids.length - 1; i++) edges.push([ids[i], ids[i + 1]]);
  return edges;
}

function assertBotWins(spec: ScenarioSpec, botId = 1) {
  const replay = replayBotTurn(spec);
  assert.equal(
    replay.game.state,
    'ended',
    `game did not end; winnerIds: ${JSON.stringify(replay.game.winnerIds)}`,
  );
  assert.ok(
    replay.game.winnerIds.includes(botId),
    `bot did not win; winnerIds: ${JSON.stringify(replay.game.winnerIds)}`,
  );
}

test('Supremacy: the bot eliminates the last enemy tile', () => {
  assertBotWins({
    map: {
      continents: [[0, 1, 2, 3]],
      edges: line(0, 1, 2, 3),
      bonuses: [0],
    },
    players: [1, 2],
    owners: { 0: 1, 1: 1, 2: 1, 3: 2 },
    troops: { 2: 20, 3: 1 },
    troopsToDeploy: 6,
  });
});

test('Supremacy 3/4: the bot crosses the territory threshold', () => {
  assertBotWins({
    map: {
      continents: [[0, 1, 2, 3, 4, 5, 6, 7]],
      edges: line(0, 1, 2, 3, 4, 5, 6, 7),
      bonuses: [0],
    },
    players: [1, 2, 3],
    owners: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 2, 6: 3, 7: 3 },
    troops: { 4: 20, 5: 1 },
    troopsToDeploy: 6,
    settings: { gameMode: 'supremacy 3/4' },
  });
});

test('Supremacy 2/3: the bot crosses the territory threshold', () => {
  assertBotWins({
    map: {
      continents: [[0, 1, 2, 3, 4, 5, 6, 7, 8]],
      edges: line(0, 1, 2, 3, 4, 5, 6, 7, 8),
      bonuses: [0],
    },
    players: [1, 2, 3],
    owners: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 2, 6: 3, 7: 3, 8: 3 },
    troops: { 4: 20, 5: 1 },
    troopsToDeploy: 6,
    settings: { gameMode: 'supremacy 2/3' },
  });
});

test('Capitals: the bot sweeps every capital in one turn', () => {
  assertBotWins({
    map: {
      continents: [[0, 1, 2], [3], [4]],
      edges: [
        [0, 1],
        [0, 2],
      ],
      bonuses: [0, 0, 0],
    },
    players: [1, 2, 3],
    owners: { 0: 1, 1: 2, 2: 3, 3: 2, 4: 3 },
    troops: { 0: 30, 1: 1, 2: 1, 3: 1, 4: 1 },
    troopsToDeploy: 6,
    capitals: [0, 1, 2],
    settings: { gameMode: 'capitals' },
  });
});

test('Team Deathmatch: the bot wipes out the last enemy team', () => {
  assertBotWins({
    map: {
      continents: [[0, 1, 2]],
      edges: [
        [0, 1],
        [0, 2],
      ],
      bonuses: [0],
    },
    players: [1, 2, 3],
    teams: { 1: 0, 2: 0, 3: 1 },
    owners: { 0: 1, 1: 2, 2: 3 },
    troops: { 0: 20, 1: 1, 2: 1 },
    troopsToDeploy: 6,
  });
});

test('Continent: the bot completes the target continent', () => {
  assertBotWins({
    map: {
      continents: [
        [0, 1, 2],
        [3, 4],
      ],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
      ],
      bonuses: [0, 0],
    },
    players: [1, 2, 3],
    owners: { 0: 1, 1: 1, 2: 2, 3: 3, 4: 3 },
    troops: { 1: 20, 2: 1 },
    troopsToDeploy: 6,
    settings: { gameMode: 'continent', continentId: 0 },
  });
});

test('5-Round: the bot grabs the tile that puts it in the lead', () => {
  assertBotWins({
    map: {
      continents: [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]],
      edges: line(0, 1, 2, 3, 4, 5, 6, 7, 8, 9),
      bonuses: [0],
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
      7: 3,
      8: 3,
      9: 3,
    },
    troops: { 3: 20, 4: 1 },
    troopsToDeploy: 6,
    settings: { gameMode: '5-round', roundNumber: 5 },
  });
});

test('10-Round: the bot grabs the tile that puts it in the lead', () => {
  assertBotWins({
    map: {
      continents: [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]],
      edges: line(0, 1, 2, 3, 4, 5, 6, 7, 8, 9),
      bonuses: [0],
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
      7: 3,
      8: 3,
      9: 3,
    },
    troops: { 3: 20, 4: 1 },
    troopsToDeploy: 6,
    settings: { gameMode: '10-round', roundNumber: 10 },
  });
});

test('Assassin: eliminating the assigned target wins the game outright', () => {
  assertBotWins({
    map: {
      continents: [[0, 1, 2, 3, 4]],
      edges: line(0, 1, 2, 3, 4),
      bonuses: [0],
    },
    players: [1, 2, 3],
    owners: { 0: 1, 1: 1, 2: 2, 3: 3, 4: 3 },
    troops: { 1: 20, 2: 1 },
    troopsToDeploy: 6,
    settings: {
      gameMode: 'assassin',
      playerMissions: new Map([[1, { type: 'assassinate', targetId: 2 }]]),
    },
  });
});

test('Mission: the bot completes its assigned continent mission', () => {
  assertBotWins({
    map: {
      continents: [
        [0, 1, 2],
        [3, 4],
      ],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
      ],
      bonuses: [0, 0],
    },
    players: [1, 2, 3],
    owners: { 0: 1, 1: 1, 2: 2, 3: 3, 4: 3 },
    troops: { 1: 20, 2: 1 },
    troopsToDeploy: 6,
    settings: {
      gameMode: 'mission',
      playerMissions: new Map([[1, { type: 'continents', continentIds: [0] }]]),
    },
  });
});

test('Player Kills: the bot takes the only elimination available', () => {
  assertBotWins({
    map: {
      continents: [[0, 1, 2, 3]],
      edges: line(0, 1, 2, 3),
      bonuses: [0],
    },
    players: [1, 2],
    owners: { 0: 1, 1: 1, 2: 1, 3: 2 },
    troops: { 2: 20, 3: 1 },
    troopsToDeploy: 6,
    settings: { gameMode: 'player kills' },
  });
});

test('Troop Kills: the bot takes the only elimination available', () => {
  assertBotWins({
    map: {
      continents: [[0, 1, 2, 3]],
      edges: line(0, 1, 2, 3),
      bonuses: [0],
    },
    players: [1, 2],
    owners: { 0: 1, 1: 1, 2: 1, 3: 2 },
    troops: { 2: 20, 3: 1 },
    troopsToDeploy: 6,
    settings: {
      gameMode: 'troop kills',
      stats: new Map([
        [1, { ...emptyPlayerStats(), troopsKilled: 50 }],
        [2, emptyPlayerStats()],
      ]),
    },
  });
});

function pointsRace(
  gameMode: 'king of the hill' | 'empire',
  spec: Pick<ScenarioSpec, 'map' | 'owners' | 'troops'>,
  points: [number, number],
  maxPoints: number,
): ScenarioSpec {
  return {
    ...spec,
    players: [1, 2],
    troopsToDeploy: 3,
    settings: {
      gameMode,
      maxPoints,
      hillTerritoryIds: gameMode === 'king of the hill' ? [3] : [],
      points: new Map([
        [1, points[0]],
        [2, points[1]],
      ]),
    },
  };
}

const HILL_MAP = {
  map: {
    continents: [[0, 1, 2, 3, 4, 5]],
    edges: line(0, 1, 2, 3, 4, 5),
    bonuses: [0],
  },
  owners: { 0: 1, 1: 1, 2: 1, 3: 2, 4: 2, 5: 2 },
};

test('King of the Hill: the bot takes the hill before the leader scores the winning point', () => {
  const replay = replayBotTurn(
    pointsRace(
      'king of the hill',
      { ...HILL_MAP, troops: { 2: 20, 3: 3, 4: 30, 5: 30 } },
      [0, 19],
      20,
    ),
  );
  assert.equal(replay.game.territoryOwners.get(3), 1, 'hill not taken');
  assert.equal(replay.game.state, 'playing');
  assert.equal(replay.game.points.get(2), 19);
});

test('Empire: the bot cuts the leader below the winning total', () => {
  const replay = replayBotTurn(
    pointsRace(
      'empire',
      {
        map: {
          continents: [[0, 1, 2, 3, 4]],
          edges: line(0, 1, 2, 3, 4),
          bonuses: [0],
        },
        owners: { 0: 1, 1: 1, 2: 1, 3: 2, 4: 2 },
        troops: { 2: 20, 3: 1, 4: 30 },
      },
      [0, 498],
      500,
    ),
  );
  assert.equal(replay.game.territoryOwners.get(3), 1, 'leader tile not taken');
  assert.equal(replay.game.state, 'playing');
  assert.equal(replay.game.points.get(2), 499);
});
