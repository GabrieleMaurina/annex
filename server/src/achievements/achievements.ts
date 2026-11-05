import { AchievementFacts, TUTORIAL_IDS } from 'engine';
import {
  AchievementDefinition,
  countGameResults,
  countMapLikes,
  getPlayerMapOwner,
  grantAchievements,
} from '../db';
import { GameElo } from '../elo';

const EMPEROR_TROOPS = 30;
const MANY_GAMES = 10;
const CONQUEROR_TERRITORIES = 100;
const KILLER_PLAYERS = 3;
const BLITZKRIEG_TERRITORIES = 10;
const CARD_SHARK_TROOPS = 20;
const UNDERDOG_ELO_GAP = 100;
const MARATHON_ROUNDS = 50;
const POPULAR_LIKES = 10;

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'first-offline',
    title: 'First Offline',
    description: 'Played your first offline game.',
  },
  {
    id: 'offline-victory',
    title: 'Offline Victory',
    description: 'Won your first offline game.',
  },
  {
    id: 'first-online',
    title: 'First Online',
    description: 'Played your first online game.',
  },
  {
    id: 'online-victory',
    title: 'Online Victory',
    description: 'Won your first online game.',
  },
  {
    id: 'veteran',
    title: 'Veteran',
    description: `Played ${MANY_GAMES} online games.`,
  },
  {
    id: 'champion',
    title: 'Champion',
    description: `Won ${MANY_GAMES} online games.`,
  },
  {
    id: 'cannon-fodder',
    title: 'Cannon Fodder',
    description: `Got eliminated in ${MANY_GAMES} online games.`,
  },
  {
    id: 'comeback',
    title: 'Comeback',
    description: 'Won an online game after being left with 3 territories.',
  },
  {
    id: 'emperor',
    title: 'Emperor',
    description: `Gained ${EMPEROR_TROOPS}+ troops at the start of a turn in an online game.`,
  },
  {
    id: 'conqueror',
    title: 'Conqueror',
    description: `Conquered ${CONQUEROR_TERRITORIES} territories in one online game.`,
  },
  {
    id: 'killer',
    title: 'Killer',
    description: `Eliminated ${KILLER_PLAYERS} players in one online game.`,
  },
  {
    id: 'blitzkrieg',
    title: 'Blitzkrieg',
    description: `Conquered ${BLITZKRIEG_TERRITORIES} territories in one turn of an online game.`,
  },
  {
    id: 'card-shark',
    title: 'Card Shark',
    description: `Played a card set worth ${CARD_SHARK_TROOPS}+ troops in an online game.`,
  },
  {
    id: 'nuclear',
    title: 'Nuclear',
    description: 'Launched a nuke in an online game.',
  },
  {
    id: 'admiral',
    title: 'Admiral',
    description: 'Sank an enemy fleet in an online game.',
  },
  {
    id: 'diplomat',
    title: 'Diplomat',
    description: 'Won an online game in which you formed an alliance.',
  },
  {
    id: 'underdog',
    title: 'Underdog',
    description: `Won an online game against a player rated ${UNDERDOG_ELO_GAP}+ Elo above you.`,
  },
  {
    id: 'marathon',
    title: 'Marathon',
    description: `Played an online game of ${MARATHON_ROUNDS}+ rounds.`,
  },
  {
    id: 'nerd',
    title: 'Nerd',
    description: 'Completed all tutorials.',
  },
  {
    id: 'cartographer',
    title: 'Cartographer',
    description: 'Published a map.',
  },
  {
    id: 'popular',
    title: 'Popular',
    description: `Got ${POPULAR_LIKES} likes on one of your maps.`,
  },
];

interface GameEndedPayload {
  ranking: { playerId: number; facts: AchievementFacts }[];
}

function isUnderdog(
  playerId: number,
  facts: AchievementFacts,
  elos: Map<number, GameElo>,
): boolean {
  const mine = elos.get(playerId);
  if (!facts.won || !mine) return false;
  return [...elos].some(
    ([id, other]) =>
      id !== playerId && other.elo >= mine.elo + UNDERDOG_ELO_GAP,
  );
}

function inGameAchievementIds(
  playerId: number,
  facts: AchievementFacts,
  lastPlayedRound: number,
  elos: Map<number, GameElo>,
): string[] {
  const earned: [string, boolean][] = [
    ['comeback', facts.won && facts.cornered],
    ['emperor', facts.peakTurnTroops >= EMPEROR_TROOPS],
    ['conqueror', facts.territoriesConquered >= CONQUEROR_TERRITORIES],
    ['killer', facts.playersKilled >= KILLER_PLAYERS],
    ['blitzkrieg', facts.peakTurnConquests >= BLITZKRIEG_TERRITORIES],
    ['card-shark', facts.peakSetTroops >= CARD_SHARK_TROOPS],
    ['nuclear', facts.nukesLaunched >= 1],
    ['admiral', facts.fleetsSunk >= 1],
    ['diplomat', facts.won && facts.alliancesFormed >= 1],
    ['underdog', isUnderdog(playerId, facts, elos)],
    ['marathon', lastPlayedRound + 1 >= MARATHON_ROUNDS],
  ];
  return earned.filter(([, ok]) => ok).map(([id]) => id);
}

function grantPlayerAchievements(userId: string, ids: string[]): Promise<void> {
  return countGameResults(userId).then(({ played, won, eliminated }) => {
    if (played >= 1) ids.push('first-online');
    if (won >= 1) ids.push('online-victory');
    if (played >= MANY_GAMES) ids.push('veteran');
    if (won >= MANY_GAMES) ids.push('champion');
    if (eliminated >= MANY_GAMES) ids.push('cannon-fodder');
    return grantAchievements(userId, ids);
  });
}

export function grantGameAchievements(
  payload: GameEndedPayload,
  participants: Map<number, string>,
  elos: Map<number, GameElo>,
): Promise<void> {
  return Promise.all(
    payload.ranking.map(({ playerId, facts }) => {
      const userId = participants.get(playerId);
      if (!userId || facts.lastPlayedRound === null) return undefined;
      const ids = inGameAchievementIds(
        playerId,
        facts,
        facts.lastPlayedRound,
        elos,
      );
      return grantPlayerAchievements(userId, ids);
    }),
  ).then(() => undefined);
}

export function grantOfflineAchievements(
  userId: string,
  won: boolean,
): Promise<void> {
  return grantAchievements(
    userId,
    won ? ['first-offline', 'offline-victory'] : ['first-offline'],
  );
}

export function grantTutorialAchievements(
  userId: string,
  completed: string[],
): Promise<void> {
  return TUTORIAL_IDS.every((id) => completed.includes(id))
    ? grantAchievements(userId, ['nerd'])
    : Promise.resolve();
}

export function grantMapPublishedAchievements(userId: string): Promise<void> {
  return grantAchievements(userId, ['cartographer']);
}

export function grantMapLikedAchievements(mapId: string): Promise<void> {
  return Promise.all([getPlayerMapOwner(mapId), countMapLikes(mapId)]).then(
    ([owner, likes]) =>
      owner && likes >= POPULAR_LIKES
        ? grantAchievements(owner.authorId, ['popular'])
        : undefined,
  );
}
