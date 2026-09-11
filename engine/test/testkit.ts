import { dispatchBotAction } from '../src/bots/dispatch';
import { buildContext } from '../src/bots/planning/context';
import { buildTurnPlan } from '../src/bots/planning/enumerate';
import { TurnPlanCache, planBotTurn } from '../src/bots/planning/planBotTurn';
import { TurnPlan } from '../src/bots/planning/turnPlan';
import { EngineCallbacks, setCallbacks } from '../src/callbacks';
import { pairKey } from '../src/game/alliances';
import { emptyPlayerStats } from '../src/game/progression/stats';
import { clearTurnTimer } from '../src/game/turns';
import { loadMaps } from '../src/maps/maps';
import { playersById } from '../src/session/players';
import { games } from '../src/session/store';
import {
  BotDifficulty,
  BotPersonality,
  BotProfile,
  Game,
  GameMap,
} from '../src/types';

setCallbacks(new Proxy({}, { get: () => () => undefined }) as EngineCallbacks);

export interface MapSpec {
  name?: string;
  continents: number[][];
  edges: [number, number][];
  bonuses: number[];
}

export interface ScenarioSpec {
  map: MapSpec;
  botId?: number;
  players: number[];
  owners: Record<number, number>;
  troops: Record<number, number>;
  troopsToDeploy?: number;
  difficulty?: BotDifficulty;
  personality?: BotPersonality;
  cards?: Game['cards'];
  botCards?: number;
  capitals?: number[];
  entrenched?: number[];
  teams?: Record<number, number>;
  allies?: [number, number][];
  portals?: number[];
  grudges?: {
    attacker: number;
    defenceLosses?: number;
    conquered?: boolean;
    count?: number;
  }[];
  settings?: Partial<Game>;
}

export function buildMap(spec: MapSpec): GameMap {
  const continentById = new Map<number, number>();
  spec.continents.forEach((ids, continentId) => {
    for (const id of ids) continentById.set(id, continentId);
  });
  const neighbors = new Map<number, Set<number>>();
  for (const id of continentById.keys()) neighbors.set(id, new Set());
  for (const [a, b] of spec.edges) {
    neighbors.get(a)!.add(b);
    neighbors.get(b)!.add(a);
  }
  const territories = [...continentById.keys()]
    .sort((a, b) => a - b)
    .map((id) => ({
      id,
      continentId: continentById.get(id)!,
      x: id * 10,
      y: (continentById.get(id) ?? 0) * 10,
      neighbors: [...(neighbors.get(id) ?? [])].sort((a, b) => a - b),
    }));
  return { name: spec.name ?? 'scenario', territories, bonuses: spec.bonuses };
}

function baseGame(name: string): Game {
  return {
    name,
    mapName: name,
    generatedMap: null,
    playerMap: null,
    slots: 6,
    hostId: 1,
    originalHostId: 1,
    offline: true,
    state: 'playing',
    createdAt: 0,
    startedAt: 0,
    endedAt: null,
    alliances: 'off',
    allianceIds: new Set(),
    allianceRequests: new Map(),
    allianceCooldowns: new Map(),
    allianceInitiators: new Map(),
    blitz: 'Balanced',
    bounties: 'off',
    cards: 'Constant',
    defenceDice: 2,
    disconnectBotDifficulty: 'random',
    disconnectBotPersonality: 'random',
    entrenchments: 'off',
    fogOfWar: 'off',
    fortification: 'Connected',
    gameMode: 'Supremacy',
    continentId: null,
    placement: 'Random',
    portals: 'off',
    portalTerritoryIds: [],
    portalsEnabled: false,
    radiations: 'off',
    radiationTerritoryIds: new Set(),
    radiationUpcomingTerritoryIds: new Set(),
    nukes: 'off',
    nukeProjects: new Map(),
    arsenal: new Map(),
    antiNukeTerritoryIds: new Set(),
    starvation: 'off',
    supplyLines: 'off',
    toxins: 'off',
    turnDuration: 120,
    roundTroops: 'off',
    roundNumber: 3,
    turnPlayerIndex: 0,
    turnPhase: 'deploy',
    troopsToDeploy: 0,
    remainingSpecialPhases: [],
    placementTroopPools: new Map(),
    turnStartedAt: 0,
    paused: false,
    pausedAt: null,
    humansAbandonedAt: null,
    selectedTerritoryId: null,
    fortifyStartTerritoryId: null,
    fortifyEndTerritoryId: null,
    attackStartTerritoryId: null,
    attackEndTerritoryId: null,
    attackConquestMinTroops: null,
    playerIds: [],
    spectatorIds: [],
    playerTeams: new Map(),
    playerColors: new Map(),
    bannedIds: new Set(),
    territoryOwners: new Map(),
    territoryTroops: new Map(),
    territoryEntrenchment: new Map(),
    territoryToxins: new Map(),
    capitalTerritoryIds: new Set(),
    playerMissions: new Map(),
    hostPriority: [],
    substituteFor: new Map(),
    lobbyDeparted: new Map(),
    surrenderedIds: new Set(),
    winnerIds: [],
    deck: [],
    playerCards: new Map(),
    conqueredThisTurn: false,
    deployCardMandate: false,
    cardSetsPlayed: new Map(),
    cardsLastSetValue: new Map(),
    stats: new Map(),
    deathOrder: [],
    teamDeathOrder: [],
    finalRanking: [],
    replayInitial: [],
    replayInitialRadiation: [],
    replayFrames: [],
    replayTurnMarkers: [],
    replayChat: [],
    replayEmoji: [],
    replayLog: [],
    logs: new Map(),
  };
}

