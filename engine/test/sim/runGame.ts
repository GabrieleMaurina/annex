import { dispatchBotAction } from '../../src/bots/dispatch';
import {
  TurnPlanCache,
  planBotTurn,
} from '../../src/bots/planning/planBotTurn';
import { EngineCallbacks, setCallbacks } from '../../src/callbacks';
import { computeFinalRanking } from '../../src/game/progression/stats';
import { clearTurnTimer, forceEndTurnImpl } from '../../src/game/turns';
import { addBot } from '../../src/lifecycle/bots';
import { createGame } from '../../src/lifecycle/create';
import { updateSettings } from '../../src/lifecycle/settings';
import { startGame } from '../../src/lifecycle/start';
import { GenerateMapParams } from '../../src/mapgen/core/params';
import { generateMap } from '../../src/mapgen/generate';
import { createBotPlayer, playersById } from '../../src/session/players';
import { games } from '../../src/session/store';
import {
  BoardSnapshot,
  RoundSample,
  samplePlayers,
  snapshotBoard,
  totalConquests,
} from './boardState';
import {
  BotIdentity,
  mulberry32,
  randomGameSettings,
  randomMapParams,
  randomRoster,
} from './randomize';

let callbacksInstalled = false;
function ensureCallbacks(): void {
  if (callbacksInstalled) return;
  callbacksInstalled = true;
  setCallbacks(
    new Proxy({}, { get: () => () => undefined }) as EngineCallbacks,
  );
}

const ROSTER_SIZE = 6;
const MAX_TURN_STEPS = 400;
const MAX_REPEATED_FAILURE = 5;
const GAME_DEADLINE_MS = 300_000;
const SAMPLE_EVERY_ROUNDS = 25;

export interface TurnLogEntry {
  round: number;
  playerId: number;
  personality: string;
  difficulty: string;
  phase: string;
  objectives: string;
  planMs: number;
  actions: { event: string; ok: boolean; error?: string }[];
}

export interface PlanMsSample {
  identity: BotIdentity;
  ms: number;
}

export interface RankedBot {
  identity: BotIdentity;
  rank: number;
  points: number;
}

export interface SimGameResult {
  mapParams: GenerateMapParams;
  settings: Record<string, unknown>;
  settingsApplied: boolean;
  roster: BotIdentity[];
  rounds: number;
  truncated: boolean;
  timedOut: boolean;
  dispatchFailures: number;
  playerTeams: Record<string, number>;
  lastConquestRound: number;
  finalBoard: BoardSnapshot | null;
  samples: RoundSample[];
  planMsSamples: PlanMsSample[];
  points: RankedBot[];
  turns: TurnLogEntry[];
}

