import { CallbackPayload, EngineCallbacks } from '../callbacks';
import { gameResultsStats } from '../game/state';
import { LogPayloads } from '../game/world/fog';
import {
  EmojiAttackTarget,
  Game,
  GameLogEvent,
  Mission,
  ReplayLogEntry,
} from '../types';
import { aliasesOf, aliasOf } from './aliases';
import { complete } from './complete';
import { viewGameStateFor } from './state';

export type EventKey = Exclude<
  keyof EngineCallbacks,
  | 'onHomeGames'
  | 'onGameEnded'
  | 'onKicked'
  | 'onRoomChanged'
  | 'onCapitalPlacementStarted'
>;

export type EventPayload<K extends EventKey> = CallbackPayload<K>;

type EventViews = {
  [K in EventKey]: (
    game: Game,
    viewerId: number,
    p: EventPayload<K>,
  ) => EventPayload<K>;
};

type ResultStat = ReturnType<typeof gameResultsStats>[number];

function viewMission(game: Game, mission: Mission): Mission {
  switch (mission.type) {
    case 'territories':
      return complete<typeof mission>({
        type: mission.type,
        fraction: mission.fraction,
        minTroopsPerTerritory: mission.minTroopsPerTerritory,
      });
    case 'continents':
      return complete<typeof mission>({
        type: mission.type,
        continentIds: mission.continentIds,
      });
    case 'assassinate':
      return complete<typeof mission>({
        type: mission.type,
        targetId: aliasOf(game, mission.targetId),
      });
  }
}

export function viewAttackTarget(
  game: Game,
  target: EmojiAttackTarget,
): EmojiAttackTarget {
  switch (target.type) {
    case 'player':
      return complete<typeof target>({
        type: target.type,
        playerId: aliasOf(game, target.playerId),
      });
    case 'territory':
      return complete<typeof target>({
        type: target.type,
        territoryId: target.territoryId,
      });
  }
}

function viewResultStat(game: Game, s: ResultStat): ResultStat {
  return complete<ResultStat>({
    id: aliasOf(game, s.id),
    troopsGained: s.troopsGained,
    troopsKilled: s.troopsKilled,
    troopsLost: s.troopsLost,
    territoriesConquered: s.territoriesConquered,
    territoriesLost: s.territoriesLost,
    capitalsConquered: s.capitalsConquered,
    capitalsLost: s.capitalsLost,
    cardsGained: s.cardsGained,
    turnsPlayed: s.turnsPlayed,
    setsPlayed: s.setsPlayed,
  });
}

