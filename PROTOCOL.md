# Server ↔ Client Protocol

This document lists every Socket.IO message exchanged between server and client, and must be followed by both sides — kept clear, precise, comprehensive, short, and up to date.

Every socket starts in the `home` room on connect. A player moves to a game's room (`game:create` / `game:join`) and can be moved back to `home` (kicked, or `player:identify` reporting `room: 'home'`).

### Player identity: `id` vs `key`

Each player known to the server has two distinct identifiers, plus a display name:

- **`id`** — a unique integer the server assigns the first time it sees a player. Safe to share — identifies them in every message to every client (roster entries, host, ban list, kick/unban targets). The client never chooses its own `id`.
- **`key`** — a unique random UUID the client generates and stores (in its cookie), never the server. It's a secret credential: whoever presents a given `key` in `player:identify` is treated as that player, and any other socket already holding that identity is disconnected. **The server must never send any player's `key` to any client, including that player's own socket.** The client learns its own `id` from the `player:identify` ack; it already has its own `key` and never learns anyone else's.
- **`name`** — a display string, not unique, freely chosen via `player:setName`. Must not be empty or all-whitespace — the server ignores it otherwise (see `player:identify` / `player:setName` below).

A player, once seen, stays in server memory (keyed by `id` and `key`) for as long as the server runs, connected or not — nothing is persisted, so a restart wipes it. This is what lets a reconnecting `key` always resume the same `id`.

### Leaving and reconnecting

Closing the tab, opening a new one, refreshing, or otherwise dropping the connection all disconnect the socket. Reconnecting (a fresh `player:identify`) with the same `key` resumes the same `id`; a different or new `key` is a different player — a new `id` who, per the seating rules below, can only ever join as a spectator.

