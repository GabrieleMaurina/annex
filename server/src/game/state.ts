import { Game, Player } from '../types';

function toSummaries(ids: number[], playersById: Map<number, Player>) {
  return ids
    .map((id) => playersById.get(id))
    .filter((player): player is Player => !!player)
    .map((player) => ({ id: player.id, name: player.name }));
}

function territoryStats(game: Game) {
  const stats = new Map<
    number,
    { territoryCount: number; troopCount: number }
  >();
  for (const [territoryId, ownerId] of game.territoryOwners) {
    const entry = stats.get(ownerId) ?? { territoryCount: 0, troopCount: 0 };
    entry.territoryCount++;
    entry.troopCount += game.territoryTroops.get(territoryId) ?? 0;
    stats.set(ownerId, entry);
  }
  return stats;
}

export function gameSummary(game: Game) {
  return {
    name: game.name,
    mapName: game.mapName,
    playerCount: game.playerIds.length,
    slots: game.slots,
    state: game.state,
    spectatorCount: game.spectatorIds.length,
  };
}

export function gameState(game: Game, playersById: Map<number, Player>) {
  const stats = territoryStats(game);
  return {
    name: game.name,
    mapName: game.mapName,
    slots: game.slots,
    hostId: game.hostId,
    state: game.state,
    gameMode: game.gameMode,
    diceRandomness: game.diceRandomness,
    defenceDice: game.defenceDice,
    cards: game.cards,
    turnDuration: game.turnDuration,
    turnNumber: game.turnNumber,
    turnPlayerIndex: game.turnPlayerIndex,
    turnPhase: game.turnPhase,
    players: toSummaries(game.playerIds, playersById).map((player) => ({
      ...player,
      team: game.playerTeams.get(player.id) ?? 0,
      color: game.playerColors.get(player.id) ?? 0,
      territoryCount: stats.get(player.id)?.territoryCount ?? 0,
      troopCount: stats.get(player.id)?.troopCount ?? 0,
      connected: playersById.get(player.id)?.connected ?? false,
      surrendered: game.surrenderedIds.has(player.id),
    })),
    spectators: toSummaries(game.spectatorIds, playersById),
    bannedPlayers: toSummaries([...game.bannedIds], playersById),
    territories: [...game.territoryOwners.entries()].map(([id, ownerId]) => ({
      id,
      ownerId,
      troops: game.territoryTroops.get(id) ?? 0,
    })),
  };
}
