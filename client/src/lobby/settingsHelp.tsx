export const GAME_MODE_HELP = (
  <>
    How the game is won. In every mode except Player Kills and Troop Kills, if
    everyone else surrenders or is eliminated, the last player (or team)
    standing wins immediately, regardless of the mode.
    <ul className="mb-0 ps-3">
      <li>Supremacy: own every territory on the map.</li>
      <li>
        Supremacy 3/4: control at least 3/4 of the map&apos;s territories.
      </li>
      <li>
        Supremacy 2/3: control at least 2/3 of the map&apos;s territories.
      </li>
      <li>
        Capitals: everyone places a capital at the start; win by owning every
        territory, or by owning every capital from turn 3 onward.
      </li>
      <li>
        Team Deathmatch: players are split into teams; your team wins by owning
        every territory.
      </li>
      <li>
        Continent: the server picks one continent (at least 7 territories if the
        map has one, otherwise its largest) for everyone to fight over. Win by
        owning every territory of that continent (ignoring any currently toxined
        or radiated) from turn 3 onward.
      </li>
      <li>
        5-Turn: the game ends after 5 full rounds, whoever holds the most
        territories then wins.
      </li>
      <li>
        10-Turn: the game ends after 10 full rounds, whoever holds the most
        territories then wins.
      </li>
      <li>
        Assassin: everyone is secretly assigned another player to eliminate.
        Kill your target to win; if someone else eliminates them first, win
        instead by controlling 3/4 of the map.
      </li>
      <li>
        Mission: everyone secretly draws one hidden mission at the start.
        Complete your mission to win.
      </li>
      <li>
        Player Kills: play until only one player is left standing; whoever
        eliminated the most opponents wins, even if it wasn&apos;t them.
      </li>
      <li>
        Troop Kills: play until only one player is left standing; whoever
        destroyed the most enemy troops wins, even if it wasn&apos;t them.
      </li>
    </ul>
  </>
);

export const MAP_HELP = 'Which territory layout the game is played on.';

export const BLITZ_HELP = (
  <>
    How an all-out attack (&quot;blitz&quot;) resolves a battle instantly
    instead of one exchange at a time.
    <ul className="mb-0 ps-3">
      <li>
        Balanced: outcomes are smoothed, so a much stronger army isn&apos;t
        guaranteed a clean, lossless win; the underdog keeps a fighting chance.
      </li>
      <li>
        True: uses the exact same odds as fighting it out exchange by exchange,
        so a much stronger army will crush a weaker one almost every time.
      </li>
    </ul>
  </>
);

export const DEFENCE_DICE_HELP = (
  <>
    How many dice a defending territory rolls per attack exchange (capped by its
    own troop count). More dice means better odds for the defender.
    <ul className="mb-0 ps-3">
      <li>2: defenders roll at most 2 dice.</li>
      <li>3: defenders roll at most 3 dice (stronger defense).</li>
    </ul>
  </>
);

export const CARDS_HELP = (
  <>
    How much a set of 3 territory cards is worth in troops when played.
    <ul className="mb-0 ps-3">
      <li>
        Constant: always worth the same: 4 for three Soldiers, 6 for three
        Humvees, 8 for three Tanks, 10 for a mixed set.
      </li>
      <li>
        Linear: each set played, by anyone, raises the value of the next set for
        everyone: 4, 6, 8, 10, 12, 15, 20, 25, 30, then +5 per further set.
      </li>
      <li>
        Exponential: each set played, by anyone, sharply raises the next
        set&apos;s value: starts at 5, then ×1.3 (rounded up) after every set.
      </li>
      <li>
        Linear Per Player: same as Linear, but each player has their own
        progression: playing a set only raises the value of your own next set.
      </li>
      <li>
        Exponential Per Player: same as Exponential, but each player has their
        own progression: playing a set only raises the value of your own next
        set.
      </li>
    </ul>
  </>
);