What losing (and regaining) the socket does to a player's game membership depends on the game's `state`:
- **`lobby`**: a disconnect (or a mismatched-room `player:identify`, see below) removes the player entirely, same as leaving on purpose. If they held a slot, `hostId` is reassigned (see below) and the front queued spectator, if any, is promoted to fill it. Reconnecting afterward is just a fresh `game:join`.
- **`playing`**: nothing changes — slot, territories, and troops stay exactly as they were; only the socket drops. Reconnecting with the same `key` (any device) silently resumes that slot. If their turn comes up while away, it just runs out the clock and passes on (see `turnDuration` under `GameState` below), same as anyone taking too long.
- **`ended`**: like `playing`, a disconnect changes nothing. A mismatched-room `player:identify` (e.g. clicking the end page's "leave" button) clears the player's game membership, letting them rejoin later only as a spectator (see `state`/`winnerIds` under `GameState` below).

`game:surrender` is the one way to leave a `playing` game for good: slot, territories, and troops stay untouched just like a disconnect, but the player is permanently barred from that slot — reconnecting, or navigating back later, only ever seats them as a spectator.

Since `playing` games never lose a player this way, one where everyone has disconnected or surrendered would otherwise sit forever with no one able to act. So after every disconnect and every `game:surrender`, the server checks: if no player is both connected and not-surrendered, the game is destroyed immediately — turn timer stopped, every remaining player/spectator's membership cleared, and their socket (if still connected) moved back to `home`.

## Shared types

**GameSummary** (used in `home:games`)
```ts
{
  name: string;
  mapName: string;
  playerCount: number;
  slots: number;
  state: 'lobby' | 'playing' | 'ended';
  spectatorCount: number;
}
```

**GameState** (used in `game:state` and as the `game` field of every ack below)
```ts
{
  name: string;
  mapName: string;
  slots: number;
  hostId: number;
  state: 'lobby' | 'playing' | 'ended';
  gameMode: 'Supremacy' | 'Capitals' | 'Team Deathmatch';
  blitz: 'Balanced' | 'True';
  defenceDice: 2 | 3;
  cards: 'Fixed' | 'Progressive' | 'Exponential';
  turnDuration: 60 | 90 | 120 | 150 | 180 | 300; // seconds
  turnNumber: number;
  turnPlayerIndex: number;
  turnPhase: 'deploy' | 'attack' | 'fortify';
  troopsToDeploy: number;
  turnStartedAt: number; // ms since epoch
  selectedTerritoryId: number | null;
  fortifyStartTerritoryId: number | null;
  fortifyEndTerritoryId: number | null;
  attackStartTerritoryId: number | null;
  attackEndTerritoryId: number | null;
  attackConquestMinTroops: number | null;
  winnerIds: number[];
  nextSetBaseValues: { soldier: number; humvee: number; tank: number; mixed: number };
  players: { id: number; name: string; team: number; color: number; territoryCount: number; troopCount: number; cardCount: number; connected: boolean; surrendered: boolean; eliminated: boolean }[];
  spectators: { id: number; name: string }[];
  bannedPlayers: { id: number; name: string }[];
  territories: { id: number; ownerId: number; troops: number }[];
}
```
`hostId` is the id of the game's current host — the only player who may call `game:settings` or `game:start`. The server recomputes it whenever it might need to change (a leave, kick, join, or reconnect) from the game's host-priority list — every player who's ever held a seat, in the order they first got one, never reordered or shortened by a leave — picking the first one still seated, connected, and not surrendered (see "Leaving and reconnecting" above, `game:surrender` below). So host passes to the next eligible player when the current one disconnects or leaves, and passes back the moment a higher-priority former host reconnects, cascading through however many stand-ins came in between. If no players remain, the game is deleted.

Once `game:start` succeeds, `turnNumber` counts full rounds completed (starts at `0`); `turnPlayerIndex` indexes `players` for whoever's turn it is; `turnPhase` is that player's progress — `'deploy'`, `'attack'`, `'fortify'`, in order. Only the player at `turnPlayerIndex` may advance it, via `game:nextPhase`; completing `'fortify'` instead ends the turn, advancing to the next player (`turnPlayerIndex + 1`, wrapping to `0` and incrementing `turnNumber` each time `0` is passed) and resetting `turnPhase` to `'deploy'` — an eliminated player (`territoryCount === 0`) is always skipped over, so `turnPlayerIndex` only ever lands on someone who still owns at least one territory. `turnDuration` is a hard limit on the whole turn (all three phases, not reset between them) — if the current player hasn't finished in time, the server force-advances exactly as `game:nextPhase` would from `'fortify'`. Before doing so, it completes whichever action the cut-off phase left unfinished: in `'deploy'`, any remaining `troopsToDeploy` are dropped one at a time on random territories the player owns, and then — same as a player who never gets to act at all — a 5+-card hand keeps auto-playing its single best set (highest value, ties broken by fewest wilds; see "Territory cards" above) and dropping the troops it grants the same random way, until the hand is back under 5; in `'attack'`, a pending conquest (`attackConquestMinTroops` non-`null`) is resolved by moving the minimum number of troops it allows, exactly as `game:attackMove` would; in `'fortify'`, a selection with both `fortifyStartTerritoryId` and `fortifyEndTerritoryId` set moves exactly `1` troop. Any other in-progress selection (a lone attack or fortify start territory, or an attack with both territories selected but no conquest pending) is simply discarded. Every territory this touches is still broadcast as `game:deployed`/`game:deployedMany`/`game:attackMoved`/`game:fortified` (see below) exactly as if the player had acted manually, so clients play the same sounds and animations either way. This also covers a disconnected player: `players`/`turnPlayerIndex` are unaffected by leaving a `playing` game (see "Leaving and reconnecting" above), so an absent turn just runs out the clock. `turnStartedAt` is when the current player's turn began (server clock, ms since epoch) — it only changes alongside `turnNumber`/`turnPlayerIndex`, not between phases, so every client (including one that just connected or reconnected mid-turn) can derive the same remaining time from it instead of trusting local state. Both `turnNumber` and `turnPhase` sit inert (`0`/`'deploy'`) in the `lobby` state, with `turnStartedAt` at `0`.

`'deploy'` is the one phase `game:nextPhase` cannot advance (`cannot skip deploy phase`) — it only ends once the current player has placed every troop available that turn, via `game:deploy` (see below). Entering `'deploy'` (turn start, or the timer force-advancing from `'fortify'`) silently grants the player a troop pool: `max(3, floor(territoryCount / 3))`, plus, for every continent where they own every territory, that continent's entry in the map's `bonuses` array. `troopsToDeploy` is that pool, decremented as the player calls `game:deploy`; it sits at `0` outside `'deploy'` and in the `lobby` state.

`'attack'` and `'fortify'` are each skipped automatically, the instant they'd otherwise begin, if the player has no legal move in them: `'attack'` needs some owned territory with more than `1` troop next to an enemy one; `'fortify'` needs some owned territory with more than `1` troop next to another territory the same player owns. This is re-checked (and skipped past again if it still doesn't hold) every time entering the phase would otherwise happen — after `'deploy'` ends, after every `game:attack` that doesn't leave a conquest pending, after every `game:attackMove`, and after `game:fortify`/timeout would normally hand off to the next phase — so a player can never be left stuck in a phase with nothing legal to do in it. Clients are expected to mirror this check locally (independently of whatever the server has already done) and call `game:nextPhase` themselves the moment they detect it, as a redundant safety net rather than the source of truth — the server's own skip always wins.

### Territory cards

