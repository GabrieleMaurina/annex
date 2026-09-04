import { playersById } from '../session/players';
import { games } from '../session/store';
import {
  Card,
  EmojiAttackTarget,
  EmojiValue,
  Game,
  GameLogEvent,
  ReplayAnimation,
  ReplayFrame,
  ReplayTerritory,
  TurnPhase,
} from '../types';
import { isEliminated, territoryStats } from './state';
import { SERVER_VIEW_ID } from './world/fog';

export interface ReplayHandExport {
  playerId: number;
  cards: Card[];
}

export interface ReplayTerritoryDelta {
  id: number;
  ownerId: number;
  troops: number;
  entrenchedTurns: number;
}

export type ReplayEntry =
  | {
      kind: 'action';
      roundNumber: number;
      turnPhase: TurnPhase;
      playerId: number;
      mapDelta: ReplayTerritoryDelta[];
      toxinTerritories: {
        id: number;
        permanent: boolean;
        roundsRemaining: number;
      }[];
      radiationTerritories: number[];
      radiationUpcoming: number[];
      hands: ReplayHandExport[];
      animation: ReplayAnimation;
    }
  | { kind: 'turn'; roundNumber: number; playerId: number }
  | { kind: 'chat'; senderId: number; name: string; message: string }
  | {
      kind: 'emoji';
      senderId: number;
      targetPlayerId: number | null;
      emoji: EmojiValue;
      attackTarget: EmojiAttackTarget | null;
    };

export interface GameResultExport {
  playerId: number;
  rank: number;
  team: number;
  eliminated: boolean;
  surrendered: boolean;
  playersKilled: number[];
  troopsGained: number;
  troopsKilled: number;
  troopsLost: number;
  territoriesConquered: number;
  territoriesLost: number;
  capitalsConquered: number;
  capitalsLost: number;
  cardsGained: number;
  turnsPlayed: number;
  setsPlayed: number;
}

export interface GameExport {
  name: string;
  mapName: string;
  mapGeneration: { seed: string; size: string; water: string } | null;
  originalHostId: number;
  startedAt: number;
  endedAt: number;
  settings: {
    gameMode: string;
    continentId: number | null;
    slots: number;
    blitz: string;
    defenceDice: number;
    cards: string;
    placement: string;
    fortification: string;
    entrenchments: string;
    toxins: string;
    portals: string;
    radiations: string;
    starvation: string;
    roundTroops: string;
    bounties: string;
    supplyLines: string;
    fogOfWar: string;
    alliances: string;
    turnDuration: number;
    disconnectBotDifficulty: string;
    disconnectBotPersonality: string;
  };
  players: {
    playerId: number;
    name: string;
    isBot: boolean;
    botDifficulty: string | null;
    botPersonality: string | null;
    team: number;
    color: number;
    turnOrder: number;
    rank: number;
    won: boolean;
  }[];
  winnerIds: number[];
  roundNumber: number;
  playerCount: number;
  capitalTerritoryIds: number[];
  results: GameResultExport[];
  serverLog: GameLogEvent[];
  replay: {
    initialTerritories: ReplayTerritory[];
    initialRadiation: number[];
    frames: ReplayEntry[];
  };
}

function territoryDelta(
  previous: ReplayTerritory[],
  current: ReplayTerritory[],
): ReplayTerritoryDelta[] {
  const before = new Map(previous.map((t) => [t.id, t]));
  const delta: ReplayTerritoryDelta[] = [];
  for (const t of current) {
    const prev = before.get(t.id);
    if (
      !prev ||
      prev.ownerId !== t.ownerId ||
      prev.troops !== t.troops ||
      prev.entrenchedTurns !== t.entrenchedTurns
    )
      delta.push({
        id: t.id,
        ownerId: t.ownerId,
        troops: t.troops,
        entrenchedTurns: t.entrenchedTurns,
      });
  }
  return delta;
}

function actionEntry(
  frame: ReplayFrame,
  previous: ReplayTerritory[],
): ReplayEntry {
  return {
    kind: 'action',
    roundNumber: frame.roundNumber,
    turnPhase: frame.turnPhase,
    playerId: frame.playerId,
    mapDelta: territoryDelta(previous, frame.territories),
    toxinTerritories: frame.toxinTerritories,
    radiationTerritories: frame.radiationTerritories,
    radiationUpcoming: frame.radiationUpcoming,
    hands: frame.hands,
    animation: frame.animation,
  };
}

function groupByFrame<T extends { afterFrame: number }>(
  items: T[],
): Map<number, T[]> {
  const byFrame = new Map<number, T[]>();
  for (const item of items) {
    const bucket = byFrame.get(item.afterFrame);
    if (bucket) bucket.push(item);
    else byFrame.set(item.afterFrame, [item]);
  }
  return byFrame;
}