export const PLACEMENT_HELP = (
  <>
    How territories and starting troops are handed out at the start of the game.
    <ul className="mb-0 ps-3">
      <li>
        Random: territories and starting troops are both assigned randomly.
      </li>
      <li>
        Semi: territories are assigned randomly, but each player takes turns
        choosing where to place their starting troops.
      </li>
      <li>
        Custom: players take turns claiming territories one at a time, then take
        turns placing their starting troops. If there aren&apos;t enough
        territories for everyone, players who never get one are eliminated.
      </li>
    </ul>
  </>
);

export const FORTIFICATION_HELP = (
  <>
    Which territories troops can be moved between during the fortify phase.
    <ul className="mb-0 ps-3">
      <li>
        Connected: any two of your territories joined by a path of territories
        you own.
      </li>
      <li>Neighboring: only territories directly adjacent to each other.</li>
      <li>
        Unrestricted: any two of your territories, regardless of adjacency.
      </li>
    </ul>
  </>
);

export const PORTALS_HELP = (
  <>
    Whether the map has portals: pairs of territories linked as if they were
    neighbors, letting attacks and troop movements pass between any two
    territories that have one, no matter how far apart they are.
    <ul className="mb-0 ps-3">
      <li>Off: no portals.</li>
      <li>
        Static: a fixed number of portals (no two on adjacent territories) is
        placed at random when the game starts and never changes.
      </li>
      <li>
        Dynamic: the same number of portals is placed at the start, but they
        alternate every other round between active and disabled, moving to new
        random territories each time they go disabled.
      </li>
    </ul>
  </>
);

export const STARVATION_HELP = (
  <>
    Whether players are penalized for stacking too many troops on one territory.
    Either way, a territory&apos;s troops are never removed below 1.
    <ul className="mb-0 ps-3">
      <li>Off: no penalty.</li>
      <li>
        Territory: each territory is capped at 30 troops (shown in the players
        panel). At the end of each player&apos;s turn, any territory over the
        cap has its excess troops removed.
      </li>
      <li>
        Total: each player&apos;s total troops across all territories are capped
        at 3 times the map&apos;s territory count (shown in the players panel).
        At the end of each player&apos;s turn, troops over the cap are removed
        one at a time from whichever territory currently has the most.
      </li>
      <li>
        Percent: at the end of each player&apos;s turn, their largest army (the
        territory with the most troops) loses 30% of its troops.
      </li>
    </ul>
  </>
);

export const ENTRENCHMENTS_HELP = (
  <>
    Adds an extra phase after fortifying where you can spend troops straight off
    a territory to entrench it: 1 troop buys 1 turn of entrenchment, and an
    entrenched territory always defends with 3 dice. Entrenchment decreases by 1
    at the start of your next turn, and is lost if the territory is conquered.
    Capitals can&apos;t be entrenched.
    <ul className="mb-0 ps-3">
      <li>Off: no entrench phase.</li>
      <li>
        On: only available when Defence Dice is 2 (otherwise entrenchment would
        be redundant, since defenders already always roll 3).
      </li>
    </ul>
  </>
);

export const TOXINS_HELP = (
  <>
    Adds an extra phase after fortifying (and entrenching) where you can spend
    troops straight off a territory you own to release a toxin on it: it loses
    its owner, is wiped of every troop it held, and becomes inaccessible to
    everyone until the toxin clears. A territory can never be toxined if doing
    so would split the map into two or more disconnected groups, and capitals
    can&apos;t be toxined.
    <ul className="mb-0 ps-3">
      <li>Off: no toxins phase.</li>
      <li>
        Temporary: costs 5 troops (Constant cards) or 25% of the next card
        set&apos;s value, and clears itself after 3 turns; once cleared, the
        territory can be freely conquered by anyone with no dice roll.
      </li>
      <li>
        Permanent: costs 10 troops (Constant cards) or 50% of the next card
        set&apos;s value, and never clears for the rest of the game.
      </li>
    </ul>
  </>
);

