export interface WikiPageInfo {
  id: string;
  slug: string;
  section: string;
  title: string;
  summary: string;
}

export interface WikiSectionInfo {
  id: string;
  title: string;
  summary: string;
  pages: WikiPageInfo[];
}

type PageRow = [slug: string, title: string, summary: string];

function section(
  id: string,
  title: string,
  summary: string,
  rows: PageRow[],
): WikiSectionInfo {
  return {
    id,
    title,
    summary,
    pages: rows.map(([slug, pageTitle, pageSummary]) => ({
      id: `${id}/${slug}`,
      slug,
      section: id,
      title: pageTitle,
      summary: pageSummary,
    })),
  };
}

export const WIKI_SECTIONS: WikiSectionInfo[] = [
  section(
    'start',
    'Getting started',
    'New here? Start with what the game is, then play a first match.',
    [
      [
        'welcome',
        'Welcome to Annex',
        'What the game is, how you win and the ways to play it.',
      ],
      [
        'first-game',
        'Your first game',
        'The fastest route from the home page to a first match.',
      ],
      [
        'tutorials',
        'Tutorials',
        'Eleven short hands-on lessons, one per idea.',
      ],
      [
        'game-screen',
        'The game screen',
        'The map, the panels and the turn bar.',
      ],
      [
        'glossary',
        'Glossary',
        'The key game terms in one place, with links to the full page.',
      ],
    ],
  ),
  section(
    'rules',
    'Core rules',
    'Everything you need to play a standard game.',
    [
      [
        'turns',
        'Rounds and turns',
        'Turn order, the phases of a turn and the turn timer.',
      ],
      [
        'setup',
        'Starting a game',
        'How territories and starting troops are handed out.',
      ],
      [
        'deploy',
        'Deploying troops',
        'How many troops you get each turn and where they can go.',
      ],
      ['attack', 'Attacking', 'Dice, blitz, conquering and moving troops in.'],
      ['fortify', 'Fortifying', 'Moving troops between your own territories.'],
      ['cards', 'Cards', 'Earning cards and trading sets for troops.'],
      [
        'continents',
        'Continents',
        'Holding a whole continent pays a bonus every turn.',
      ],
      [
        'winning',
        'Winning, losing and draws',
        'Elimination, surrender, early wins and stalemates.',
      ],
    ],
  ),
  section('advanced', 'Advanced rules', 'Mechanics that only some games use.', [
    ['fog', 'Fog of war', 'Seeing only what is next to your territories.'],
    ['navy', 'Seas and ships', 'Buying ships, sailing and fighting at sea.'],
    ['alliances', 'Alliances', 'Private pacts that share vision and emojis.'],
  ]),
  section('modes', 'Game modes', 'The mode decides how a game is won.', [
    ['overview', 'All modes at a glance', 'Every mode in one table.'],
    [
      'conquest',
      'Conquest modes',
      'Supremacy, its quicker variants and Continent.',
    ],
    ['teams', 'Team Deathmatch', 'Fighting in teams.'],
    ['capitals', 'Capitals', 'Protect your capital and take the others.'],
    ['rounds', 'Round limits', '5-Round and 10-Round games.'],
    ['secret-goals', 'Secret goals', 'Assassin and Mission.'],
    [
      'scoring',
      'Scoring modes',
      'Player Kills, Troop Kills, King of the Hill and Empire.',
    ],
  ]),
  section(
    'play',
    'Finding and joining games',
    'From the home page to a seat at the table.',
    [
      [
        'games-list',
        'Open games',
        'The game list, its filters and Quick Play.',
      ],
      ['create', 'Creating a game', 'Hosting an online game.'],
      [
        'join',
        'Joining a game',
        'Passwords, requirements, seats and spectators.',
      ],
      [
        'lobby',
        'Inside the lobby',
        'Roster, colors, teams, bots and host controls.',
      ],
      [
        'offline',
        'Offline games',
        'Playing against bots, or with friends on one device.',
      ],
      ['spectating', 'Spectating', 'Watching a live game or a player.'],
      [
        'leaving',
        'Leaving and reconnecting',
        'Disconnects, bot cover, surrender and abort votes.',
      ],
    ],
  ),
  section(
    'settings',
    'Game settings',
    'The host shapes every game. This is the reference for each switch.',
    [
      [
        'overview',
        'Settings overview',
        'Defaults, presets, the random button and how settings are saved.',
      ],
      [
        'setup',
        'Setup',
        'Placement, initial troops, fortification, capitals and points.',
      ],
      ['combat', 'Combat', 'Blitz, dice, ties and entrenchments.'],
      [
        'reinforcements',
        'Reinforcements',
        'Troops per territory, continents, cards and other income.',
      ],
      [
        'hazards',
        'Hazards',
        'Portals, radiation, nukes, toxins and starvation.',
      ],
      ['players', 'Players', 'Fog of war, alliances and anonymous games.'],
      [
        'stalemate',
        'Stalemate prevention',
        'Round and time limits, standoffs and draw offers.',
      ],
      [
        'session',
        'Session',
        'Turn timer, attack increment and seat requirements.',
      ],
    ],
  ),
  section('maps', 'Maps', 'Pick a map, generate one or draw your own.', [
    ['overview', 'Map overview', 'The three kinds of map.'],
    [
      'library',
      'The map library',
      'Browsing, liking and reporting community maps.',
    ],
    ['generated', 'Generated maps', 'Types, sizes, fills and seeds.'],
    ['earth', 'Earth maps', 'Turn a real place into a map.'],
    [
      'features',
      'Special map features',
      'Seas, timed and directional links, switches and unlockable tiles.',
    ],
    ['editor', 'The map editor', 'Draw, import, link and save your own map.'],
  ]),
  section(
    'bots',
    'Bots',
    'Computer players: how they differ and when they step in.',
    [
      ['difficulty', 'Bot difficulty', 'Idle, Easy, Medium and Hard.'],
      ['personalities', 'Bot personalities', 'How each personality plays.'],
      [
        'takeover',
        'Bot takeovers',
        'What happens to a seat when its player leaves.',
      ],
    ],
  ),
  section(
    'accounts',
    'Accounts and profiles',
    'Playing as a guest, creating an account and what others see of you.',
    [
      [
        'guests-and-accounts',
        'Guests and accounts',
        'What you can do without an account, and what an account adds.',
      ],
      [
        'create-account',
        'Creating an account',
        'Signing up, confirming your email, logging in and recovering a password.',
      ],
      [
        'account-page',
        'Your account page',
        'Picture, profile text, country and password.',
      ],
      [
        'preferred-colors',
        'Preferred colors',
        'How your color list works and which colors a game allows.',
      ],
      [
        'profiles',
        'Player profiles',
        'Every number on a profile and what it means.',
      ],
      [
        'find-players',
        'Finding players',
        'Searching, filtering and sorting the player list.',
      ],
      [
        'achievements',
        'Achievements',
        'The full list of badges and how to earn each one.',
      ],
    ],
  ),
  section(
    'ranking',
    'Elo and conduct',
    'How skill and behavior are measured.',
    [
      [
        'elo',
        'Elo and ranks',
        'The rating, the thirteen ranks and abandon penalties.',
      ],
      [
        'reputation',
        'Reputation',
        'How good conduct is tracked and what it unlocks.',
      ],
      [
        'reports',
        'Reports and blocks',
        'Reporting bad behavior and blocking players.',
      ],
    ],
  ),
  section(
    'history',
    'History and replays',
    'Every finished game is kept and can be watched again.',
    [
      ['games', 'Game history', 'Searching past games.'],
      [
        'results',
        'End of game results',
        'The results table, Elo changes and luck.',
      ],
      ['replays', 'Replays', 'Stepping through a finished game.'],
      ['export', 'Exporting replays', 'Turn a replay into a GIF or MP4.'],
    ],
  ),
  section(
    'social',
    'Friends and chat',
    'Staying in touch with the people you play with.',
    [
      [
        'friends',
        'Friends',
        'Requests, the friend list and seeing who is online.',
      ],
      ['messages', 'Messages', 'Private conversations between accounts.'],
      ['chat', 'In-game chat and emoji', 'Talking during a game.'],
    ],
  ),
  section('tools', 'Settings and tools', 'Sound, shortcuts and small extras.', [
    [
      'client-settings',
      'Client settings',
      'Sound, music, animations and fullscreen.',
    ],
    ['shortcuts', 'Shortcuts', 'Every keyboard and mouse shortcut.'],
    ['install', 'Install the app', 'Add Annex to your device.'],
    ['tanks', 'Background tanks', 'The toy tanks rolling behind the pages.'],
  ]),
  section('strategy', 'Strategy', 'Habits that win games.', [
    ['basics', 'Strategy basics', 'Core habits for stronger play.'],
  ]),
];

export const WIKI_PAGES: WikiPageInfo[] = WIKI_SECTIONS.flatMap(
  (wikiSection) => wikiSection.pages,
);

export function findSection(id: string): WikiSectionInfo | undefined {
  return WIKI_SECTIONS.find((wikiSection) => wikiSection.id === id);
}

export function findPage(id: string): WikiPageInfo | undefined {
  return WIKI_PAGES.find((page) => page.id === id);
}

export function titleOf(id: string): string {
  return findPage(id)?.title ?? findSection(id)?.title ?? id;
}
