import { isDifficultyInput, isPersonalityInput } from '../bots/randomProfile';
import { callbacks } from '../callbacks';
import { MAX_DICE } from '../game/combat/dice';
import { addHostCandidate } from '../game/host';
import { assignRandomColor } from '../game/mechanics';
import {
  defaultMaxPoints,
  MAX_HILLS,
  MAX_POINTS_VALUES,
  MIN_HILLS,
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
  Anonymous,
  Blitz,
  Bounties,
  CapitalRefund,
  CardsMode,
  Continents,
  DiceTies,
  Entrenchments,
  FogOfWar,
  Fortification,
  Game,
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
import {
  canTakeSeat,
  meetsMinAccountAge,
  meetsMinGames,
  meetsMinRank,
  MIN_ACCOUNT_AGE_VALUES,
  MIN_GAMES_VALUES,
  MIN_RANK_VALUES,
} from './eligibility';
import {
  MAX_SLOTS,
  MIN_SLOTS,
  openTeam,
  resetTeams,
  resizeTeams,
  setTeams,
} from './teams';

const ALLIANCES_VALUES: Alliances[] = ['off', 'on'];
const ANONYMOUS_VALUES: Anonymous[] = ['off', 'on'];
const BLITZ_VALUES: Blitz[] = ['balanced', 'true', 'fair', 'off'];
const BOUNTIES_VALUES: Bounties[] = ['off', 'on'];
const CAPITAL_REFUND_VALUES: CapitalRefund[] = ['off', 'on'];
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
const CONTINENTS_VALUES: Continents[] = [
  '1x',
  '2x',
  '3x',
  '5x',
  '10x',
  'shuffle',
  'random',
  'linear',
  'exponential',
  'linear per continent',
  'exponential per continent',
  'off',
];
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
const PLACEMENT_VALUES: Placement[] = ['random', 'semi', 'custom', 'single'];
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
const TURN_DURATION_VALUES: TurnDuration[] = [30, 60, 90, 120, 150, 180, 300];
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

function renameGame(game: Game, name: string) {
  games.delete(game.name);
  for (const id of [...game.playerIds, ...game.spectatorIds]) {
    const member = playersById.get(id);
    if (member) member.gameName = name;
    callbacks.onRoomChanged(id, name);
  }
  game.name = name;
  games.set(game.name, game);
}

function hideHostInGameName(game: Game, hostName: string) {
  const match = /^Game with (.+?)(?: \(\d+\))?$/.exec(game.name);
  if (!match || !hostName.startsWith(match[1])) return;
  let name;
  do name = `Game with ${Math.floor(Math.random() * 10000)}`;
  while (games.has(name));
  renameGame(game, name);
}

function promoteSpectators(game: Game) {
  while (game.playerIds.length < game.slots) {
    const idx = game.spectatorIds.findIndex(
      (id) => playersById.get(id)?.connected && canTakeSeat(game, id),
    );
    if (idx === -1) break;
    const promotedId = game.spectatorIds.splice(idx, 1)[0];
    game.playerTeams.set(promotedId, openTeam(game));
    game.playerIds.push(promotedId);
    assignRandomColor(game, promotedId);
    addHostCandidate(game, promotedId);
  }
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

  const merged = { ...game, ...settings };
  if (merged.blitz === 'off' && !isBlitzOffAllowed(merged))
    return { ok: false, error: 'blitz off not allowed with these settings' };

  if (settings.alliances !== undefined) {
    if (!(ALLIANCES_VALUES as unknown[]).includes(settings.alliances))
      return { ok: false, error: 'invalid alliances' };
    const effectiveGameMode =
      settings.gameMode !== undefined ? settings.gameMode : game.gameMode;
    if (settings.alliances === 'on' && effectiveGameMode === 'team deathmatch')
      return { ok: false, error: 'invalid alliances' };
    game.alliances = settings.alliances as Alliances;
  }

  if (settings.anonymous !== undefined) {
    if (!(ANONYMOUS_VALUES as unknown[]).includes(settings.anonymous))
      return { ok: false, error: 'invalid anonymous' };
    if (
      settings.anonymous === 'on' &&
      game.anonymous === 'off' &&
      !game.offline
    )
      hideHostInGameName(
        game,
        playersById.get(game.originalHostId)?.name ?? '',
      );
    game.anonymous = settings.anonymous as Anonymous;
  }

  if (settings.attackDice !== undefined) {
    if (
      !isInteger(settings.attackDice) ||
      settings.attackDice < 1 ||
      settings.attackDice > MAX_DICE
    )
      return { ok: false, error: 'invalid attack dice' };
    const defenceDice = isInteger(settings.defenceDice)
      ? settings.defenceDice
      : game.defenceDice;
    if (settings.attackDice < defenceDice)
      return { ok: false, error: 'invalid attack dice' };
    game.attackDice = settings.attackDice;
  }

  if (settings.attackIncrement !== undefined) {
    if (
      !isInteger(settings.attackIncrement) ||
      settings.attackIncrement < 0 ||
      settings.attackIncrement > 15
    )
      return { ok: false, error: 'invalid attack increment' };
    game.attackIncrement = settings.attackIncrement;
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

  if (settings.capitalRefund !== undefined) {
    if (!(CAPITAL_REFUND_VALUES as unknown[]).includes(settings.capitalRefund))
      return { ok: false, error: 'invalid capital refund' };
    game.capitalRefund = settings.capitalRefund as CapitalRefund;
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
      settings.defenceDice > game.attackDice ||
      (settings.defenceDice >= MAX_DICE &&
        (settings.entrenchments ?? game.entrenchments) === 'on')
    )
      return { ok: false, error: 'invalid defence dice' };
    game.defenceDice = settings.defenceDice;
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
    if (settings.gameMode === 'team deathmatch' && game.alliances === 'on')
      return { ok: false, error: 'invalid game mode' };
    const previousGameMode = game.gameMode;
    game.gameMode = settings.gameMode as GameMode;
    const maxPoints = defaultMaxPoints(game.gameMode);
    if (game.gameMode !== previousGameMode && maxPoints !== undefined)
      game.maxPoints = maxPoints;
    if (
      (game.gameMode === 'team deathmatch') !==
      (previousGameMode === 'team deathmatch')
    )
      resetTeams(game);
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

  if (settings.minAccountAge !== undefined) {
    if (
      !MIN_ACCOUNT_AGE_VALUES.includes(settings.minAccountAge as string) ||
      (!game.offline &&
        !meetsMinAccountAge(
          settings.minAccountAge as string,
          player.accountCreatedAt,
        ))
    )
      return { ok: false, error: 'invalid min account age' };
    game.minAccountAge = settings.minAccountAge as string;
  }

  if (settings.minGames !== undefined) {
    if (
      !MIN_GAMES_VALUES.includes(settings.minGames as number) ||
      (!game.offline &&
        !meetsMinGames(settings.minGames as number, player.gamesPlayed))
    )
      return { ok: false, error: 'invalid min games' };
    game.minGames = settings.minGames as number;
  }

  if (settings.minRank !== undefined) {
    if (
      !MIN_RANK_VALUES.includes(settings.minRank as string) ||
      (!game.offline && !meetsMinRank(settings.minRank as string, player.elo))
    )
      return { ok: false, error: 'invalid min rank' };
    game.minRank = settings.minRank as string;
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
      renameGame(game, trimmedName);
    }
  }

  if (settings.placement !== undefined) {
    if (!(PLACEMENT_VALUES as unknown[]).includes(settings.placement))
      return { ok: false, error: 'invalid placement' };
    game.placement = settings.placement as Placement;
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
      settings.slots < MIN_SLOTS ||
      settings.slots < game.playerIds.length ||
      settings.slots > MAX_SLOTS ||
      !resizeTeams(game, settings.slots)
    ) {
      return { ok: false, error: 'invalid slots' };
    }
    game.slots = settings.slots;
    promoteSpectators(game);
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

  if (settings.teams !== undefined) {
    if (!setTeams(game, settings.teams))
      return { ok: false, error: 'invalid teams' };
    promoteSpectators(game);
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

  if (
    settings.minAccountAge !== undefined ||
    settings.minGames !== undefined ||
    settings.minRank !== undefined
  ) {
    for (const id of [...game.playerIds]) {
      if (canTakeSeat(game, id)) continue;
      removePlayerFromGame(game, id);
      game.spectatorIds.push(id);
    }
  }

  broadcastHomeGames();
  return respondGameState(game, player.id);
}
