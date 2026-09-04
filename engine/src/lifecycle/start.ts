import {
  assignTerritories,
  assignTerritoryOwners,
  compactTeams,
  interleaveTeams,
  ownsAnyTerritory,
  shuffle,
  teamCount,
} from '../game/mechanics';
import { buildCardDeck } from '../game/progression/cards';
import { assignMissions } from '../game/progression/missions';
import { emptyPlayerStats } from '../game/progression/stats';
import { initializeRadiation } from '../game/radiation/radiation';
import { snapshotTerritories } from '../game/replay';
import { beginNextSpecialPhase } from '../game/turns';
import { initializeContinent } from '../game/world/continent';
import { initializePortals } from '../game/world/portals';
import { getGameMap } from '../maps/maps';
import { GameResponse } from '../session/context';
import { playersById } from '../session/players';
import {
  broadcastHomeGames,
  broadcastMissions,
  games,
  respondGameState,
  sendPlayerCards,
} from '../session/store';

export function startGame(playerId: number): GameResponse {
  const player = playersById.get(playerId);
  if (!player || !player.gameName) return { ok: false, error: 'not in a game' };

  const game = games.get(player.gameName);
  if (!game) return { ok: false, error: 'game not found' };
  if (game.hostId !== player.id) return { ok: false, error: 'not the host' };
  if (game.state !== 'lobby') return { ok: false, error: 'already started' };
  if (game.playerIds.length < 2)
    return { ok: false, error: 'not enough players' };
  if (
    !game.offline &&
    game.playerIds.filter((id) => !playersById.get(id)?.isBot).length < 2
  )
    return { ok: false, error: 'not enough human players' };
  if (game.gameMode === 'Team Deathmatch' && teamCount(game) < 2)
    return { ok: false, error: 'not enough teams' };
  if (game.gameMode === 'Team Deathmatch' && game.alliances === 'on')
    return { ok: false, error: 'alliances not allowed in team deathmatch' };

  for (const ownerId of game.substituteFor.values()) {
    const owner = playersById.get(ownerId);
    if (owner && owner.gameName === game.name) owner.gameName = null;
  }
  game.substituteFor.clear();

  if (game.gameMode === 'Team Deathmatch') {
    compactTeams(game);
    game.playerIds = interleaveTeams(game);
  } else {
    game.playerIds = shuffle(game.playerIds);
  }
  initializeRadiation(game);
  game.replayInitialRadiation = [...game.radiationTerritoryIds];
  initializePortals(game);
  initializeContinent(game);
  if (game.placement === 'Random') {
    assignTerritories(game);
  } else if (game.placement === 'Semi') {
    assignTerritoryOwners(game);
  }
  if (game.gameMode === 'Assassin') {
    game.playerMissions = assignMissions(game, ['assassinate']);
  } else if (game.gameMode === 'Mission') {
    game.playerMissions = assignMissions(game);
  } else {
    game.playerMissions = new Map();
  }
  broadcastMissions(game);
  game.replayInitial = snapshotTerritories(game);
  game.replayFrames = [];
  game.replayTurnMarkers = [];
  game.replayChat = [];
  game.replayEmoji = [];
  game.logs = new Map();
  const map = getGameMap(game);
  game.deck = buildCardDeck(map.territories.map((t) => t.id));
  game.playerCards = new Map(game.playerIds.map((id) => [id, []]));
  for (const id of game.playerIds) {
    sendPlayerCards(game, id);
  }
  game.cardSetsPlayed = new Map();
  game.cardsLastSetValue = new Map();
  game.stats = new Map(game.playerIds.map((id) => [id, emptyPlayerStats()]));
  game.deathOrder = [];
  game.teamDeathOrder = [];
  if (game.placement !== 'Custom') {
    for (const id of game.playerIds) {
      if (!ownsAnyTerritory(game, id)) game.deathOrder.push(id);
    }
  }
  game.originalHostId = game.hostId;
  game.state = 'playing';
  game.remainingSpecialPhases = [
    ...(game.placement === 'Custom' ? (['territory'] as const) : []),
    ...(game.placement !== 'Random' ? (['troop'] as const) : []),
    ...(game.gameMode === 'Capitals' ? (['capital'] as const) : []),
  ];
  beginNextSpecialPhase(game);
  broadcastHomeGames();
  return respondGameState(game, player.id);
}
