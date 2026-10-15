import { usesAliases } from '../game/anonymous';
import { GameResponse } from '../session/context';
import { playersById } from '../session/players';
import { games } from '../session/store';
import {
  AttackProbabilitiesResponse,
  AttackResultResponse,
} from '../territory/attack';
import { ReplayResponse } from '../territory/replay';
import {
  AttackSeaProbabilitiesResponse,
  AttackSeaResultResponse,
} from '../territory/sea/attackSea';
import { Game } from '../types';
import { realOf } from './aliases';
import { complete } from './complete';
import { EVENT_VIEWS, EventKey, EventPayload, viewServerLog } from './events';
import { viewReplayFor } from './replay';
import { viewGameStateFor } from './state';

export type ViewableResponse =
  | GameResponse
  | AttackProbabilitiesResponse
  | AttackResultResponse
  | AttackSeaProbabilitiesResponse
  | AttackSeaResultResponse;

type OkResponse = Extract<ViewableResponse, { ok: true }>;

function viewOkResponse(
  game: Game,
  viewerId: number,
  r: OkResponse,
): OkResponse {
  if ('attackerDice' in r)
    return complete<typeof r>({
      ok: r.ok,
      game: viewGameStateFor(game, viewerId, r.game),
      blitzWinProbabilities: r.blitzWinProbabilities,
      blitzOutcomes: r.blitzOutcomes,
      attackerDice: r.attackerDice,
      defenderDice: r.defenderDice,
    });
  if ('blitzWinProbabilities' in r)
    return complete<typeof r>({
      ok: r.ok,
      game: viewGameStateFor(game, viewerId, r.game),
      blitzWinProbabilities: r.blitzWinProbabilities,
      blitzOutcomes: r.blitzOutcomes,
    });
  return complete<typeof r>({
    ok: r.ok,
    game: viewGameStateFor(game, viewerId, r.game),
  });
}

function actorGame(actorId: number): Game | undefined {
  const gameName = playersById.get(actorId)?.gameName;
  return gameName ? games.get(gameName) : undefined;
}

export function viewEvent<K extends EventKey>(
  gameName: string,
  viewerId: number,
  key: K,
  payload: EventPayload<K>,
): EventPayload<K> | null {
  const game = games.get(gameName);
  if (!game) return null;
  if (!usesAliases(game)) return payload;
  return EVENT_VIEWS[key](game, viewerId, payload);
}

export function viewResponse<R extends ViewableResponse>(
  viewerId: number,
  response: R,
): R {
  if (!response.ok) return response;
  const game = games.get(response.game.name);
  if (!game || !usesAliases(game)) return response;
  return viewOkResponse(game, viewerId, response) as R;
}

export function viewReplay(
  viewerId: number,
  response: ReplayResponse,
): ReplayResponse {
  const game = actorGame(viewerId);
  if (!game || !usesAliases(game) || !response.ok) return response;
  return complete<typeof response>({
    ok: response.ok,
    replay: viewReplayFor(game, response.replay),
    serverLog: viewServerLog(game, viewerId, response.serverLog),
  });
}

export function fromClient(actorId: number, id: unknown): unknown {
  const game = actorGame(actorId);
  if (!game || !usesAliases(game)) return id;
  return realOf(game, id);
}
