import type { TutorialScenario } from 'engine';
import type { GameState } from '../lib/types';
import {
  linksTutorialMap,
  navalTutorialMap,
  type TutorialGameMap,
} from './tutorialMap';

export interface Tutorial {
  id: string;
  title: string;
  summary: string;
  instruction: string;
  highlight: number | 'cards';
  settings: Record<string, unknown>;
  scenario: TutorialScenario;
  map?: () => TutorialGameMap;
  blockedEvents?: string[];
  allowedEvents?: string[];
  isComplete: (event: string, game: GameState, selfId: number) => boolean;
}

const SUPREMACY = { continents: 'off' };
const BONUSES = { continents: '1x' };
const EAST_CONTINENT = [1, 2, 5, 6];
const CAPITALS = { continents: 'off', gameMode: 'capitals' };
const NAVAL_SEA = 5;
const FOG = { continents: 'off', fogOfWar: 'on', gameMode: 'capitals' };
const HIDDEN_CAPITAL = 2;
const LINKS = { continents: 'off', cards: 'off' };
const TIMED_LINK_TARGET = 3;

function territory(id: number, seat: number, troops: number, capital = false) {
  return { id, seat, troops, capital };
}

function movedIn(event: string, game: GameState): boolean {
  return (
    (event === 'game:attack' ||
      event === 'game:attackMove' ||
      event === 'game:quickAttack') &&
    game.attackConquestMinTroops === null
  );
}

function deployedAll(event: string, game: GameState): boolean {
  return event === 'game:deploy' && game.troopsToDeploy === 0;
}

function owns(game: GameState, selfId: number, territoryIds: number[]) {
  return territoryIds.every((id) =>
    game.territories.some((t) => t.id === id && t.ownerId === selfId),
  );
}

