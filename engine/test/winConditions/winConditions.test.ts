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
    settings: { gameMode: 'Supremacy 3/4' },
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
    settings: { gameMode: 'Supremacy 2/3' },
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
    settings: { gameMode: 'Capitals' },
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
    settings: { gameMode: 'Continent', continentId: 0 },
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
    settings: { gameMode: '5-Round', roundNumber: 5 },
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
    settings: { gameMode: '10-Round', roundNumber: 10 },
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
      gameMode: 'Assassin',
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
      gameMode: 'Mission',
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
    settings: { gameMode: 'Player Kills' },
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
      gameMode: 'Troop Kills',
      stats: new Map([
        [1, { ...emptyPlayerStats(), troopsKilled: 50 }],
        [2, emptyPlayerStats()],
      ]),
    },
  });
});
