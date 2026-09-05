import type { GameSummary } from 'engine';

export type LiveGameSummary = Omit<GameSummary, 'playerIds' | 'settings'> & {
  hasPassword: boolean;
};

export type LiveGameRow = GameSummary & {
  hasPassword: boolean;
  playerUserIds: string[];
};

export interface LiveGamesQuery {
  page: number;
  pageSize: number;
  playerIds?: string[];
  name?: string;
  mode?: string;
  mapName?: string;
  generatedMap?: boolean;
  mapGenerationSize?: string;
  mapGenerationWater?: string;
  playersMin?: number;
  playersMax?: number;
  minRounds?: number;
  maxRounds?: number;
  settings: Record<string, string | number>;
  phase?: 'lobby' | 'playing' | 'ended';
  hasPassword?: boolean;
  sort: 'newest' | 'players' | 'rounds' | 'name';
  sortDir: 'asc' | 'desc';
}

export interface LiveGamesPage {
  games: LiveGameSummary[];
  total: number;
  page: number;
  pageSize: number;
}

function matches(game: LiveGameRow, query: LiveGamesQuery): boolean {
  if (query.name && !game.name.toLowerCase().includes(query.name.toLowerCase()))
    return false;
  if (query.mode && game.settings.gameMode !== query.mode) return false;
  if (query.mapName && game.mapName !== query.mapName) return false;
  if (query.generatedMap && game.mapGeneration === null) return false;
  if (
    query.mapGenerationSize &&
    game.mapGeneration?.size !== query.mapGenerationSize
  )
    return false;
  if (
    query.mapGenerationWater &&
    game.mapGeneration?.water !== query.mapGenerationWater
  )
    return false;
  if (query.playersMin !== undefined && game.playerCount < query.playersMin)
    return false;
  if (query.playersMax !== undefined && game.playerCount > query.playersMax)
    return false;
  if (query.minRounds !== undefined && game.roundNumber < query.minRounds)
    return false;
  if (query.maxRounds !== undefined && game.roundNumber > query.maxRounds)
    return false;
  if (query.phase && game.state !== query.phase) return false;
  if (query.hasPassword !== undefined && game.hasPassword !== query.hasPassword)
    return false;
  if (query.playerIds) {
    for (const userId of query.playerIds)
      if (!game.playerUserIds.includes(userId)) return false;
  }
  const settings = game.settings as Record<string, unknown>;
  for (const [key, value] of Object.entries(query.settings))
    if (String(settings[key]) !== String(value)) return false;
  return true;
}

function cmpName(a: LiveGameRow, b: LiveGameRow): number {
  return a.name.localeCompare(b.name);
}

function compare(
  a: LiveGameRow,
  b: LiveGameRow,
  sort: LiveGamesQuery['sort'],
): number {
  if (sort === 'players') return a.playerCount - b.playerCount || cmpName(a, b);
  if (sort === 'rounds') return a.roundNumber - b.roundNumber || cmpName(a, b);
  if (sort === 'name') return cmpName(a, b);
  return a.createdAt - b.createdAt || cmpName(a, b);
}

function toSummary(row: LiveGameRow): LiveGameSummary {
  return {
    name: row.name,
    mapName: row.mapName,
    mapGeneration: row.mapGeneration,
    hostName: row.hostName,
    playerCount: row.playerCount,
    slots: row.slots,
    state: row.state,
    spectatorCount: row.spectatorCount,
    createdAt: row.createdAt,
    roundNumber: row.roundNumber,
    hasPassword: row.hasPassword,
  };
}

export function filterLiveGames(
  all: LiveGameRow[],
  query: LiveGamesQuery,
): LiveGamesPage {
  const matched = all.filter((game) => matches(game, query));
  const dir = query.sortDir === 'asc' ? 1 : -1;
  matched.sort((a, b) => dir * compare(a, b, query.sort));
  const start = (query.page - 1) * query.pageSize;
  return {
    games: matched.slice(start, start + query.pageSize).map(toSummary),
    total: matched.length,
    page: query.page,
    pageSize: query.pageSize,
  };
}