export const TUTORIALS: Tutorial[] = [
  {
    id: 'deploy',
    title: 'Deploying troops',
    summary: 'Reinforce your territories at the start of your turn.',
    instruction:
      'Click one of your territories, choose how many troops to send and press Deploy. Place all 3 troops to finish.',
    highlight: 0,
    settings: SUPREMACY,
    scenario: {
      territories: [
        territory(0, 0, 3),
        territory(4, 0, 2),
        territory(1, 1, 2),
        territory(3, 1, 2),
        territory(5, 1, 1),
        territory(2, 2, 3),
        territory(6, 2, 2),
      ],
      phase: 'deploy',
      troopsToDeploy: 3,
      cards: [],
    },
    isComplete: deployedAll,
  },
  {
    id: 'conquer',
    title: 'Conquering a territory',
    summary: 'Attack an enemy territory and take it over.',
    instruction:
      'Click your territory with 4 troops, then click the enemy territory next to it with 1 troop and attack. Once it falls, choose how many troops to move in.',
    highlight: 3,
    settings: SUPREMACY,
    scenario: {
      territories: [
        territory(3, 0, 4),
        territory(4, 0, 1),
        territory(0, 1, 1),
        territory(1, 1, 3),
        territory(5, 1, 2),
        territory(2, 2, 2),
        territory(6, 2, 3),
      ],
      phase: 'attack',
      troopsToDeploy: 0,
      cards: [],
    },
    isComplete: (event, game, selfId) =>
      movedIn(event, game) && owns(game, selfId, [0]),
  },
  {
    id: 'fortify',
    title: 'Fortifying troops',
    summary: 'Move troops between your own territories to end your turn.',
    instruction:
      'Click your territory with 6 troops, then click another of your territories and move troops there.',
    highlight: 4,
    settings: SUPREMACY,
    scenario: {
      territories: [
        territory(4, 0, 6),
        territory(5, 0, 1),
        territory(6, 0, 1),
        territory(0, 1, 2),
        territory(1, 1, 3),
        territory(3, 1, 2),
        territory(2, 2, 4),
      ],
      phase: 'fortify',
      troopsToDeploy: 0,
      cards: [],
    },
    isComplete: (event) =>
      event === 'game:fortify' || event === 'game:quickFortify',
  },
  {
    id: 'cards',
    title: 'Playing a set',
    summary: 'Trade three cards for extra troops.',
    instruction:
      'Open your cards with the cards button on the left, select the set and play it, then deploy all the troops it gives you.',
    highlight: 'cards',
    settings: SUPREMACY,
    scenario: {
      territories: [
        territory(0, 0, 2),
        territory(4, 0, 3),
        territory(1, 1, 2),
        territory(3, 1, 1),
        territory(5, 1, 2),
        territory(2, 2, 2),
        territory(6, 2, 3),
      ],
      phase: 'deploy',
      troopsToDeploy: 0,
      cards: [
        [
          { territoryId: 0, symbol: 'soldier' },
          { territoryId: 4, symbol: 'humvee' },
          { territoryId: 2, symbol: 'tank' },
        ],
      ],
    },
    isComplete: deployedAll,
  },
  {
    id: 'bonus',
    title: 'Taking a bonus',
    summary: 'Complete a continent to earn extra troops every turn.',
    instruction:
      'The eastern continent is worth 3 extra troops per turn. Conquer its last 2 enemy territories and move in to claim it.',
    highlight: 5,
    settings: BONUSES,
    scenario: {
      territories: [
        territory(5, 0, 7),
        territory(6, 0, 3),
        territory(4, 0, 1),
        territory(1, 1, 1),
        territory(0, 1, 2),
        territory(2, 2, 1),
        territory(3, 2, 2),
      ],
      phase: 'attack',
      troopsToDeploy: 0,
      cards: [],
    },
    isComplete: (event, game, selfId) =>
      movedIn(event, game) && owns(game, selfId, EAST_CONTINENT),
  },
  {
    id: 'eliminate',
    title: 'Eliminating a player',
    summary: 'Knock a rival out of the game and take their cards.',
    instruction:
      'One rival is down to a single territory. Attack it from your territory with 5 troops and move in to knock them out. You take their cards, and holding 5 cards you must play a set right away. Then deploy the troops it gives you.',
    highlight: 3,
    settings: SUPREMACY,
    scenario: {
      territories: [
        territory(3, 0, 5),
        territory(4, 0, 1),
        territory(0, 1, 2),
        territory(1, 2, 3),
        territory(2, 2, 2),
        territory(5, 2, 2),
        territory(6, 2, 3),
      ],
      phase: 'attack',
      troopsToDeploy: 0,
      cards: [
        [
          { territoryId: 3, symbol: 'soldier' },
          { territoryId: 4, symbol: 'soldier' },
        ],
        [
          { territoryId: 0, symbol: 'soldier' },
          { territoryId: 1, symbol: 'humvee' },
          { territoryId: 2, symbol: 'tank' },
        ],
      ],
    },
    isComplete: (event, game) =>
      deployedAll(event, game) && game.players.some((p) => p.eliminated),
  },
  {
    id: 'capital',
    title: 'Placing a capital',
    summary: 'Choose the territory that will be your capital.',
    instruction:
      'Click one of your territories to make it your capital. It gets extra troops right away.',
    highlight: 0,
    settings: CAPITALS,
    scenario: {
      territories: [
        territory(0, 0, 2),
        territory(1, 0, 2),
        territory(4, 0, 2),
        territory(3, 1, 2),
        territory(5, 1, 2),
        territory(2, 2, 2),
        territory(6, 2, 2),
      ],
      phase: 'capital',
      troopsToDeploy: 0,
      cards: [],
    },
    isComplete: (event) => event === 'game:selectCapital',
  },
  {
    id: 'capital-conquest',
    title: 'Conquering a capital',
    summary: 'Capture an enemy capital.',
    instruction:
      'Click your territory with 18 troops and attack the enemy capital next to it. Capitals defend with an extra die, so expect heavy losses. Then move troops in to hold it.',
    highlight: 3,
    settings: CAPITALS,
    scenario: {
      territories: [
        territory(3, 0, 18),
        territory(4, 0, 1, true),
        territory(0, 1, 8, true),
        territory(1, 1, 2),
        territory(5, 1, 2),
        territory(2, 2, 3, true),
        territory(6, 2, 2),
      ],
      phase: 'attack',
      troopsToDeploy: 0,
      cards: [],
    },
    isComplete: (event, game, selfId) =>
      movedIn(event, game) && owns(game, selfId, [0]),
  },
  {
    id: 'fog',
    title: 'Fog of war',
    summary: 'Push through the fog to find a weak enemy capital.',
    instruction:
      'Fog of war hides everything except your territories and their neighbours. An enemy capital lies somewhere in the fog with almost no defenders. Attack from your 14 troops, keep moving in to reveal more of the map, then capture the capital.',
    highlight: 3,
    settings: FOG,
    scenario: {
      territories: [
        territory(3, 0, 14, true),
        territory(0, 1, 1),
        territory(1, 1, 2),
        territory(2, 1, 1, true),
        territory(4, 2, 1),
        territory(5, 2, 2),
        territory(6, 2, 3, true),
      ],
      phase: 'attack',
      troopsToDeploy: 0,
      cards: [],
    },
    isComplete: (event, game, selfId) =>
      movedIn(event, game) && owns(game, selfId, [HIDDEN_CAPITAL]),
  },
  {
    id: 'naval',
    title: 'Naval combat',
    summary: 'Buy ships, win a sea battle and invade an island.',
    instruction:
      'Click the sea to spend your 6 troops on 2 ships. Then attack the enemy ships in the sea. With more ships than the enemy there, attack their island across the water and move in.',
    highlight: NAVAL_SEA,
    settings: SUPREMACY,
    map: navalTutorialMap,
    blockedEvents: ['game:deploy'],
    scenario: {
      territories: [
        territory(0, 0, 2),
        territory(1, 0, 2),
        territory(2, 0, 8),
        territory(3, 1, 2),
        territory(4, 1, 2),
      ],
      phase: 'deploy',
      troopsToDeploy: 6,
      cards: [],
      ships: [{ sea: NAVAL_SEA, seat: 1, ships: 2 }],
    },
    isComplete: (event, game, selfId) =>
      (movedIn(event, game) ||
        event === 'game:attackSea' ||
        event === 'game:quickAttackSea') &&
      (owns(game, selfId, [3]) || owns(game, selfId, [4])) &&
      game.seas.some((sea) =>
        sea.ships.every((s) => s.playerId === selfId || s.ships < 2),
      ),
  },
  {
    id: 'links',
    title: 'Special links',
    summary: 'Cross the water with one-way, switched and timed links.',
    instruction:
      'Arrows work one way, so attack from your 14 troops along the arrow pointing away from you and move most of your troops in. Select that territory and click the switch beside it: flipping costs 2 troops and opens the link it controls. Attack across and move in. The hourglass link opens in 2 rounds: use Next Phase to end your turn, deploy, and repeat, watching its countdown. Once it opens, attack across it and move in.',
    highlight: 0,
    settings: LINKS,
    map: linksTutorialMap,
    allowedEvents: ['game:flipSwitch', 'game:nextPhase'],
    scenario: {
      territories: [
        territory(0, 0, 14),
        territory(1, 1, 1),
        territory(2, 1, 1),
        territory(3, 1, 2),
        territory(4, 1, 3),
      ],
      phase: 'attack',
      troopsToDeploy: 0,
      cards: [],
    },
    isComplete: (event, game, selfId) =>
      movedIn(event, game) && owns(game, selfId, [TIMED_LINK_TARGET]),
  },
];

export function tutorialFromPath(pathname: string): Tutorial | null {
  const match = pathname.match(/^\/tutorials\/([^/]+)$/);
  return TUTORIALS.find((t) => t.id === match?.[1]) ?? null;
}

export function nextTutorial(tutorial: Tutorial): Tutorial | null {
  return TUTORIALS[TUTORIALS.indexOf(tutorial) + 1] ?? null;
}