let mapCounter = 0;

export function buildGame(spec: ScenarioSpec): {
  game: Game;
  botId: number;
} {
  const name = `scenario-${mapCounter++}`;
  const map = buildMap({ ...spec.map, name });
  loadMaps([map]);

  const game = baseGame(name);
  game.cards = spec.cards ?? 'Constant';
  game.playerIds = [...spec.players];
  const botId = spec.botId ?? spec.players[0];
  game.turnPlayerIndex = game.playerIds.indexOf(botId);
  for (const id of spec.players) {
    game.playerTeams.set(id, spec.teams?.[id] ?? id);
    game.playerCards.set(id, []);
    game.logs.set(id, []);
    game.stats.set(id, emptyPlayerStats());
  }
  if (spec.teams) game.gameMode = 'Team Deathmatch';
  for (const [a, b] of spec.allies ?? []) {
    game.alliances = 'on';
    game.allianceIds.add(pairKey(a, b));
  }
  if (spec.portals && spec.portals.length >= 2) {
    game.portals = 'static';
    game.portalTerritoryIds = [...spec.portals];
    game.portalsEnabled = true;
  }
  game.playerCards.set(
    botId,
    Array.from({ length: spec.botCards ?? 0 }, () => ({
      territoryId: null,
      symbol: 'soldier' as const,
    })),
  );
  for (const [tid, owner] of Object.entries(spec.owners))
    game.territoryOwners.set(Number(tid), owner);
  for (const t of map.territories)
    game.territoryTroops.set(t.id, spec.troops[t.id] ?? 1);
  game.troopsToDeploy = spec.troopsToDeploy ?? 10;
  for (const id of spec.capitals ?? []) game.capitalTerritoryIds.add(id);
  for (const id of spec.entrenched ?? []) game.territoryEntrenchment.set(id, 3);

  const botLog = game.logs.get(botId)!;
  for (const grudge of spec.grudges ?? []) {
    for (let i = 0; i < (grudge.count ?? 1); i++)
      botLog.push({
        type: 'game:attacked',
        payload: {
          attackerId: grudge.attacker,
          defenderId: botId,
          defenceLosses: grudge.defenceLosses ?? 4,
          conquered: grudge.conquered ?? true,
        },
      });
  }

  Object.assign(game, spec.settings ?? {});

  return { game, botId };
}

export function planScenario(
  spec: ScenarioSpec,
  deterministic = true,
): TurnPlan {
  const originalRandom = Math.random;
  if (deterministic) Math.random = () => 0.5;
  try {
    const { game, botId } = buildGame(spec);
    const ctx = buildContext(game, botId, {
      difficulty: spec.difficulty ?? 'hard',
      personality: spec.personality ?? 'balanced',
    });
    return buildTurnPlan(ctx, game.troopsToDeploy);
  } finally {
    Math.random = originalRandom;
  }
}

export function kinds(plan: TurnPlan): string[] {
  return plan.objectives.map((o) => o.kind);
}

export function primaryKind(plan: TurnPlan): string | undefined {
  return plan.objectives[0]?.kind;
}

function installGame(game: Game, players: number[], profile: BotProfile): void {
  games.set(game.name, game);
  for (const id of players)
    playersById.set(id, {
      id,
      name: `p${id}`,
      gameName: game.name,
      connected: true,
      isBot: true,
      botProfile: profile,
    });
}

function uninstallGame(game: Game, players: number[]): void {
  clearTurnTimer(game.name);
  games.delete(game.name);
  for (const id of players) playersById.delete(id);
}

export interface TurnReplay {
  steps: number;
  dispatchFailures: number;
  terminated: boolean;
}

export function replayBotTurn(spec: ScenarioSpec): TurnReplay {
  const originalRandom = Math.random;
  const { game, botId } = buildGame(spec);
  const profile: BotProfile = {
    difficulty: spec.difficulty ?? 'hard',
    personality: spec.personality ?? 'balanced',
  };
  installGame(game, spec.players, profile);
  let cache: TurnPlanCache | null = null;
  let steps = 0;
  let dispatchFailures = 0;
  try {
    while (
      game.state === 'playing' &&
      game.playerIds[game.turnPlayerIndex] === botId &&
      steps < 300
    ) {
      steps++;
      const res = planBotTurn(game, botId, profile, cache);
      cache = res.plan;
      for (const action of res.actions) {
        const outcome = dispatchBotAction(botId, action.event, action.payload);
        if (!outcome.ok) {
          dispatchFailures++;
          dispatchBotAction(botId, 'game:nextPhase', undefined);
          break;
        }
      }
      clearTurnTimer(game.name);
    }
  } finally {
    Math.random = originalRandom;
    uninstallGame(game, spec.players);
  }
  return {
    steps,
    dispatchFailures,
    terminated:
      game.state !== 'playing' ||
      game.playerIds[game.turnPlayerIndex] !== botId,
  };
}