export const EVENT_VIEWS: EventViews = {
  onGameState: (game, viewerId, p) => viewGameStateFor(game, viewerId, p),
  onCards: (_game, _viewerId, p) =>
    complete<EventPayload<'onCards'>>({ cards: p.cards }),
  onMission: (game, _viewerId, p) =>
    complete<EventPayload<'onMission'>>({
      mission: viewMission(game, p.mission),
    }),
  onLogs: (game, viewerId, p) =>
    complete<EventPayload<'onLogs'>>({
      entries: viewLogEvents(game, viewerId, p.entries),
    }),
  onResults: (game, _viewerId, p) =>
    complete<EventPayload<'onResults'>>({
      stats: p.stats.map((s) => viewResultStat(game, s)),
    }),
  onCardSetPlayed: (game, _viewerId, p) =>
    complete<EventPayload<'onCardSetPlayed'>>({
      playerId: aliasOf(game, p.playerId),
      troops: p.troops,
      cards: p.cards,
      territoryBonusCount: p.territoryBonusCount,
    }),
  onChatMessage: (game, _viewerId, p) =>
    complete<EventPayload<'onChatMessage'>>({
      id: aliasOf(game, p.id),
      name: p.name,
      message: p.message,
    }),
  onEmojiSent: (game, _viewerId, p) =>
    complete<EventPayload<'onEmojiSent'>>({
      senderId: aliasOf(game, p.senderId),
      targetPlayerId:
        p.targetPlayerId === undefined
          ? undefined
          : aliasOf(game, p.targetPlayerId),
      emoji: p.emoji,
      attackTarget:
        p.attackTarget === undefined
          ? undefined
          : viewAttackTarget(game, p.attackTarget),
    }),
  onAllianceRequested: (game, _viewerId, p) =>
    complete<EventPayload<'onAllianceRequested'>>({
      fromId: aliasOf(game, p.fromId),
    }),
  onAllianceFormed: (game, _viewerId, p) =>
    complete<EventPayload<'onAllianceFormed'>>({
      withId: aliasOf(game, p.withId),
    }),
  onAllianceDeclined: (game, _viewerId, p) =>
    complete<EventPayload<'onAllianceDeclined'>>({
      withId: aliasOf(game, p.withId),
    }),
  onAllianceTerminated: (game, _viewerId, p) =>
    complete<EventPayload<'onAllianceTerminated'>>({
      withId: aliasOf(game, p.withId),
    }),
  onTerritoryClaimed: (game, _viewerId, p) =>
    complete<EventPayload<'onTerritoryClaimed'>>({
      territoryId: p.territoryId,
      playerId: aliasOf(game, p.playerId),
    }),
  onTurnStarted: (game, _viewerId, p) =>
    complete<EventPayload<'onTurnStarted'>>({
      playerId: aliasOf(game, p.playerId),
      roundNumber: p.roundNumber,
      troopsFromTerritories: p.troopsFromTerritories,
      troopsFromBonuses: p.troopsFromBonuses,
      troopsFromCapitals: p.troopsFromCapitals,
      troopsFromRoundTroops: p.troopsFromRoundTroops,
      troopsFromBounties: p.troopsFromBounties,
      troopsWithheld: p.troopsWithheld,
    }),
  onDeployed: (game, _viewerId, p) =>
    complete<EventPayload<'onDeployed'>>({
      territoryId: p.territoryId,
      troops: p.troops,
      playerId: aliasOf(game, p.playerId),
    }),
  onDeployedMany: (game, _viewerId, p) =>
    complete<EventPayload<'onDeployedMany'>>({
      deposits: p.deposits,
      playerId: aliasOf(game, p.playerId),
    }),
  onFortified: (game, _viewerId, p) =>
    complete<EventPayload<'onFortified'>>({
      territoryId: p.territoryId,
      fromTerritoryId: p.fromTerritoryId,
      playerId: aliasOf(game, p.playerId),
      path: p.path,
      troopsRemoved: p.troopsRemoved,
      troopsAdded: p.troopsAdded,
    }),
  onEntrenched: (game, _viewerId, p) =>
    complete<EventPayload<'onEntrenched'>>({
      territoryId: p.territoryId,
      troops: p.troops,
      turnsRemaining: p.turnsRemaining,
      playerId: aliasOf(game, p.playerId),
    }),
  onToxined: (game, _viewerId, p) =>
    complete<EventPayload<'onToxined'>>({
      territoryId: p.territoryId,
      permanent: p.permanent,
      roundsRemaining: p.roundsRemaining,
      playerId: aliasOf(game, p.playerId),
    }),
  onToxinExpired: (_game, _viewerId, p) =>
    complete<EventPayload<'onToxinExpired'>>({
      territoryIds: p.territoryIds,
    }),
  onRadiationUpcoming: (_game, _viewerId, p) =>
    complete<EventPayload<'onRadiationUpcoming'>>({
      territoryIds: p.territoryIds,
    }),
  onRadiationChanged: (game, _viewerId, p) =>
    complete<EventPayload<'onRadiationChanged'>>({
      territoryIds: p.territoryIds,
      eliminatedPlayerIds: aliasesOf(game, p.eliminatedPlayerIds),
      newlyRadiatedIds: p.newlyRadiatedIds,
    }),
  onStarved: (_game, _viewerId, p) =>
    complete<EventPayload<'onStarved'>>({ losses: p.losses }),
  onNukeLaunched: (game, _viewerId, p) =>
    complete<EventPayload<'onNukeLaunched'>>({
      playerId: aliasOf(game, p.playerId),
      fromTerritoryId: p.fromTerritoryId,
      targetTerritoryId: p.targetTerritoryId,
      intercepted: p.intercepted,
      interceptFromTerritoryId: p.interceptFromTerritoryId,
      eliminatedPlayerIds: aliasesOf(game, p.eliminatedPlayerIds),
    }),
  onAttacked: (game, _viewerId, p) =>
    complete<EventPayload<'onAttacked'>>({
      attackingTerritoryId: p.attackingTerritoryId,
      defendingTerritoryId: p.defendingTerritoryId,
      attackerId: aliasOf(game, p.attackerId),
      type: p.type,
      path: p.path,
      attackingTroops: p.attackingTroops,
      attackLosses: p.attackLosses,
      defenderId:
        p.defenderId === undefined ? undefined : aliasOf(game, p.defenderId),
      defendingTroops: p.defendingTroops,
      defenceLosses: p.defenceLosses,
      conquered: p.conquered,
    }),
  onTankFired: (_game, _viewerId, p) =>
    complete<EventPayload<'onTankFired'>>({
      type: p.type,
      hasDefender: p.hasDefender,
    }),
  onAttackMoved: (_game, _viewerId, p) =>
    complete<EventPayload<'onAttackMoved'>>({
      territoryId: p.territoryId,
      fromTerritoryId: p.fromTerritoryId,
      path: p.path,
      troopsRemoved: p.troopsRemoved,
      troopsAdded: p.troopsAdded,
    }),
  onShipsBought: (game, _viewerId, p) =>
    complete<EventPayload<'onShipsBought'>>({
      sourceTerritoryId: p.sourceTerritoryId,
      seaTerritoryId: p.seaTerritoryId,
      ships: p.ships,
      fromPool: p.fromPool,
      playerId: aliasOf(game, p.playerId),
    }),
  onSailed: (game, _viewerId, p) =>
    complete<EventPayload<'onSailed'>>({
      seaTerritoryId: p.seaTerritoryId,
      fromSeaTerritoryId: p.fromSeaTerritoryId,
      playerId: aliasOf(game, p.playerId),
      path: p.path,
      shipsRemoved: p.shipsRemoved,
      shipsAdded: p.shipsAdded,
    }),
  onSeaAttacked: (game, _viewerId, p) =>
    complete<EventPayload<'onSeaAttacked'>>({
      seaTerritoryId: p.seaTerritoryId,
      attackerId: aliasOf(game, p.attackerId),
      defenderId: aliasOf(game, p.defenderId),
      type: p.type,
      attackingShips: p.attackingShips,
      attackLosses: p.attackLosses,
      defendingShips: p.defendingShips,
      defenceLosses: p.defenceLosses,
    }),
  onSelected: (_game, _viewerId, p) =>
    complete<EventPayload<'onSelected'>>({ territoryId: p.territoryId }),
  onMapGenerated: (_game, _viewerId, p) =>
    complete<EventPayload<'onMapGenerated'>>({
      name: p.name,
      territories: p.territories,
      seaTerritories: p.seaTerritories,
      bonuses: p.bonuses,
      wraps: p.wraps,
      imageSrc: p.imageSrc,
    }),
};

