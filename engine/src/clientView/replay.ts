import { GameExport, ReplayEntry } from '../game/export';
import {
  Game,
  ReplayAnimation,
  ReplayPlayerState,
  ReplayTerritory,
} from '../types';
import { aliasesOf, aliasOf } from './aliases';
import { complete } from './complete';
import { viewAttackTarget } from './events';

type Replay = GameExport['replay'];
type ActionEntry = Extract<ReplayEntry, { kind: 'action' }>;

function viewAnimation(game: Game, a: ReplayAnimation): ReplayAnimation {
  switch (a.type) {
    case 'deploy':
      return complete<typeof a>({
        type: a.type,
        territoryId: a.territoryId,
        troops: a.troops,
        playerId: aliasOf(game, a.playerId),
      });
    case 'entrench':
      return complete<typeof a>({
        type: a.type,
        territoryId: a.territoryId,
        troops: a.troops,
        playerId: aliasOf(game, a.playerId),
      });
    case 'starve':
      return complete<typeof a>({
        type: a.type,
        territoryId: a.territoryId,
        troops: a.troops,
        playerId: aliasOf(game, a.playerId),
      });
    case 'fortify':
      return complete<typeof a>({
        type: a.type,
        fromTerritoryId: a.fromTerritoryId,
        toTerritoryId: a.toTerritoryId,
        troops: a.troops,
        troopsRefunded: a.troopsRefunded,
        playerId: aliasOf(game, a.playerId),
      });
    case 'attack':
      return complete<typeof a>({
        type: a.type,
        attackingTerritoryId: a.attackingTerritoryId,
        defendingTerritoryId: a.defendingTerritoryId,
        attackerId: aliasOf(game, a.attackerId),
        defenderId:
          a.defenderId === undefined ? undefined : aliasOf(game, a.defenderId),
        attackLosses: a.attackLosses,
        defenceLosses: a.defenceLosses,
        troopsRefunded: a.troopsRefunded,
      });
    case 'toxins':
      return complete<typeof a>({
        type: a.type,
        territoryId: a.territoryId,
        playerId: aliasOf(game, a.playerId),
      });
    case 'unlock':
      return complete<typeof a>({
        type: a.type,
        fromTerritoryId: a.fromTerritoryId,
        tileId: a.tileId,
        cost: a.cost,
        playerId: aliasOf(game, a.playerId),
      });
    case 'nuke':
      return complete<typeof a>({
        type: a.type,
        fromTerritoryId: a.fromTerritoryId,
        targetTerritoryId: a.targetTerritoryId,
        intercepted: a.intercepted,
        interceptFromTerritoryId: a.interceptFromTerritoryId,
        playerId: aliasOf(game, a.playerId),
      });
    case 'buyShips':
      return complete<typeof a>({
        type: a.type,
        sourceTerritoryId: a.sourceTerritoryId,
        seaTerritoryId: a.seaTerritoryId,
        ships: a.ships,
        fromPool: a.fromPool,
        playerId: aliasOf(game, a.playerId),
      });
    case 'sail':
      return complete<typeof a>({
        type: a.type,
        fromSeaTerritoryId: a.fromSeaTerritoryId,
        toSeaTerritoryId: a.toSeaTerritoryId,
        ships: a.ships,
        playerId: aliasOf(game, a.playerId),
      });
    case 'attackSea':
      return complete<typeof a>({
        type: a.type,
        seaTerritoryId: a.seaTerritoryId,
        attackerId: aliasOf(game, a.attackerId),
        defenderId: aliasOf(game, a.defenderId),
        attackLosses: a.attackLosses,
        defenceLosses: a.defenceLosses,
      });
  }
}

function viewPlayerState(game: Game, s: ReplayPlayerState): ReplayPlayerState {
  return complete<ReplayPlayerState>({
    playerId: aliasOf(game, s.playerId),
    eliminated: s.eliminated,
    surrendered: s.surrendered,
    killedPlayerIds: aliasesOf(game, s.killedPlayerIds),
    points: s.points,
    nukes: s.nukes,
    antiNukes: s.antiNukes,
    nukeProjects: s.nukeProjects,
  });
}

function viewAction(game: Game, e: ActionEntry): ActionEntry {
  return complete<ActionEntry>({
    kind: e.kind,
    roundNumber: e.roundNumber,
    turnPhase: e.turnPhase,
    playerId: aliasOf(game, e.playerId),
    mapDelta: e.mapDelta.map((d) =>
      complete<ActionEntry['mapDelta'][number]>({
        id: d.id,
        ownerId: aliasOf(game, d.ownerId),
        troops: d.troops,
        entrenchedTurns: d.entrenchedTurns,
      }),
    ),
    toxinTerritories: e.toxinTerritories,
    radiationTerritories: e.radiationTerritories,
    radiationUpcoming: e.radiationUpcoming,
    seaShipsDelta: e.seaShipsDelta.map((d) =>
      complete<ActionEntry['seaShipsDelta'][number]>({
        seaTerritoryId: d.seaTerritoryId,
        playerId: aliasOf(game, d.playerId),
        ships: d.ships,
      }),
    ),
    hands: e.hands.map((h) =>
      complete<ActionEntry['hands'][number]>({
        playerId: aliasOf(game, h.playerId),
        cards: h.cards,
      }),
    ),
    playerStates: e.playerStates.map((s) => viewPlayerState(game, s)),
    animation: viewAnimation(game, e.animation),
  });
}

function viewEntry(game: Game, e: ReplayEntry): ReplayEntry {
  switch (e.kind) {
    case 'action':
      return viewAction(game, e);
    case 'turn':
      return complete<typeof e>({
        kind: e.kind,
        roundNumber: e.roundNumber,
        playerId: aliasOf(game, e.playerId),
      });
    case 'chat':
      return complete<typeof e>({
        kind: e.kind,
        senderId: aliasOf(game, e.senderId),
        name: e.name,
        message: e.message,
      });
    case 'emoji':
      return complete<typeof e>({
        kind: e.kind,
        senderId: aliasOf(game, e.senderId),
        targetPlayerId:
          e.targetPlayerId === null ? null : aliasOf(game, e.targetPlayerId),
        emoji: e.emoji,
        attackTarget:
          e.attackTarget === null
            ? null
            : viewAttackTarget(game, e.attackTarget),
      });
  }
}

export function viewReplayFor(game: Game, replay: Replay): Replay {
  return complete<Replay>({
    initialTerritories: replay.initialTerritories.map((t) =>
      complete<ReplayTerritory>({
        id: t.id,
        ownerId: aliasOf(game, t.ownerId),
        troops: t.troops,
        entrenchedTurns: t.entrenchedTurns,
      }),
    ),
    initialRadiation: replay.initialRadiation,
    frames: replay.frames.map((e) => viewEntry(game, e)),
  });
}
