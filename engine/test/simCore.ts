import { dispatchBotAction } from '../src/bots/dispatch';
import { TurnPlanCache, planBotTurn } from '../src/bots/planning/planBotTurn';
import { EngineCallbacks, setCallbacks } from '../src/callbacks';
import { clearTurnTimer, forceEndTurnImpl } from '../src/game/turns';
import { addBot } from '../src/lifecycle/bots';
import { createGame } from '../src/lifecycle/create';
import { updateSettings } from '../src/lifecycle/settings';
import { startGame } from '../src/lifecycle/start';
import { createBotPlayer, playersById } from '../src/session/players';
import { games } from '../src/session/store';
import {
  BotDifficulty,
  BotPersonality,
  Game,
  GameMap,
  Territory,
} from '../src/types';

const SIM_MAPS: Record<string, GameMap> = {};

function buildGridMap(name: string, cols: number, rows: number): GameMap {
  const territories: Territory[] = [];
  const bands = 6;
  const rowsPerBand = Math.ceil(rows / bands);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const id = r * cols + c;
      const neighbors: number[] = [];
      if (c > 0) neighbors.push(id - 1);
      if (c < cols - 1) neighbors.push(id + 1);
      if (r > 0) neighbors.push(id - cols);
      if (r < rows - 1) neighbors.push(id + cols);
      territories.push({
        id,
        continentId: Math.min(bands - 1, Math.floor(r / rowsPerBand)),
        x: c * 100,
        y: r * 100,
        neighbors,
      });
    }
  const continents =
    Math.min(bands - 1, Math.floor((rows - 1) / rowsPerBand)) + 1;
  return {
    name,
    territories,
    bonuses: Array.from({ length: continents }, () => 3),
  };
}

export const DIFFICULTIES: BotDifficulty[] = ['easy', 'medium', 'hard'];
const PERSONALITIES: BotPersonality[] = [
  'balanced',
  'taker',
  'breaker',
  'killer',
  'vengeful',
];

const SETTING_VARIANTS: Record<string, unknown>[] = [
  {},
  { fortification: 'Neighboring' },
  { fortification: 'Unrestricted' },
  { cards: 'Exponential' },
  { fogOfWar: 'on' },
  { entrenchments: 'on', cards: 'Linear' },
  { gameMode: 'Capitals' },
  { supplyLines: 'on' },
];

export interface TurnSample {
  difficulty: BotDifficulty;
  conquests: number;
  planMs: number;
  objectives: string;
}

export interface GameResult {
  winnerDifficulty: BotDifficulty | null;
  rounds: number;
  dispatchFailures: number;
  turns: TurnSample[];
  finalShare: { difficulty: BotDifficulty; share: number; rank: number }[];
}

export function setupSim(): void {
  setCallbacks(
    new Proxy({}, { get: () => () => undefined }) as EngineCallbacks,
  );
  SIM_MAPS.World = buildGridMap('World', 7, 6);
  SIM_MAPS.Europe = buildGridMap('Europe', 9, 9);
}

function difficultyOf(playerId: number): BotDifficulty {
  return playersById.get(playerId)!.botProfile!.difficulty;
}

function territoryCount(game: Game, playerId: number): number {
  let n = 0;
  for (const ownerId of game.territoryOwners.values())
    if (ownerId === playerId) n++;
  return n;
}