type AllianceLog = LogPayloads['game:allianceFormed'];

function viewAllianceLog(game: Game, p: AllianceLog): AllianceLog {
  return complete<AllianceLog>({
    withId: aliasOf(game, p.withId),
    playerId: p.playerId === undefined ? undefined : aliasOf(game, p.playerId),
  });
}

type LogViews = {
  [K in keyof LogPayloads]: (
    game: Game,
    viewerId: number,
    p: LogPayloads[K],
  ) => LogPayloads[K];
};

const LOG_VIEWS: LogViews = {
  'game:deployed': EVENT_VIEWS.onDeployed,
  'game:deployedMany': EVENT_VIEWS.onDeployedMany,
  'game:fortified': EVENT_VIEWS.onFortified,
  'game:attackMoved': EVENT_VIEWS.onAttackMoved,
  'game:attacked': EVENT_VIEWS.onAttacked,
  'game:entrenched': EVENT_VIEWS.onEntrenched,
  'game:toxined': EVENT_VIEWS.onToxined,
  'game:radiationChanged': EVENT_VIEWS.onRadiationChanged,
  'game:nukeLaunched': EVENT_VIEWS.onNukeLaunched,
  'game:cardSetPlayed': EVENT_VIEWS.onCardSetPlayed,
  'game:turnStarted': EVENT_VIEWS.onTurnStarted,
  'game:territoryClaimed': EVENT_VIEWS.onTerritoryClaimed,
  'game:allianceFormed': (game, _viewerId, p) => viewAllianceLog(game, p),
  'game:allianceTerminated': (game, _viewerId, p) => viewAllianceLog(game, p),
  'game:capitalPlacementStarted': () =>
    complete<LogPayloads['game:capitalPlacementStarted']>({}),
};

function viewLogEntry(
  game: Game,
  viewerId: number,
  entry: GameLogEvent,
): GameLogEvent {
  const type = entry.type as keyof LogPayloads;
  return complete<GameLogEvent>({
    type,
    payload: LOG_VIEWS[type](game, viewerId, entry.payload as never),
  });
}

function viewLogEvents(
  game: Game,
  viewerId: number,
  entries: GameLogEvent[],
): GameLogEvent[] {
  return entries.map((entry) => viewLogEntry(game, viewerId, entry));
}

export function viewServerLog(
  game: Game,
  viewerId: number,
  entries: ReplayLogEntry[],
): ReplayLogEntry[] {
  return entries.map((entry) => ({
    afterFrame: entry.afterFrame,
    ...viewLogEntry(game, viewerId, entry),
  }));
}
