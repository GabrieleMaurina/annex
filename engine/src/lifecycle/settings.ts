import { isDifficultyInput, isPersonalityInput } from '../bots/randomProfile';
import { callbacks } from '../callbacks';
import { maxTeam } from '../game/mechanics';
import { listMapNames } from '../maps/maps';
import { GameResponse } from '../session/context';
import { playersById } from '../session/players';
import {
  broadcastHomeGames,
  games,
  removePlayerFromGame,
  respondGameState,
} from '../session/store';
import {
  Alliances,
  Blitz,
  Bounties,
  CardsMode,
  DefenceDice,
  Entrenchments,
  FogOfWar,
  Fortification,
  GameMode,
  Placement,
  Portals,
  Radiations,
  Starvation,
  SupplyLines,
  Toxins,
  TurnDuration,
  TurnTroops,
} from '../types';
import { isInteger } from '../util/validate';
import { validateGameName } from './create';

const ALLIANCES_VALUES: Alliances[] = ['off', 'on'];
const BLITZ_VALUES: Blitz[] = ['Balanced', 'True'];
const BOUNTIES_VALUES: Bounties[] = ['off', 'on'];
const CARDS_VALUES: CardsMode[] = [
  'Constant',
  'Linear',
  'Exponential',
  'Linear Per Player',
  'Exponential Per Player',
];
const DEFENCE_DICE_VALUES: DefenceDice[] = [2, 3];
const ENTRENCHMENTS_VALUES: Entrenchments[] = ['off', 'on'];
const FOG_OF_WAR_VALUES: FogOfWar[] = ['off', 'on'];
const FORTIFICATION_VALUES: Fortification[] = [
  'Connected',
  'Neighboring',
  'Unrestricted',
];
const GAME_MODE_VALUES: GameMode[] = [
  'Supremacy',
  'Supremacy 3/4',
  'Supremacy 2/3',
  'Capitals',
  'Team Deathmatch',
  'Continent',
  '5-Turn',
  '10-Turn',
  'Assassin',
  'Mission',
  'Player Kills',
  'Troop Kills',
];
const PLACEMENT_VALUES: Placement[] = ['Random', 'Semi', 'Custom'];
const PORTALS_VALUES: Portals[] = ['off', 'static', 'dynamic'];
const RADIATIONS_VALUES: Radiations[] = [
  'off',
  'static',
  'dynamic',
  'expanding',
];
const STARVATION_VALUES: Starvation[] = [
  'off',
  'territory',
  'total',
  'percent',
];
const SUPPLY_LINES_VALUES: SupplyLines[] = ['off', 'on'];
const TOXINS_VALUES: Toxins[] = ['off', 'temporary', 'permanent'];
const TURN_DURATION_VALUES: TurnDuration[] = [60, 90, 120, 150, 180, 300];
const TURN_TROOPS_VALUES: TurnTroops[] = ['off', 'on'];