export function runGame(
  name: string,
  mapName: string,
  roster: BotDifficulty[],
  roundCap: number,
  settings: Record<string, unknown>,
): GameResult {
  const randomPersonality = () =>
    PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
  const host = createBotPlayer('Host', {
    difficulty: roster[0],
    personality: randomPersonality(),
  });
  createGame(host.id, { name }, true);
  const map = SIM_MAPS[mapName] ?? SIM_MAPS.World;
  const created = games.get(name)!;
  created.mapName = map.name;
  created.generatedMap = {
    territories: map.territories,
    bonuses: map.bonuses,
    imageSrc: '',
    seed: mapName,
    size: 'medium',
    type: 'terrain',
    fill: 'full',
  };
  updateSettings(host.id, { slots: roster.length, ...settings });
  for (let i = 1; i < roster.length; i++)
    addBot(host.id, roster[i], randomPersonality());
  startGame(host.id);

  const game = games.get(name)!;
  const planCache = new Map<string, TurnPlanCache>();
  const turns: TurnSample[] = [];
  let dispatchFailures = 0;

  while (game.state === 'playing' && game.roundNumber < roundCap) {
    const playerId = game.playerIds[game.turnPlayerIndex];
    const conquestsBefore = game.stats.get(playerId)?.territoriesConquered ?? 0;
    let planMs = 0;
    let objectives = '';
    let guard = 0;

    while (
      game.state === 'playing' &&
      game.playerIds[game.turnPlayerIndex] === playerId &&
      guard < 400
    ) {
      guard++;
      const beforeSig = `${game.turnPhase}:${game.troopsToDeploy}:${game.attackConquestMinTroops}:${game.territoryOwners.size}`;
      const isDeploy = game.turnPhase === 'deploy';
      const started = process.hrtime.bigint();
      const res = planBotTurn(
        game,
        playerId,
        playersById.get(playerId)!.botProfile!,
        planCache.get(name) ?? null,
      );
      const elapsed = Number(process.hrtime.bigint() - started) / 1e6;
      planCache.set(name, res.plan);
      if (isDeploy && planMs === 0) {
        planMs = elapsed;
        objectives = res.plan.objectives.map((o) => o.kind).join('+') || 'none';
      }

      if (process.env.SIM_DEBUG && elapsed > 400)
        process.stderr.write(
          `slow plan ${elapsed.toFixed(0)}ms phase=${game.turnPhase} objs=${res.plan.objectives.map((o) => o.kind).join('+')} owned=${game.territoryOwners.size}\n`,
        );

      for (const action of res.actions) {
        const outcome = dispatchBotAction(
          playerId,
          action.event,
          action.payload,
        );
        if (!outcome.ok) {
          dispatchFailures++;
          if (process.env.SIM_DEBUG)
            process.stderr.write(
              `dispatch fail ${action.event} phase=${game.turnPhase} err=${outcome.error}\n`,
            );
          dispatchBotAction(playerId, 'game:nextPhase', undefined);
          break;
        }
      }
      clearTurnTimer(name);

      const afterSig = `${game.turnPhase}:${game.troopsToDeploy}:${game.attackConquestMinTroops}:${game.territoryOwners.size}`;
      if (
        afterSig === beforeSig &&
        res.actions.length === 0 &&
        game.playerIds[game.turnPlayerIndex] === playerId
      ) {
        forceEndTurnImpl(game, true);
        clearTurnTimer(name);
      }
    }

    if (guard >= 400) {
      forceEndTurnImpl(game, true);
      clearTurnTimer(name);
    }

    const conquestsAfter = game.stats.get(playerId)?.territoriesConquered ?? 0;
    if (objectives !== '')
      turns.push({
        difficulty: difficultyOf(playerId),
        conquests: conquestsAfter - conquestsBefore,
        planMs,
        objectives,
      });
  }

  clearTurnTimer(name);
  let winnerDifficulty: BotDifficulty | null = null;
  if (game.winnerIds.length > 0) {
    winnerDifficulty = difficultyOf(game.winnerIds[0]);
  } else if (game.state === 'ended') {
    const alive = game.playerIds
      .map((id) => ({ id, n: territoryCount(game, id) }))
      .sort((a, b) => b.n - a.n);
    if (alive[0]) winnerDifficulty = difficultyOf(alive[0].id);
  }
  const rounds = game.roundNumber;
  const totalTerritories = game.territoryOwners.size || 1;
  const ranked = game.playerIds
    .map((id) => ({ id, n: territoryCount(game, id) }))
    .sort((a, b) => b.n - a.n);
  const finalShare = ranked.map((entry, index) => ({
    difficulty: difficultyOf(entry.id),
    share: entry.n / totalTerritories,
    rank: index,
  }));

  for (const id of [...game.playerIds]) {
    const player = playersById.get(id);
    if (player) player.gameName = null;
    playersById.delete(id);
  }
  games.delete(name);

  return { winnerDifficulty, rounds, dispatchFailures, turns, finalShare };
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

export function mean(values: number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((s, v) => s + v, 0) / values.length;
}

export interface MixedBatch {
  games: number;
  finished: number;
  dispatchFailures: number;
  avgRounds: number;
  wins: Record<string, number>;
  shareByDifficulty: Record<BotDifficulty, number>;
  rankByDifficulty: Record<BotDifficulty, number>;
  conquestsByDifficulty: Record<BotDifficulty, number>;
  planMsP50: number;
  planMsP95: number;
  planMsMax: number;
  objectiveMix: [string, number][];
  results: GameResult[];
}

export function runMixedBatch(
  gamesToRun: number,
  roundCap: number,
): MixedBatch {
  const results: GameResult[] = [];
  for (let i = 0; i < gamesToRun; i++) {
    const size = 3 + (i % 4);
    const roster: BotDifficulty[] = Array.from(
      { length: size },
      (_, k) => DIFFICULTIES[(i + k) % DIFFICULTIES.length],
    );
    results.push(
      runGame(
        `sim-${i}`,
        i % 2 === 0 ? 'World' : 'Europe',
        roster,
        roundCap,
        SETTING_VARIANTS[i % SETTING_VARIANTS.length],
      ),
    );
    playersById.clear();
  }

  const turns = results.flatMap((r) => r.turns);
  const wins: Record<string, number> = {};
  for (const r of results)
    if (r.winnerDifficulty)
      wins[r.winnerDifficulty] = (wins[r.winnerDifficulty] ?? 0) + 1;

  const shareByDifficulty = {} as Record<BotDifficulty, number>;
  const rankByDifficulty = {} as Record<BotDifficulty, number>;
  const conquestsByDifficulty = {} as Record<BotDifficulty, number>;
  for (const d of DIFFICULTIES) {
    const shares = results.flatMap((r) =>
      r.finalShare.filter((f) => f.difficulty === d),
    );
    shareByDifficulty[d] = mean(shares.map((s) => s.share));
    rankByDifficulty[d] = mean(shares.map((s) => s.rank));
    conquestsByDifficulty[d] = mean(
      turns.filter((t) => t.difficulty === d).map((t) => t.conquests),
    );
  }

  const objFreq = new Map<string, number>();
  for (const t of turns)
    objFreq.set(t.objectives, (objFreq.get(t.objectives) ?? 0) + 1);
  const planMs = turns.map((t) => t.planMs);

  return {
    games: results.length,
    finished: results.filter((r) => r.winnerDifficulty !== null).length,
    dispatchFailures: results.reduce((s, r) => s + r.dispatchFailures, 0),
    avgRounds: mean(results.map((r) => r.rounds)),
    wins,
    shareByDifficulty,
    rankByDifficulty,
    conquestsByDifficulty,
    planMsP50: percentile(planMs, 0.5),
    planMsP95: percentile(planMs, 0.95),
    planMsMax: Math.max(0, ...planMs),
    objectiveMix: [...objFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12),
    results,
  };
}

export function runSoloMatchup(
  test: BotDifficulty,
  field: BotDifficulty,
  soloGames: number,
  roundCap: number,
): { winPct: number; avgShare: number; decided: number } {
  let wins = 0;
  let decided = 0;
  const shares: number[] = [];
  for (let i = 0; i < soloGames; i++) {
    const roster: BotDifficulty[] = [test, field, field, field, field, field];
    const r = runGame(
      `solo-${test}-${field}-${i}`,
      i % 2 === 0 ? 'World' : 'Europe',
      roster,
      roundCap,
      {},
    );
    playersById.clear();
    const mine = r.finalShare.find((f) => f.difficulty === test);
    shares.push(mine ? mine.share : 0);
    if (r.winnerDifficulty === null) continue;
    decided++;
    if (r.winnerDifficulty === test) wins++;
  }
  return {
    winPct: decided ? (100 * wins) / decided : 0,
    avgShare: 100 * mean(shares),
    decided,
  };
}