At `game:start`, the server builds a deck of one card per territory (`territoryId` 0 to the map's territory count − 1, displayed 1-based to the user) plus two wild cards (`territoryId: null`), and deals none of it out. This deck, and every player's hand, live only on the server — no `game:state` field ever exposes them. Each non-wild card carries a `symbol`: `'soldier'`, `'humvee'`, or `'tank'`, distributed as evenly as the territory count allows across the three (any leftover after an even three-way split gets a random symbol each); wild cards have `symbol: null`. A player's own hand is pushed to them individually (see `game:cards` below) whenever it changes; every client sees only `cardCount` per player in `GameState.players`.

Whenever the current player's `'fortify'` phase concludes (via `game:fortify`, a `game:nextPhase` call that ends it, or the turn timer force-ending it) and that player conquered at least one territory during the turn's `'attack'` phase, they're dealt one random card from the deck as their turn ends.

A **set** is any 3 cards forming 3-of-a-kind (same symbol) or one of each symbol; a wild card stands in for whatever symbol a set still needs. `nextSetBaseValues` gives the troop bonus the *next* set played would earn for each possible composition — under `cards: 'Fixed'` these are permanently `{ soldier: 4, humvee: 6, tank: 8, mixed: 10 }`; under `'Progressive'`, all four equal a single value that climbs with a game-wide count of sets already played (by anyone), following `4, 6, 8, 10, 12, 15, 20, 25, 30`, then `+5` per further set; under `'Exponential'`, all four equal a single value starting at `5` for the game's first set and, for each set after, `ceil(previous × 1.3)`. During `'deploy'`, playing a set (`game:playCardSet`) adds its value to `troopsToDeploy` for the caller to place normally, and additionally — for any card in the set whose territory the caller currently owns — immediately adds 2 troops straight onto that territory (not drawn from `troopsToDeploy`, see `game:deployed` below).

Because playing a set only requires deploy phase and never costs the player anything but the cards, `'deploy'` no longer always ends the instant `troopsToDeploy` reaches `0`: it only auto-advances to `'attack'` if the player *cannot* currently form any valid set from their hand. If they can, they stay in `'deploy'` — free to play the set, ignore it, or (once `troopsToDeploy` is back at `0` again) explicitly move on via `game:nextPhase`. The one exception is a hand of `5` or more cards: `game:nextPhase` refuses to leave `'deploy'` (`must play a card set`) until a set is played and the hand drops below `5` — which, by construction, is always possible from `5+` cards.

Whenever an attack (see `game:attack` below) eliminates a player (their `territoryOwners` count drops to `0`), the attacker immediately receives the eliminated player's entire hand. If that leaves the attacker with `5` or more cards, their pending conquest move resolves automatically at the minimum troop count (as the turn timer would), `turnPhase` snaps back to `'deploy'` for the rest of their turn, and — if less than 50% of their `turnDuration` remains — `turnStartedAt` is rewound so exactly 50% remains.

`selectedTerritoryId` is the territory the player at `turnPlayerIndex` currently has selected (`null` if none), set via `game:selectTerritory` — it's part of `GameState` so every client, not just the selecting player, sees the same selection highlighted on the map. It resets to `null` whenever the turn or phase changes (including the automatic `'deploy'` → `'attack'` advance) and whenever a `game:deploy` succeeds, regardless of whether the player's troop pool is now empty.

`fortifyStartTerritoryId` and `fortifyEndTerritoryId` track the two-step territory selection specific to the `'fortify'` phase, set via `game:fortifySelectStart` / `game:fortifySelectEnd` below (both `null` outside an in-progress fortify selection). Like `selectedTerritoryId`, they're part of `GameState` so every client sees the same start/end highlighting and, once both are set, the same animated arrow between them — `game:selectTerritory` is not used during `'fortify'`. Both reset to `null` whenever the turn or phase changes and whenever a `game:fortify` succeeds.

`attackStartTerritoryId` and `attackEndTerritoryId` track the same kind of two-step selection for the `'attack'` phase, set via `game:attackSelectStart` / `game:attackSelectEnd` below (both `null` outside an in-progress attack). Unlike fortify, they are **not** cleared once `game:attack` resolves an attack that fails to fully conquer the defending territory — nor once it does (`game:selectTerritory` is not used during `'attack'`, either). A failed or inconclusive attack (defender still owns the territory afterward) resets both to `null`, letting the player pick a fresh attack. A conquering attack (defender's territory reaches `0` troops) instead transfers `territoryOwners` for `attackEndTerritoryId` to the attacker immediately but leaves both ids set and populates `attackConquestMinTroops` — the game is now waiting on `game:attackMove` to finish moving troops in, and no other attack-phase action (including `game:nextPhase`) is accepted until it does. `attackConquestMinTroops` is `null` whenever no conquest is pending. All three reset to `null` whenever the turn or phase changes.

`team` is only meaningful when `gameMode` is `'Team Deathmatch'` — it always defaults to `0` otherwise and is ignored by the client. Its valid range is `0` to `max(0, players.length - 1)`, one value per player, so team counts from a single shared team up to every player on their own team are all valid. The client displays teams 1-based (`team + 1`); the wire value stays 0-based.

`color` is an index into a 20-entry palette the client owns — the server sends only the index, never actual color values. Assigned at random when seated (`game:create`, `game:join`, spectator promotion), always unique among current players. To keep early joiners' colors nicer (palette ordered nicest-first), both random assignment and `game:cycleColor` are restricted to the first `min(20, players.length + 3)` indices. Spectators have no color.

`territoryCount` and `troopCount` are the number of territories the player currently controls and the total troops on them; both are `0` until the game starts. Once `game:start` succeeds, `players` is reordered into the game's randomized turn order and stays that way for the rest of the game.

`connected` is whether the player currently has a live socket anywhere on the server (not necessarily this game's room — see "Leaving and reconnecting" above). `surrendered` is whether they've called `game:surrender` on this game; they're typically still `connected` (surrendering doesn't disconnect them) but can never be seated in it again. Both are informational only — an absent player's territories, troops, and turn are still tracked exactly like anyone else's.

`eliminated` is `true` once the player owns zero territories (`territoryCount === 0`), and always `false` in the `lobby` state, before territories are dealt. An eliminated player is skipped over in turn order (see `turnPlayerIndex` above) and rejected by every other `game:*` action that requires owning a territory — which, having none, is all of them — plus `game:surrender` (`already eliminated`); `game:chat` is unaffected. They keep receiving `game:state` like anyone else, so they can keep watching the game play out.

`territories` is empty until the game starts; once `playing`, it lists every territory on the map with its current owner (`ownerId`, a player's `id`) and troop count.

The server checks for the end of the game every time a territory is conquered (see `game:attack` below). In `Supremacy` and `Capitals` (the latter falls back to `Supremacy`'s end condition for now), the game ends the moment a single player owns every territory. In `Team Deathmatch`, it ends the moment every territory is owned by players on a single team. Either way, `state` moves to `'ended'`, `winnerIds` is set to that player's id (or every player id on the winning team), and the turn timer stops; `turnPhase`/`selectedTerritoryId`/`fortifyStartTerritoryId`/`fortifyEndTerritoryId`/`attackStartTerritoryId`/`attackEndTerritoryId`/`attackConquestMinTroops` reset exactly as they do on a normal turn change. `winnerIds` is empty while the game is `lobby` or `playing`. No further `game:*` actions are accepted once `state` is `'ended'` (they all require `'playing'`) — the game just sits, still joinable as a spectator (see `game:join` below), until everyone still viewing it (players and spectators alike, going by `connected` and current game membership) has navigated away, at which point the server deletes it — same as `home:games` no longer listing it, and its room being torn down.

Players who couldn't be seated (lobby full, game already `playing`, or they'd previously surrendered from it) become **spectators**: same room, full `game:state` visibility, no roster slot, no gameplay actions. In the `lobby` state, spectators are an ordered queue (`spectators[0]` next in line) — if a seated player leaves, the front spectator is promoted automatically. Nothing promotes spectators once `playing`, and leaving (or disconnecting from) a `playing` game never frees a seat — see "Leaving and reconnecting" above.

**Ack response** — `game:create`, `game:join`, `game:settings`, `game:start`, `game:cycleColor`, `game:nextPhase`, and `game:surrender` all reply via the Socket.IO acknowledgement callback with:
```ts
{ ok: true; game: GameState } | { ok: false; error: string }
```

---

## Client → Server

### `player:identify`
- **When sent:** once, immediately after connecting; re-sent on every reconnect (new tab, reload, dropped connection); and re-sent whenever the client's own declared room changes — e.g. after creating/joining a game, navigating back to `/`, or navigating directly to a different game's URL.
- **Purpose:** register this socket against a persistent player identity, and declare which room the client believes it's in — `'home'` or a game name. The server uses this to place the socket correctly and to detect stale membership: if `room` doesn't match its record (e.g. another tab is still in a game but this one reports `'home'`), it updates their game membership accordingly (see "Leaving and reconnecting" above). A reconnect also re-checks `hostId` for whatever game the player is in, in case a former host is due back (see `hostId` above).
- **Content:**
  ```ts
  { playerKey: string; playerName: string; room: string }
  ```
  `playerName` only sets the name the first time a `playerKey` is seen (player creation) — later identifies (reconnects, tab duplicates) ignore it, since renaming is `player:setName`'s job. If it's empty, all-whitespace, or over 10 characters (trimmed) at creation, the server assigns a default name instead.
- **Ack:**
  ```ts
  { id: number }
  ```
  The caller's own `id` — assigned once, the first time the server sees this `playerKey`, and stable for as long as the player exists on the server.

### `player:setName`
- **When sent:** any time the player changes their display name (their `playerKey` never changes).
- **Purpose:** update the stored name for the identified player. If `name` is empty, all-whitespace, or longer than 10 characters (after trimming), the message is ignored and the stored name is left unchanged.
- **Content:**
  ```ts
  { name: string }
  ```
- **Ack:** none

### `game:create`
- **When sent:** a player in `home` starts a new game.
- **Purpose:** create a game with default settings — name `Game with <playerName>` unless `name` is given, map `World`, 2 slots, `Supremacy` game mode, `Balanced` blitz, 2 defence dice, `Fixed` cards, 120s turn duration — make the caller host and move their socket into the room.
- **Content:**
  ```ts
  { name?: string } // same validation as game:settings' name field; defaults to `Game with <playerName>` when omitted
  ```
- **Ack:** shared Ack response. Errors: `not identified`, `already in a game`, `invalid name`, `game name already in use`.

### `game:join`
- **When sent:** a player in `home` joins a game from the list, or navigates straight to a game's URL without joining from `home` first (sent right after `player:identify`, once per such navigation). In the URL-navigation case, if the ack comes back `game not found`, the client falls back to `game:create` with that name (see `game:create` above) to create the game at that URL; if that in turn fails with `game name already in use` (another client won the race), the client retries `game:join` once more.
- **Purpose:** add the caller to the game and move their socket into its room. If the game is still `lobby` with an open slot, they become a player; otherwise (full lobby, already `playing`, or `ended`) they become a spectator — this call never fails just because the game is full, in progress, or over.
- **Content:**
  ```ts
  { gameName: string }
  ```
- **Ack:** shared Ack response. Errors: `not identified`, `already in a game`, `game not found`, `banned from this game`.

### `game:settings`
- **When sent:** the host of a game changes any settings.
- **Purpose:** single bundled message for every settings mutation: rename, change map, slot count, ban list, a player's team, game mode / dice randomness / defence dice / cards / turn duration. Only the fields present are applied; the caller must be host, and the game must still be `lobby` — nothing can change once `playing`. Fields apply in a fixed order — `mapName`, `gameMode`, `name`, `bannedPlayerIds`, `playerTeam`, `slots`, `diceRandomness`, `defenceDice`, `cards`, `turnDuration` — so `slots`/`playerTeam` are validated against the roster *after* any kicks in the same request. `gameMode` and the last four fields are independent of the rest and each other; their position otherwise doesn't matter.
- **Content:** (all fields optional — only send what changed)
  ```ts
  {
    name?: string;              // trimmed; empty, all-whitespace, over 20 characters, or the reserved name `home` is rejected
    mapName?: string;
    slots?: number;            // 2–20, and never below the player count once bannedPlayerIds (if present) has been applied
    bannedPlayerIds?: number[]; // replaces the game's entire ban list
    playerTeam?: { playerId: number; team: number };
    gameMode?: 'Supremacy' | 'Capitals' | 'Team Deathmatch';
    blitz?: 'Balanced' | 'True';
    defenceDice?: 2 | 3;
    cards?: 'Fixed' | 'Progressive' | 'Exponential';
    turnDuration?: 60 | 90 | 120 | 150 | 180 | 300; // seconds
  }
  ```
  `bannedPlayerIds` replaces the whole ban list at once, not one id at a time — to kick, send the current `bannedPlayers` ids (from `game:state`) plus the new one; to unban, send them minus the id. Any newly-present id belonging to a current player or spectator is kicked (evicted, sent `game:kicked`); the host's own id is silently dropped rather than self-banning.

  `playerTeam` sets one player's `team` (see `GameState.players` above for its valid range); rejected with `invalid team` unless `playerId` is currently a player (not a spectator) and `team` is an integer within that range.
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `not the host`, `game already started`, `invalid name`, `invalid map`, `invalid slots`, `invalid banned players`, `invalid team`, `invalid game mode`, `invalid blitz`, `invalid defence dice`, `invalid cards`, `invalid turn duration`, `game name already in use`.

### `game:cycleColor`
- **When sent:** a player clicks their own color in the lobby's player table.
- **Purpose:** change the caller's own `color` to the next available one; unlike `game:settings`, no host privileges needed since players only change their own color. Starting from the caller's current index, the server walks forward (wrapping) through the same restricted range described under `color` above, stopping at the first one unused by another player. The caller must be a seated player (not spectator), and the game must still be `lobby` — colors can't change once playing.
- **Content:** none
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `not a player`, `game already started`.

### `game:start`
- **When sent:** the host of a game starts it from the lobby.
- **Purpose:** move the game from `lobby` to `playing`, switching every client from the Lobby subpage to the Map subpage. The caller must be host, with at least 2 players; if `gameMode` is `'Team Deathmatch'`, at least 2 distinct teams must be represented among them too. If it is `'Team Deathmatch'`, `team` values are also compacted to remove gaps left by the host skipping numbers (e.g. teams `0` and `2` but no `1` become `0` and `1`), preserving their relative order. Player order (`players`) is then set at random to establish turn order — plain random shuffle normally, but for `'Team Deathmatch'` it's randomized *and* interleaved so two teammates never end up back-to-back (wrapping from the last player to the first counts too) unless a team's size makes that unavoidable, in which case it's kept to the minimum number of forced adjacencies. The map's territories are then dealt out as evenly as possible — if they don't divide evenly, the last players in turn order get one extra each. Each player's territories start with 1 troop each, plus `territoryCount * 2` more dropped one at a time on random territories they own. Turn tracking starts here too: `turnNumber`/`turnPlayerIndex` set to `0`, `turnPhase` to `'deploy'`, and the server begins counting the first player's `turnDuration` (see `turnNumber` above).
- **Content:** none
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `not the host`, `already started`, `not enough players`, `not enough teams`.

### `game:nextPhase`
- **When sent:** the player whose turn it currently is finishes a phase (`attack` or `fortify`) and is ready to move on.
- **Purpose:** advance `turnPhase` to the next phase in order; completing `'fortify'` instead ends the turn (see `turnNumber` above). The caller must be the player at `turnPlayerIndex`, and the game must be `playing`. Cannot be used to leave `'deploy'` while `troopsToDeploy` is above `0`, or while the caller holds `5` or more cards (see "Territory cards" above). Cannot be used to leave `'attack'` while a conquest is pending (`attackConquestMinTroops` non-`null`) — that must be resolved via `game:attackMove` first.
- **Content:** none
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `game not started`, `not your turn`, `cannot skip deploy phase`, `must play a card set`, `pending conquest move`.

### `game:selectTerritory`
- **When sent:** the player whose turn it currently is clicks one of their selectable territories on the map, or deselects the current one.
- **Purpose:** set (or clear, with `territoryId: null`) `selectedTerritoryId` so every client — not just the caller — sees the same territory highlighted. The caller must be the player at `turnPlayerIndex`, and the game must be `playing`. A non-`null` `territoryId` must belong to some player; during `'deploy'` it must additionally be owned by the caller (other phases don't yet restrict this — see `turnPhase` above).
- **Content:**
  ```ts
  { territoryId: number | null }
  ```
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `game not started`, `not your turn`, `invalid territory`, `territory not owned`.

### `game:deploy`
- **When sent:** the player whose turn it currently is, during `'deploy'`, places some of their troop pool (see `turnPhase` above) on one of their own territories.
- **Purpose:** add `troops` to `territoryId`'s troop count and deduct them from the caller's remaining pool for the turn, clearing `selectedTerritoryId` in the process. Once the pool reaches `0`, the server auto-advances `turnPhase` to `'attack'` (same as a `game:nextPhase` call would) unless the caller can currently play a card set, in which case `turnPhase` stays `'deploy'` (see "Territory cards" above). The caller must be the player at `turnPlayerIndex`, the game must be `playing` and in `'deploy'`, `territoryId` must be owned by the caller, and `troops` must be an integer from `1` up to the caller's remaining pool.
- **Content:**
  ```ts
  { territoryId: number; troops: number }
  ```
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `game not started`, `not your turn`, `not deploy phase`, `territory not owned`, `invalid troops`.

### `game:playCardSet`
- **When sent:** the player whose turn it currently is, during `'deploy'`, plays 3 cards from their own hand as a set.
- **Purpose:** validate and resolve a set (see "Territory cards" above): remove the 3 cards from the caller's hand and return them to the deck, add the set's base value (per `nextSetBaseValues`) to `troopsToDeploy`, and add 2 troops directly to any of the 3 cards' territories the caller currently owns (each such territory also gets a `game:deployed` broadcast, see below). The caller must be the player at `turnPlayerIndex`, and the game must be `playing` and in `'deploy'`. `cards` must reference exactly 3 cards actually in the caller's hand — a `territoryId` for a specific non-wild card, or `null` for "any wild card" (so two `null`s require two wild cards in hand) — forming a valid set (3-of-a-kind or one of each symbol, wilds filling in); the server, never the client, decides the resulting value and territory bonuses.
- **Content:**
  ```ts
  { cards: (number | null)[] } // exactly 3 entries
  ```
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `game not started`, `not your turn`, `not deploy phase`, `invalid cards`, `invalid set`.

### `game:fortifySelectStart`
- **When sent:** the player whose turn it currently is, during `'fortify'`, clicks one of their candidate start territories on the map, or cancels the in-progress fortify selection (clicking/right-clicking outside it, or pressing Escape).
- **Purpose:** set (or clear, with `territoryId: null`) `fortifyStartTerritoryId`, clearing `fortifyEndTerritoryId` in the same call. A candidate start territory must be owned by the caller, have at least 2 troops, and have at least one neighboring territory also owned by the caller — the client computes candidacy itself (for highlighting/hover), but the server independently re-checks it here. The caller must be the player at `turnPlayerIndex`, and the game must be `playing` and in `'fortify'`.
- **Content:**
  ```ts
  { territoryId: number | null }
  ```
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `game not started`, `not your turn`, `not fortify phase`, `invalid territory`, `territory not owned`, `invalid start territory`.

### `game:fortifySelectEnd`
- **When sent:** the player whose turn it currently is, during `'fortify'` with `fortifyStartTerritoryId` already set, clicks one of the candidate end territories on the map.
- **Purpose:** set `fortifyEndTerritoryId`. A candidate end territory must be owned by the caller, different from `fortifyStartTerritoryId`, and reachable from it through a path of territories all owned by the caller (as with the start territory, the client computes this for highlighting and the server re-checks it). The caller must be the player at `turnPlayerIndex`, and the game must be `playing` and in `'fortify'`.
- **Content:**
  ```ts
  { territoryId: number }
  ```
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `game not started`, `not your turn`, `not fortify phase`, `no start territory selected`, `invalid territory`, `territory not owned`, `invalid end territory`.

### `game:fortify`
- **When sent:** the player whose turn it currently is, during `'fortify'` with both `fortifyStartTerritoryId` and `fortifyEndTerritoryId` set, confirms the troop movement from the fortify panel (its confirm button, or Enter).
- **Purpose:** move `troops` from `fortifyStartTerritoryId` to `fortifyEndTerritoryId`, then immediately end the turn — same as completing `'fortify'` via `game:nextPhase` (see `turnNumber` above) — since only one movement is allowed per fortify phase. The caller must be the player at `turnPlayerIndex`, the game must be `playing` and in `'fortify'` with both fortify territories selected, and `troops` must be an integer from `1` up to the start territory's current troop count minus `1` (at least 1 troop always stays behind).
- **Content:**
  ```ts
  { troops: number }
  ```
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `game not started`, `not your turn`, `not fortify phase`, `no fortify selection`, `invalid troops`.

### `game:attackSelectStart`
- **When sent:** the player whose turn it currently is, during `'attack'`, clicks one of their candidate attacking territories on the map, or cancels the in-progress attack selection (clicking/right-clicking outside it, or pressing Escape) — only while no conquest is pending (see `attackConquestMinTroops` above).
- **Purpose:** set (or clear, with `territoryId: null`) `attackStartTerritoryId`, clearing `attackEndTerritoryId` and `attackConquestMinTroops` in the same call. A candidate attacking territory must be owned by the caller, have more than 1 troop, and have at least one neighboring territory owned by a different player — the client computes candidacy itself (for highlighting/hover), but the server independently re-checks it here. The caller must be the player at `turnPlayerIndex`, the game must be `playing` and in `'attack'`, and no conquest may currently be pending.
- **Content:**
  ```ts
  { territoryId: number | null }
  ```
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `game not started`, `not your turn`, `not attack phase`, `pending conquest move`, `invalid territory`, `territory not owned`, `invalid start territory`.

### `game:attackSelectEnd`
- **When sent:** the player whose turn it currently is, during `'attack'` with `attackStartTerritoryId` already set, clicks one of the candidate defending territories on the map.
- **Purpose:** set `attackEndTerritoryId`, and compute the blitz win probability of every troop count the attack panel can offer, all in one response so the client never has to ask again while the panel is open. Regular attacks (1–3 troops) have no probability computed or sent — a regular attack is a single dice exchange with no meaningful "chance of winning the territory" the way a blitz has, so the panel shows no percentage for those options. A candidate defending territory must be owned by a different player than the caller and be a neighbor of `attackStartTerritoryId` — the client computes this for highlighting, the server re-checks it here. The caller must be the player at `turnPlayerIndex`, and the game must be `playing` and in `'attack'` with a start territory already selected.
- **Content:**
  ```ts
  { territoryId: number }
  ```
- **Ack:** unlike other calls, this one is not the shared Ack response — it carries the computed probabilities alongside it:
  ```ts
  | {
      ok: true;
      game: GameState;
      blitzWinProbabilities: number[]; // index i = probability of winning with i+1 troops via blitz (trueWinProb or balancedWinProb, chosen by the game's blitz setting), length attacking territory's troops − 1
    }
  | { ok: false; error: string }
  ```
  Errors: `not in a game`, `game not found`, `game not started`, `not your turn`, `not attack phase`, `no start territory selected`, `invalid territory`, `invalid end territory`.

### `game:attack`
- **When sent:** the player whose turn it currently is, during `'attack'` with both attack territories selected, confirms an attack option from the attack panel (its confirm button, or Enter).
- **Purpose:** resolve one battle between `attackStartTerritoryId` and `attackEndTerritoryId`. For `type: 'regular'`, `troops` (1–3, capped at the attacking territory's troops − 1) fight exactly one exchange via `attack()` in `dice.ts`, the defending territory rolling `min(its troops, defenceDice)` dice, and the raw dice results are returned (see Ack below) so the client can animate the roll. For `type: 'blitz'`, `troops` (1 up to the attacking territory's troops − 1) fight to elimination of one side via `trueBlitz()` or `balancedBlitz()` (chosen by the game's `blitz` setting). Losses on both sides are applied immediately. If the defending territory's troops reach `0`, it's conquered: ownership transfers to the caller right away, the end-of-game check described under `GameState.territories` above runs immediately (possibly moving `state` to `'ended'`, in which case nothing further below in this paragraph happens), and otherwise `attackConquestMinTroops` is set to `min(troops used, 3, remaining attacking-territory troops − 1)` with both attack territory ids left set awaiting `game:attackMove` — unless the conquest eliminated the defender (see "Territory cards" above for the card transfer and its side effects), in which case a `5+`-card attacker instead has that pending move resolved immediately and lands back in `'deploy'`. Otherwise, if the attacking territory still has more than 1 troop left, both attack territory ids are left set (so the attack panel stays open against the same defending territory) and blitz win probabilities are recomputed for the reduced troop counts; if it's down to 1 troop (can't attack again), both reset to `null` instead. The caller must be the player at `turnPlayerIndex`, the game must be `playing` and in `'attack'` with both territories selected, and no conquest may already be pending.
- **Content:**
  ```ts
  { type: 'regular'; troops: 1 | 2 | 3 } | { type: 'blitz'; troops: number }
  ```
- **Ack:** like `game:attackSelectEnd`, not the shared Ack response — it carries fresh blitz win probabilities (empty when the battle was conquered, or when the attacking territory can no longer attack) plus the dice actually rolled (both empty for `type: 'blitz'`, since blitz doesn't animate a roll):
  ```ts
  | {
      ok: true;
      game: GameState;
      blitzWinProbabilities: number[];
      attackerDice: number[];
      defenderDice: number[];
    }
  | { ok: false; error: string }
  ```
  Errors: `not in a game`, `game not found`, `game not started`, `not your turn`, `not attack phase`, `no attack selection`, `territory already conquered`, `invalid attack type`, `invalid troops`.

### `game:attackMove`
- **When sent:** the player whose turn it currently is, during `'attack'` with a conquest pending (`attackConquestMinTroops` non-`null`), confirms how many troops to move into the just-conquered territory from the attack panel.
- **Purpose:** move `troops` from `attackStartTerritoryId` to `attackEndTerritoryId`, then clear both attack territory ids and `attackConquestMinTroops`, ending this attack. The caller must be the player at `turnPlayerIndex`, the game must be `playing` and in `'attack'` with a conquest pending, and `troops` must be an integer from `attackConquestMinTroops` up to the attacking territory's current troops − 1.
- **Content:**
  ```ts
  { troops: number }
  ```
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `game not started`, `not your turn`, `not attack phase`, `no pending conquest`, `invalid troops`.

### `game:surrender`
- **When sent:** a seated player in a `playing` game gives up.
- **Purpose:** permanently give up the caller's seat for rejoining purposes, and move their socket back to `home`. Slot, territories, and troops stay exactly as they were — same as any other player leaving a `playing` game (see "Leaving and reconnecting" above) — so the game carries on unaffected; the only difference from an ordinary disconnect is that this player can now only ever rejoin as a spectator.
- **Content:** none
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `game not started`, `not a player`, `already eliminated`.

### `maps:list`
- **When sent:** once, immediately after the socket connects; re-sent any time the client reconnects. Sent as a request/ack rather than the server pushing it unprompted, so the client can't miss it by registering its handler a moment too late.
- **Purpose:** ask the server which map names are available to choose from (e.g. for the host's map-select control in `game:settings`).
- **Content:** none
- **Ack:**
  ```ts
  string[]
  ```

### `game:chat`
- **When sent:** a player or spectator sends a chat message.
- **Purpose:** relay a chat message to everyone (players and spectators alike) currently in the same game. Silently ignored if the sender isn't currently in a game, or if `message` is empty or all-whitespace.
- **Content:**
  ```ts
  { message: string }
  ```
- **Ack:** none

---

## Server → Client

### `home:games`
- **When sent:** once per second, to every socket currently in the `home` room.
- **Purpose:** keep the lobby's list of joinable games current.
- **Content:**
  ```ts
  GameSummary[]
  ```

### `game:state`
- **When sent:** once per second, to every socket currently in a given game's room.
- **Purpose:** keep everyone in a game synced on its settings, roster, ban list, and (once `playing`) turn progress (including for the host's own settings UI, and so clients can offer an "unban" action from `bannedPlayers`).
- **Content:**
  ```ts
  GameState
  ```

### `game:cards`
- **When sent:** once per second, individually to each seated player's own socket (never broadcast to the room), for as long as the game is `playing` — including before they've been dealt their first card, so the hand (empty or not) is always current (see "Territory cards" above).
- **Purpose:** let a player see their own territory cards — the only place this ever reaches a client; `GameState` never includes any player's actual cards, only `cardCount`.
- **Content:**
  ```ts
  { cards: { territoryId: number | null; symbol: 'soldier' | 'humvee' | 'tank' | null }[] }
  ```

### `game:kicked`
- **When sent:** immediately, only to the socket of the player or spectator who was just kicked.
- **Purpose:** tell that client it has been removed and banned from the game, so it can leave the game view. The server has already moved that socket back to `home`.
- **Content:**
  ```ts
  { gameName: string }
  ```

### `game:chatMessage`
- **When sent:** immediately, to every socket in a game's room, whenever a player or spectator sends `game:chat` (including back to the sender).
- **Purpose:** deliver a chat message to everyone currently in the game.
- **Content:**
  ```ts
  { id: number; name: string; message: string }
  ```

### `game:deployed`
- **When sent:** immediately, to every socket in a game's room, whenever a `game:deploy` call succeeds (including back to the deploying player), and once per territory for a `game:playCardSet` call's automatic 2-troop territory bonuses (see "Territory cards" above).
- **Purpose:** let every client play the deploy sound effect in sync, rather than inferring it from the next `game:state` tick.
- **Content:**
  ```ts
  { territoryId: number; troops: number }
  ```

### `game:deployedMany`
- **When sent:** immediately, to every socket in a game's room, whenever the turn timer force-completes an unattended `'deploy'` phase and it touched at least one territory (see `turnDuration` above) — covering both the leftover troop pool and any troops granted by auto-played card sets, as one batch.
- **Purpose:** let every client play the deploy sound effect exactly once for the whole batch, while still animating every territory that received troops — instead of either replaying the sound per territory or inferring the change from the next `game:state` tick.
- **Content:**
  ```ts
  { deposits: { territoryId: number; troops: number }[] }
  ```

### `game:fortified`
- **When sent:** immediately, to every socket in a game's room, whenever a `game:fortify` call succeeds (including back to the moving player), or the turn timer force-completes a pending `'fortify'` move.
- **Purpose:** let every client play the fortify sound effect and the deploy animation on the destination territory in sync, rather than inferring it from the next `game:state` tick.
- **Content:**
  ```ts
  { territoryId: number; troops: number }
  ```

### `game:attacked`
- **When sent:** immediately, to every socket in a game's room, whenever a `game:attack` call resolves a battle (including back to the attacking player).
- **Purpose:** let every client play the explosion sound effect and animation on whichever side(s) lost troops, in sync, rather than inferring it from the next `game:state` tick. `attackerId` and `defenderId` are the owners of the two territories at the moment of the attack (`defenderId` in particular is captured before a conquering attack transfers ownership) — so a client can color each side's troop-loss number with the right player's color even for the conquered territory. `type` echoes the `game:attack` call's own `type` — the client uses it to delay the explosion until its dice-roll animation (`type: 'regular'` only) finishes, so the explosion lands right as the dice settle instead of overlapping them.
- **Content:**
  ```ts
  {
    attackingTerritoryId: number;
    defendingTerritoryId: number;
    attackerId: number;
    defenderId: number;
    attackLosses: number;
    defenceLosses: number;
    conquered: boolean;
    type: 'regular' | 'blitz';
  }
  ```

### `game:attackMoved`
- **When sent:** immediately, to every socket in a game's room, whenever a `game:attackMove` call succeeds (including back to the moving player), or the turn timer force-completes a pending conquest move.
- **Purpose:** let every client play the fortify sound effect and the deploy animation on the newly-conquered territory in sync, rather than inferring it from the next `game:state` tick.
- **Content:**
  ```ts
  { territoryId: number; troops: number }
  ```

### `game:selected`
- **When sent:** immediately, to every socket in a game's room, whenever a `game:selectTerritory`, `game:fortifySelectStart`, `game:fortifySelectEnd`, `game:attackSelectStart`, or `game:attackSelectEnd` call succeeds with a non-`null` `territoryId` (including back to the selecting player). Not sent for a deselection.
- **Purpose:** let every client play the territory-selection sound effect in sync, rather than inferring it from the next `game:state` tick.
- **Content:**
  ```ts
  { territoryId: number }
  ```