function buildFrames(game: Game): ReplayEntry[] {
  const entries: ReplayEntry[] = [];
  const turnsByFrame = groupByFrame(game.replayTurnMarkers);
  const chatByFrame = groupByFrame(game.replayChat);
  const emojiByFrame = groupByFrame(game.replayEmoji);

  for (let k = 0; k <= game.replayFrames.length; k++) {
    for (const marker of turnsByFrame.get(k) ?? [])
      entries.push({
        kind: 'turn',
        roundNumber: marker.roundNumber,
        playerId: marker.playerId,
      });
    for (const entry of chatByFrame.get(k) ?? [])
      entries.push({
        kind: 'chat',
        senderId: entry.senderId,
        name: entry.name,
        message: entry.message,
      });
    for (const entry of emojiByFrame.get(k) ?? [])
      entries.push({
        kind: 'emoji',
        senderId: entry.senderId,
        targetPlayerId: entry.targetPlayerId,
        emoji: entry.emoji,
        attackTarget: entry.attackTarget,
      });
    if (k < game.replayFrames.length) {
      const frame = game.replayFrames[k];
      const previous =
        k === 0 ? game.replayInitial : game.replayFrames[k - 1].territories;
      entries.push(actionEntry(frame, previous));
    }
  }
  return entries;
}

function buildResults(game: Game): GameResultExport[] {
  const stats = territoryStats(game);
  return game.finalRanking.map((playerId, rank) => {
    const s = game.stats.get(playerId);
    const territoryCount = stats.get(playerId)?.territoryCount ?? 0;
    return {
      playerId,
      rank,
      team: game.playerTeams.get(playerId) ?? 0,
      eliminated: isEliminated(game, territoryCount),
      surrendered: game.surrenderedIds.has(playerId),
      playersKilled: s?.playersKilled ?? [],
      troopsGained: s?.troopsGained ?? 0,
      troopsKilled: s?.troopsKilled ?? 0,
      troopsLost: s?.troopsLost ?? 0,
      territoriesConquered: s?.territoriesConquered ?? 0,
      territoriesLost: s?.territoriesLost ?? 0,
      capitalsConquered: s?.capitalsConquered ?? 0,
      capitalsLost: s?.capitalsLost ?? 0,
      cardsGained: s?.cardsGained ?? 0,
      turnsPlayed: s?.turnsPlayed ?? 0,
      setsPlayed: s?.setsPlayed ?? 0,
    };
  });
}

export function exportGame(gameName: string): GameExport | null {
  const game = games.get(gameName);
  if (!game || game.state !== 'ended' || game.roundNumber < 1) return null;
  if (game.startedAt === null || game.endedAt === null) return null;

  const results = buildResults(game);
  const rankByPlayerId = new Map(results.map((r) => [r.playerId, r.rank]));
  const winners = new Set(game.winnerIds);

  return {
    name: game.name,
    mapName: game.mapName,
    mapGeneration: game.generatedMap
      ? {
          seed: game.generatedMap.seed,
          size: game.generatedMap.size,
          water: game.generatedMap.water,
        }
      : null,
    settings: {
      gameMode: game.gameMode,
      continentId: game.continentId,
      slots: game.slots,
      blitz: game.blitz,
      defenceDice: game.defenceDice,
      cards: game.cards,
      placement: game.placement,
      fortification: game.fortification,
      entrenchments: game.entrenchments,
      toxins: game.toxins,
      portals: game.portals,
      radiations: game.radiations,
      starvation: game.starvation,
      roundTroops: game.roundTroops,
      bounties: game.bounties,
      supplyLines: game.supplyLines,
      fogOfWar: game.fogOfWar,
      alliances: game.alliances,
      turnDuration: game.turnDuration,
      disconnectBotDifficulty: game.disconnectBotDifficulty,
      disconnectBotPersonality: game.disconnectBotPersonality,
    },
    players: game.playerIds.map((playerId, turnOrder) => {
      const member = playersById.get(playerId);
      return {
        playerId,
        name: member?.name ?? '',
        isBot: !!member?.isBot,
        botDifficulty: member?.botProfile?.difficulty ?? null,
        botPersonality: member?.botProfile?.personality ?? null,
        team: game.playerTeams.get(playerId) ?? 0,
        color: game.playerColors.get(playerId) ?? 0,
        turnOrder,
        rank: rankByPlayerId.get(playerId) ?? game.playerIds.length - 1,
        won: winners.has(playerId),
      };
    }),
    winnerIds: game.winnerIds,
    roundNumber: game.roundNumber,
    playerCount: game.playerIds.length,
    originalHostId: game.originalHostId,
    startedAt: game.startedAt,
    endedAt: game.endedAt,
    capitalTerritoryIds: [...game.capitalTerritoryIds],
    results,
    serverLog: game.logs.get(SERVER_VIEW_ID) ?? [],
    replay: {
      initialTerritories: game.replayInitial,
      initialRadiation: game.replayInitialRadiation,
      frames: buildFrames(game),
    },
  };
}
