import { isDifficultyInput, isPersonalityInput } from '../bots/randomProfile';
import { callbacks } from '../callbacks';
import { MAX_DICE } from '../game/combat/dice';
import { addHostCandidate } from '../game/host';
import { assignRandomColor, maxTeam } from '../game/mechanics';
import {
  MAX_HILLS,
  MAX_POINTS_VALUES,
  MIN_HILLS,
  defaultMaxPoints,
} from '../game/progression/points';
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
  Continents,
  DiceTies,
  Entrenchments,
  FogOfWar,
  Fortification,
  GameMode,
  Nukes,
  Placement,
  Portals,
  Radiations,
  RoundTroops,
  Starvation,
  SupplyLines,
  Toxins,
  TurnDuration,
} from '../types';
import { isInteger } from '../util/validate';
import { validateGameName } from './create';

const ALLIANCES_VALUES: Alliances[] = ['off', 'on'];
const BLITZ_VALUES: Blitz[] = ['balanced', 'true', 'fair', 'off'];
const BOUNTIES_VALUES: Bounties[] = ['off', 'on'];
const CARDS_VALUES: CardsMode[] = [
  'constant',
  'linear',
  'exponential',
  'linear per player',
  'exponential per player',
  'off',
];
const PROGRESSIVE_CARDS_VALUES: CardsMode[] = [
  'linear',
  'exponential',
  'linear per player',
  'exponential per player',
];
const CONTINENTS_VALUES: Continents[] = ['off', 'on'];
const DICE_TIES_VALUES: DiceTies[] = ['defence', 'attack', 'tie'];
const ENTRENCHMENTS_VALUES: Entrenchments[] = ['off', 'on'];
const FOG_OF_WAR_VALUES: FogOfWar[] = ['off', 'on'];
const FORTIFICATION_VALUES: Fortification[] = [
  'connected',
  'neighboring',
  'unrestricted',
];
const GAME_MODE_VALUES: GameMode[] = [
  'supremacy',
  'supremacy 3/4',
  'supremacy 2/3',
  'capitals',
  'team deathmatch',
  'continent',
  '5-round',
  '10-round',
  'assassin',
  'mission',
  'player kills',
  'troop kills',
  'king of the hill',
  'empire',
];
const PLACEMENT_VALUES: Placement[] = ['random', 'semi', 'custom'];
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
const NUKES_VALUES: Nukes[] = ['off', 'on'];
const TOXINS_VALUES: Toxins[] = ['off', 'temporary', 'permanent'];
const TURN_DURATION_VALUES: TurnDuration[] = [60, 90, 120, 150, 180, 300];
const ROUND_TROOPS_VALUES: RoundTroops[] = ['off', 'on'];
export const TROOPS_PER_TERRITORY_VALUES = [
  1 / 5,
  1 / 4,
  1 / 3,
  1 / 2,
  ...Array.from({ length: 100 }, (_, i) => i + 1),
];

const MAX_BLITZ_OFF_TROOPS = 10;