export const RADIATIONS_HELP = (
  <>
    Whether the map has radiation: territories with no owner, no troops, and
    off-limits to everyone (not attackable, fortifiable, or selectable) until it
    clears. Radiation is placed before territories are dealt out, so dealt
    territories never include an irradiated one; radiation can never expand or
    move into a capital, or into a territory that would split the map into two
    or more disconnected groups. Any troops on a territory when radiation
    reaches it are destroyed, and losing a player&apos;s last territory this way
    eliminates them just like combat would.
    <ul className="mb-0 ps-3">
      <li>Off: no radiation.</li>
      <li>
        Static: a fixed number of territories are irradiated at the start and
        never change (1 per 10 territories on the map, capped at 8).
      </li>
      <li>
        Dynamic: the same territories, and the same count, as Static, but every
        2 rounds each one moves to a neighboring territory, clearing the one it
        left. The move is shown one round in advance.
      </li>
      <li>
        Expanding: a single territory is irradiated at the start, and every 2
        rounds it permanently grows to engulf one more neighboring territory,
        shown one round in advance.
      </li>
    </ul>
  </>
);

export const TURN_TROOPS_HELP = (
  <>
    Whether players get extra troops each turn on top of the normal deploy pool.
    <ul className="mb-0 ps-3">
      <li>Off: no extra troops.</li>
      <li>
        On: at the start of each turn, the player gets extra troops equal to the
        current turn number (1 on turn 1, 2 on turn 2, and so on).
      </li>
    </ul>
  </>
);

export const BOUNTIES_HELP = (
  <>
    Whether eliminating another player pays off in troops.
    <ul className="mb-0 ps-3">
      <li>Off: no bounty.</li>
      <li>
        On: each player you&apos;ve eliminated is worth a permanent +10 troops
        at the start of every one of your turns from then on.
      </li>
    </ul>
  </>
);

export const SUPPLY_LINES_HELP = (
  <>
    Whether troop placement is restricted by supply lines.
    <ul className="mb-0 ps-3">
      <li>Off: troops can be placed on any territory you own.</li>
      <li>
        On: troops can only be placed on a territory connected, by a path of
        territories you own, to one of your supply hubs. Your capitals (if you
        have any) are your hubs; otherwise your territory (or territories, if
        tied) with the most troops acts as your hub instead. This never affects
        troops a card set drops automatically.
      </li>
    </ul>
  </>
);

export const FOG_OF_WAR_HELP = (
  <>
    Whether players can only see part of the map.
    <ul className="mb-0 ps-3">
      <li>Off: every territory is fully visible to everyone.</li>
      <li>
        On: once capitals are placed (or turns begin), each player only sees
        territories they own and the territories adjacent to them. Everything
        else is hidden: gray on the map, and hidden as &quot;?&quot; in the
        players table. Actions entirely outside a player&apos;s view are not
        shown to them.
      </li>
    </ul>
  </>
);

export const ALLIANCES_HELP = (
  <>
    Whether players can form private alliances with each other.
    <ul className="mb-0 ps-3">
      <li>Off: no alliances; direct emojis can be sent to anyone.</li>
      <li>
        On: players can offer, accept, and terminate alliances with each other.
        Allies can always send each other direct emojis (others can&apos;t),
        and, with Fog Of War on, see each other&apos;s vision as if it were
        their own. Not available in Team Deathmatch, where teammates already get
        these benefits automatically.
      </li>
    </ul>
  </>
);

export const TURN_DURATION_HELP =
  "How long each player's turn can last. If time runs out, the game finishes it for them: leftover troops are dropped on random territories, any pending move is resolved automatically, and the turn ends.";

export const PASSWORD_HELP =
  'If set, players must enter this password to join. Players already in the game are unaffected by changing it, and it is never sent to any client.';

export const VISIBILITY_HELP = (
  <>
    Whether this game is listed in the home page.
    <ul className="mb-0 ps-3">
      <li>Public: shown in the home page&apos;s game list.</li>
      <li>
        Private: hidden from the home page&apos;s game list; still joinable by
        anyone with a direct link.
      </li>
    </ul>
  </>
);