export function updateSettings(
  playerId: number,
  settings: Record<string, unknown>,
): GameResponse {
  const player = playersById.get(playerId);
  if (!player || !player.gameName) return { ok: false, error: 'not in a game' };

  const game = games.get(player.gameName);
  if (!game) return { ok: false, error: 'game not found' };
  if (game.hostId !== player.id) return { ok: false, error: 'not the host' };
  if (game.state !== 'lobby')
    return { ok: false, error: 'game already started' };

  if (settings.alliances !== undefined) {
    if (!(ALLIANCES_VALUES as unknown[]).includes(settings.alliances))
      return { ok: false, error: 'invalid alliances' };
    const effectiveGameMode =
      settings.gameMode !== undefined ? settings.gameMode : game.gameMode;
    if (settings.alliances === 'on' && effectiveGameMode === 'Team Deathmatch')
      return { ok: false, error: 'invalid alliances' };
    game.alliances = settings.alliances as Alliances;
  }

  if (settings.bannedPlayerIds !== undefined) {
    if (!Array.isArray(settings.bannedPlayerIds))
      return { ok: false, error: 'invalid banned players' };

    const newBannedIds = new Set<number>(
      settings.bannedPlayerIds.filter(
        (id): id is number => isInteger(id) && id !== player.id,
      ),
    );

    for (const id of newBannedIds) {
      if (game.bannedIds.has(id)) continue;
      const isPlayer = game.playerIds.includes(id);
      const isSpectator = game.spectatorIds.includes(id);
      if (!isPlayer && !isSpectator) continue;

      const kicked = playersById.get(id);
      if (!kicked) continue;
      kicked.gameName = null;
      callbacks.onRoomChanged(id, null);
      callbacks.onKicked(id, { gameName: game.name });

      if (isPlayer) {
        removePlayerFromGame(game, id);
      } else {
        game.spectatorIds = game.spectatorIds.filter((s) => s !== id);
      }
    }

    game.bannedIds = newBannedIds;
  }

  if (settings.blitz !== undefined) {
    if (!(BLITZ_VALUES as unknown[]).includes(settings.blitz))
      return { ok: false, error: 'invalid blitz' };
    game.blitz = settings.blitz as Blitz;
  }

  if (settings.bounties !== undefined) {
    if (!(BOUNTIES_VALUES as unknown[]).includes(settings.bounties))
      return { ok: false, error: 'invalid bounties' };
    game.bounties = settings.bounties as Bounties;
  }

  if (settings.cards !== undefined) {
    if (!(CARDS_VALUES as unknown[]).includes(settings.cards))
      return { ok: false, error: 'invalid cards' };
    game.cards = settings.cards as CardsMode;
  }

  if (settings.defenceDice !== undefined) {
    if (!(DEFENCE_DICE_VALUES as unknown[]).includes(settings.defenceDice))
      return { ok: false, error: 'invalid defence dice' };
    game.defenceDice = settings.defenceDice as DefenceDice;
    if (game.defenceDice !== 2) game.entrenchments = 'off';
  }

  if (settings.disconnectBotDifficulty !== undefined) {
    if (!isDifficultyInput(settings.disconnectBotDifficulty))
      return { ok: false, error: 'invalid disconnect bot difficulty' };
    game.disconnectBotDifficulty = settings.disconnectBotDifficulty;
  }

  if (settings.disconnectBotPersonality !== undefined) {
    if (!isPersonalityInput(settings.disconnectBotPersonality))
      return { ok: false, error: 'invalid disconnect bot personality' };
    game.disconnectBotPersonality = settings.disconnectBotPersonality;
  }

  if (settings.entrenchments !== undefined) {
    if (!(ENTRENCHMENTS_VALUES as unknown[]).includes(settings.entrenchments))
      return { ok: false, error: 'invalid entrenchments' };
    if (settings.entrenchments === 'on' && game.defenceDice !== 2)
      return { ok: false, error: 'invalid entrenchments' };
    game.entrenchments = settings.entrenchments as Entrenchments;
  }

  if (settings.fogOfWar !== undefined) {
    if (!(FOG_OF_WAR_VALUES as unknown[]).includes(settings.fogOfWar))
      return { ok: false, error: 'invalid fog of war' };
    game.fogOfWar = settings.fogOfWar as FogOfWar;
  }

  if (settings.fortification !== undefined) {
    if (!(FORTIFICATION_VALUES as unknown[]).includes(settings.fortification))
      return { ok: false, error: 'invalid fortification' };
    game.fortification = settings.fortification as Fortification;
  }

  if (settings.gameMode !== undefined) {
    if (!(GAME_MODE_VALUES as unknown[]).includes(settings.gameMode))
      return { ok: false, error: 'invalid game mode' };
    game.gameMode = settings.gameMode as GameMode;
    if (game.gameMode === 'Team Deathmatch') game.alliances = 'off';
  }

  if (settings.mapName !== undefined) {
    if (
      typeof settings.mapName !== 'string' ||
      !listMapNames().includes(settings.mapName)
    )
      return { ok: false, error: 'invalid map' };
    game.mapName = settings.mapName;
    game.generatedMap = null;
  }

  if (settings.name !== undefined) {
    const trimmedName = validateGameName(settings.name);
    if (!trimmedName) return { ok: false, error: 'invalid name' };

    if (trimmedName !== game.name) {
      if (games.has(trimmedName))
        return { ok: false, error: 'game name already in use' };

      games.delete(game.name);
      for (const id of [...game.playerIds, ...game.spectatorIds]) {
        const member = playersById.get(id);
        if (member) member.gameName = trimmedName;
        callbacks.onRoomChanged(id, trimmedName);
      }
      game.name = trimmedName;
      games.set(game.name, game);
    }
  }

  if (settings.placement !== undefined) {
    if (!(PLACEMENT_VALUES as unknown[]).includes(settings.placement))
      return { ok: false, error: 'invalid placement' };
    game.placement = settings.placement as Placement;
  }

  if (settings.playerTeam !== undefined) {
    const playerTeam = settings.playerTeam;
    if (typeof playerTeam !== 'object' || playerTeam === null)
      return { ok: false, error: 'invalid team' };

    const { playerId: teamPlayerId, team } = playerTeam as Record<
      string,
      unknown
    >;
    if (
      !isInteger(teamPlayerId) ||
      !game.playerIds.includes(teamPlayerId) ||
      !isInteger(team) ||
      team < 0 ||
      team > maxTeam(game)
    ) {
      return { ok: false, error: 'invalid team' };
    }
    game.playerTeams.set(teamPlayerId, team);
  }

  if (settings.portals !== undefined) {
    if (!(PORTALS_VALUES as unknown[]).includes(settings.portals))
      return { ok: false, error: 'invalid portals' };
    game.portals = settings.portals as Portals;
  }

  if (settings.radiations !== undefined) {
    if (!(RADIATIONS_VALUES as unknown[]).includes(settings.radiations))
      return { ok: false, error: 'invalid radiations' };
    game.radiations = settings.radiations as Radiations;
  }

  if (settings.slots !== undefined) {
    if (
      !isInteger(settings.slots) ||
      settings.slots < 2 ||
      settings.slots < game.playerIds.length ||
      settings.slots > 20
    ) {
      return { ok: false, error: 'invalid slots' };
    }
    game.slots = settings.slots;
  }

  if (settings.starvation !== undefined) {
    if (!(STARVATION_VALUES as unknown[]).includes(settings.starvation))
      return { ok: false, error: 'invalid starvation' };
    game.starvation = settings.starvation as Starvation;
  }

  if (settings.supplyLines !== undefined) {
    if (!(SUPPLY_LINES_VALUES as unknown[]).includes(settings.supplyLines))
      return { ok: false, error: 'invalid supply lines' };
    game.supplyLines = settings.supplyLines as SupplyLines;
  }

  if (settings.toxins !== undefined) {
    if (!(TOXINS_VALUES as unknown[]).includes(settings.toxins))
      return { ok: false, error: 'invalid toxins' };
    game.toxins = settings.toxins as Toxins;
  }

  if (settings.turnDuration !== undefined) {
    if (!(TURN_DURATION_VALUES as unknown[]).includes(settings.turnDuration))
      return { ok: false, error: 'invalid turn duration' };
    game.turnDuration = settings.turnDuration as TurnDuration;
  }

  if (settings.turnTroops !== undefined) {
    if (!(TURN_TROOPS_VALUES as unknown[]).includes(settings.turnTroops))
      return { ok: false, error: 'invalid turn troops' };
    game.turnTroops = settings.turnTroops as TurnTroops;
  }

  broadcastHomeGames();
  return respondGameState(game, player.id);
}