export function isBlitzOffAllowed(settings: {
  roundTroops: unknown;
  cards: unknown;
  troopsPerTerritory: unknown;
  initialTroops: unknown;
  minTroops: unknown;
}): boolean {
  return (
    settings.roundTroops !== 'on' &&
    !(PROGRESSIVE_CARDS_VALUES as unknown[]).includes(settings.cards) &&
    Number(settings.troopsPerTerritory) < 1 &&
    Number(settings.initialTroops) <= MAX_BLITZ_OFF_TROOPS &&
    Number(settings.minTroops) <= MAX_BLITZ_OFF_TROOPS
  );
}

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
    if (settings.alliances === 'on' && effectiveGameMode === 'team deathmatch')
      return { ok: false, error: 'invalid alliances' };
    game.alliances = settings.alliances as Alliances;
  }

  if (settings.attackDice !== undefined) {
    if (
      !isInteger(settings.attackDice) ||
      settings.attackDice < 1 ||
      settings.attackDice > MAX_DICE
    )
      return { ok: false, error: 'invalid attack dice' };
    game.attackDice = settings.attackDice;
    if (game.defenceDice > game.attackDice) game.defenceDice = game.attackDice;
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
    if (
      settings.blitz === 'off' &&
      !isBlitzOffAllowed({
        roundTroops: settings.roundTroops ?? game.roundTroops,
        cards: settings.cards ?? game.cards,
        troopsPerTerritory:
          settings.troopsPerTerritory ?? game.troopsPerTerritory,
        initialTroops: settings.initialTroops ?? game.initialTroops,
        minTroops: settings.minTroops ?? game.minTroops,
      })
    )
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

  if (settings.continents !== undefined) {
    if (!(CONTINENTS_VALUES as unknown[]).includes(settings.continents))
      return { ok: false, error: 'invalid continents' };
    game.continents = settings.continents as Continents;
  }

  if (settings.defenceDice !== undefined) {
    if (
      !isInteger(settings.defenceDice) ||
      settings.defenceDice < 1 ||
      settings.defenceDice > game.attackDice
    )
      return { ok: false, error: 'invalid defence dice' };
    game.defenceDice = settings.defenceDice;
    if (game.defenceDice >= MAX_DICE) game.entrenchments = 'off';
  }

  if (settings.diceTies !== undefined) {
    if (!(DICE_TIES_VALUES as unknown[]).includes(settings.diceTies))
      return { ok: false, error: 'invalid dice ties' };
    game.diceTies = settings.diceTies as DiceTies;
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
    if (settings.entrenchments === 'on' && game.defenceDice >= MAX_DICE)
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
    const previousGameMode = game.gameMode;
    game.gameMode = settings.gameMode as GameMode;
    if (game.gameMode === 'team deathmatch') game.alliances = 'off';
    const maxPoints = defaultMaxPoints(game.gameMode);
    if (game.gameMode !== previousGameMode && maxPoints !== undefined)
      game.maxPoints = maxPoints;
  }

  if (settings.hills !== undefined) {
    if (
      !isInteger(settings.hills) ||
      settings.hills < MIN_HILLS ||
      settings.hills > MAX_HILLS
    )
      return { ok: false, error: 'invalid hills' };
    game.hills = settings.hills;
  }

  if (settings.initialTroops !== undefined) {
    if (
      !isInteger(settings.initialTroops) ||
      settings.initialTroops < 1 ||
      settings.initialTroops > 100
    )
      return { ok: false, error: 'invalid initial troops' };
    game.initialTroops = settings.initialTroops;
  }

  if (settings.maxPoints !== undefined) {
    if (!(MAX_POINTS_VALUES as unknown[]).includes(settings.maxPoints))
      return { ok: false, error: 'invalid max points' };
    game.maxPoints = settings.maxPoints as number;
  }

  if (settings.minTroops !== undefined) {
    if (
      !isInteger(settings.minTroops) ||
      settings.minTroops < 0 ||
      settings.minTroops > 100
    )
      return { ok: false, error: 'invalid min troops' };
    game.minTroops = settings.minTroops;
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

  if (settings.nukes !== undefined) {
    if (!(NUKES_VALUES as unknown[]).includes(settings.nukes))
      return { ok: false, error: 'invalid nukes' };
    game.nukes = settings.nukes as Nukes;
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

    while (game.playerIds.length < game.slots) {
      const idx = game.spectatorIds.findIndex(
        (id) => playersById.get(id)?.connected,
      );
      if (idx === -1) break;
      const promotedId = game.spectatorIds.splice(idx, 1)[0];
      game.playerIds.push(promotedId);
      game.playerTeams.set(promotedId, 0);
      assignRandomColor(game, promotedId);
      addHostCandidate(game, promotedId);
    }
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

  if (settings.troopsPerTerritory !== undefined) {
    if (
      !(TROOPS_PER_TERRITORY_VALUES as unknown[]).includes(
        settings.troopsPerTerritory,
      )
    )
      return { ok: false, error: 'invalid troops per territory' };
    game.troopsPerTerritory = settings.troopsPerTerritory as number;
  }

  if (settings.turnDuration !== undefined) {
    if (!(TURN_DURATION_VALUES as unknown[]).includes(settings.turnDuration))
      return { ok: false, error: 'invalid turn duration' };
    game.turnDuration = settings.turnDuration as TurnDuration;
  }

  if (settings.roundTroops !== undefined) {
    if (!(ROUND_TROOPS_VALUES as unknown[]).includes(settings.roundTroops))
      return { ok: false, error: 'invalid round troops' };
    game.roundTroops = settings.roundTroops as RoundTroops;
  }

  if (game.blitz === 'off' && !isBlitzOffAllowed(game)) game.blitz = 'balanced';

  broadcastHomeGames();
  return respondGameState(game, player.id);
}