export function runSimGame(
  gameNumber: number,
  roundCap: number,
): SimGameResult {
  ensureCallbacks();
  const rng = mulberry32(Math.floor(Math.random() * 0xffffffff));
  const name = `sim-${gameNumber}`;
  const roster = randomRoster(rng, ROSTER_SIZE);

  const host = createBotPlayer('Bot 1', roster[0]);
  createGame(host.id, { name }, true);
  const game = games.get(name)!;

  const mapParams = randomMapParams(rng, `${name}-${Math.floor(rng() * 1e9)}`);
  const generated = generateMap(mapParams);
  game.mapName = generated.name;
  game.generatedMap = {
    territories: generated.territories,
    seaTerritories: generated.seaTerritories,
    bonuses: generated.bonuses,
    imageSrc: generated.imageSrc,
    seed: mapParams.seed,
    size: mapParams.size,
    type: mapParams.type,
    fill: mapParams.fill,
    seas: mapParams.seas,
  };

  const { settings, teams } = randomGameSettings(rng, ROSTER_SIZE);
  const settingsApplied = updateSettings(host.id, {
    slots: ROSTER_SIZE,
    ...settings,
  }).ok;

  const botIds: number[] = [host.id];
  for (let i = 1; i < ROSTER_SIZE; i++) {
    const identity = roster[i];
    addBot(host.id, identity.difficulty, identity.personality);
    botIds.push(game.playerIds[game.playerIds.length - 1]);
  }
  if (teams)
    for (let i = 0; i < botIds.length; i++)
      game.playerTeams.set(botIds[i], teams[i]);

  const identityById = new Map<number, BotIdentity>();
  botIds.forEach((id, i) => identityById.set(id, roster[i]));

  startGame(host.id);

  let cache: TurnPlanCache | null = null;
  const turns: TurnLogEntry[] = [];
  const planMsSamples: PlanMsSample[] = [];
  let dispatchFailures = 0;
  const gameStartedAt = Date.now();
  let timedOut = false;
  const samples: RoundSample[] = [];
  let nextSampleRound = SAMPLE_EVERY_ROUNDS;
  let conquestTotal = 0;
  let lastConquestRound = 0;

  while (game.state === 'playing' && game.roundNumber < roundCap) {
    if (Date.now() - gameStartedAt > GAME_DEADLINE_MS) {
      timedOut = true;
      break;
    }
    if (game.roundNumber >= nextSampleRound) {
      samples.push({
        round: game.roundNumber,
        players: samplePlayers(game, botIds),
      });
      nextSampleRound += SAMPLE_EVERY_ROUNDS;
    }
    const playerId = game.playerIds[game.turnPlayerIndex];
    const identity = identityById.get(playerId)!;
    const phaseAtStart = game.turnPhase;
    const actions: TurnLogEntry['actions'] = [];
    let planMs = 0;
    let objectives = '';
    let guard = 0;
    let lastFailureKey: string | null = null;
    let repeatedFailures = 0;

    while (
      game.state === 'playing' &&
      game.playerIds[game.turnPlayerIndex] === playerId &&
      guard < MAX_TURN_STEPS &&
      repeatedFailures < MAX_REPEATED_FAILURE
    ) {
      guard++;
      const beforeSig = `${game.turnPhase}:${game.troopsToDeploy}:${game.attackConquestMinTroops}:${game.territoryOwners.size}`;
      const isDeploy = game.turnPhase === 'deploy';
      const started = process.hrtime.bigint();
      const res = planBotTurn(game, playerId, identity, cache);
      const elapsed = Number(process.hrtime.bigint() - started) / 1e6;
      cache = res.plan;
      if (isDeploy && planMs === 0) {
        planMs = elapsed;
        objectives = res.plan.objectives.map((o) => o.kind).join('+') || 'none';
      }

      for (const action of res.actions) {
        const outcome = dispatchBotAction(
          playerId,
          action.event,
          action.payload,
        );
        actions.push({
          event: action.event,
          ok: outcome.ok,
          error: outcome.ok ? undefined : outcome.error,
        });
        if (!outcome.ok) {
          dispatchFailures++;
          const failureKey = `${action.event}:${outcome.error}`;
          repeatedFailures =
            failureKey === lastFailureKey ? repeatedFailures + 1 : 1;
          lastFailureKey = failureKey;
          dispatchBotAction(playerId, 'game:nextPhase', undefined);
          break;
        }
        lastFailureKey = null;
        repeatedFailures = 0;
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

    if (guard >= MAX_TURN_STEPS || repeatedFailures >= MAX_REPEATED_FAILURE) {
      forceEndTurnImpl(game, true);
      clearTurnTimer(name);
    }

    const conquests = totalConquests(game, botIds);
    if (conquests > conquestTotal) {
      conquestTotal = conquests;
      lastConquestRound = game.roundNumber;
    }

    if (planMs > 0) planMsSamples.push({ identity, ms: planMs });
    if (actions.length > 0 || planMs > 0)
      turns.push({
        round: game.roundNumber,
        playerId,
        personality: identity.personality,
        difficulty: identity.difficulty,
        phase: phaseAtStart,
        objectives,
        planMs,
        actions,
      });
  }

  clearTurnTimer(name);
  const truncated = game.state === 'playing';
  const finalBoard = truncated ? snapshotBoard(game) : null;
  const rankedIds = [...computeFinalRanking(game)];
  const seen = new Set<number>();
  const orderedIds = [...rankedIds, ...botIds].filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const points: RankedBot[] = orderedIds.map((id, rank) => ({
    identity: identityById.get(id)!,
    rank,
    points: orderedIds.length - rank,
  }));

  for (const id of botIds) playersById.delete(id);
  games.delete(name);

  return {
    mapParams,
    settings,
    settingsApplied,
    roster,
    rounds: game.roundNumber,
    truncated,
    timedOut,
    dispatchFailures,
    playerTeams: Object.fromEntries(game.playerTeams),
    lastConquestRound,
    finalBoard,
    samples,
    planMsSamples,
    points,
    turns,
  };
}
