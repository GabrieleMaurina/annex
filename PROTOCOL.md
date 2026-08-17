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
  state: 'lobby' | 'playing';
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
  state: 'lobby' | 'playing';
  gameMode: 'World Domination' | 'Capital Conquest' | 'Team Deathmatch';
  diceRandomness: 'Balanced' | 'True';
  defenceDice: 2 | 3;
  cards: 'Fixed' | 'Progressive' | 'Exponential';
  turnDuration: 60 | 90 | 120 | 150 | 180 | 300; // seconds
  turnNumber: number;
  turnPlayerIndex: number;
  turnPhase: 'deploy' | 'attack' | 'fortify';
  troopsToDeploy: number;
  turnStartedAt: number; // ms since epoch
  selectedTerritoryId: number | null;
  players: { id: number; name: string; team: number; color: number; territoryCount: number; troopCount: number; connected: boolean; surrendered: boolean }[];
  spectators: { id: number; name: string }[];
  bannedPlayers: { id: number; name: string }[];
  territories: { id: number; ownerId: number; troops: number }[];
}
```
`hostId` is the id of the game's current host — the only player who may call `game:settings` or `game:start`. The server recomputes it whenever it might need to change (a leave, kick, join, or reconnect) from the game's host-priority list — every player who's ever held a seat, in the order they first got one, never reordered or shortened by a leave — picking the first one still seated, connected, and not surrendered (see "Leaving and reconnecting" above, `game:surrender` below). So host passes to the next eligible player when the current one disconnects or leaves, and passes back the moment a higher-priority former host reconnects, cascading through however many stand-ins came in between. If no players remain, the game is deleted.

Once `game:start` succeeds, `turnNumber` counts full rounds completed (starts at `0`); `turnPlayerIndex` indexes `players` for whoever's turn it is; `turnPhase` is that player's progress — `'deploy'`, `'attack'`, `'fortify'`, in order. Only the player at `turnPlayerIndex` may advance it, via `game:nextPhase`; completing `'fortify'` instead ends the turn, advancing to the next player (`turnPlayerIndex + 1`, wrapping to `0` and incrementing `turnNumber` after the last player) and resetting `turnPhase` to `'deploy'`. `turnDuration` is a hard limit on the whole turn (all three phases, not reset between them) — if the current player hasn't finished in time, the server force-advances exactly as `game:nextPhase` would from `'fortify'`. This also covers a disconnected player: `players`/`turnPlayerIndex` are unaffected by leaving a `playing` game (see "Leaving and reconnecting" above), so an absent turn just runs out the clock. `turnStartedAt` is when the current player's turn began (server clock, ms since epoch) — it only changes alongside `turnNumber`/`turnPlayerIndex`, not between phases, so every client (including one that just connected or reconnected mid-turn) can derive the same remaining time from it instead of trusting local state. Both `turnNumber` and `turnPhase` sit inert (`0`/`'deploy'`) in the `lobby` state, with `turnStartedAt` at `0`.

`'deploy'` is the one phase `game:nextPhase` cannot advance (`cannot skip deploy phase`) — it only ends once the current player has placed every troop available that turn, via `game:deploy` (see below). Entering `'deploy'` (turn start, or the timer force-advancing from `'fortify'`) silently grants the player a troop pool: `max(3, floor(territoryCount / 3))`, plus, for every continent where they own every territory, that continent's entry in the map's `bonuses` array. `troopsToDeploy` is that pool, decremented as the player calls `game:deploy`; it sits at `0` outside `'deploy'` and in the `lobby` state.

`selectedTerritoryId` is the territory the player at `turnPlayerIndex` currently has selected (`null` if none), set via `game:selectTerritory` — it's part of `GameState` so every client, not just the selecting player, sees the same selection highlighted on the map. It resets to `null` whenever the turn or phase changes (including the automatic `'deploy'` → `'attack'` advance) and whenever a `game:deploy` succeeds, regardless of whether the player's troop pool is now empty.

`team` is only meaningful when `gameMode` is `'Team Deathmatch'` — it always defaults to `0` otherwise and is ignored by the client. Its valid range is `0` to `max(0, players.length - 1)`, one value per player, so team counts from a single shared team up to every player on their own team are all valid. The client displays teams 1-based (`team + 1`); the wire value stays 0-based.

`color` is an index into a 20-entry palette the client owns — the server sends only the index, never actual color values. Assigned at random when seated (`game:create`, `game:join`, spectator promotion), always unique among current players. To keep early joiners' colors nicer (palette ordered nicest-first), both random assignment and `game:cycleColor` are restricted to the first `min(20, players.length + 3)` indices. Spectators have no color.

`territoryCount` and `troopCount` are the number of territories the player currently controls and the total troops on them; both are `0` until the game starts. Once `game:start` succeeds, `players` is reordered into the game's randomized turn order and stays that way for the rest of the game.

`connected` is whether the player currently has a live socket anywhere on the server (not necessarily this game's room — see "Leaving and reconnecting" above). `surrendered` is whether they've called `game:surrender` on this game; they're typically still `connected` (surrendering doesn't disconnect them) but can never be seated in it again. Both are informational only — an absent player's territories, troops, and turn are still tracked exactly like anyone else's.

`territories` is empty until the game starts; once `playing`, it lists every territory on the map with its current owner (`ownerId`, a player's `id`) and troop count.

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
- **Purpose:** create a game with default settings — name `Game with <playerName>` unless `name` is given, map `World`, 2 slots, `World Domination` game mode, `Balanced` dice randomness, 2 defence dice, `Fixed` cards, 120s turn duration — make the caller host and move their socket into the room.
- **Content:**
  ```ts
  { name?: string } // same validation as game:settings' name field; defaults to `Game with <playerName>` when omitted
  ```
- **Ack:** shared Ack response. Errors: `not identified`, `already in a game`, `invalid name`, `game name already in use`.

### `game:join`
- **When sent:** a player in `home` joins a game from the list, or navigates straight to a game's URL without joining from `home` first (sent right after `player:identify`, once per such navigation). In the URL-navigation case, if the ack comes back `game not found`, the client falls back to `game:create` with that name (see `game:create` above) to create the game at that URL; if that in turn fails with `game name already in use` (another client won the race), the client retries `game:join` once more.
- **Purpose:** add the caller to the game and move their socket into its room. If the game is still `lobby` with an open slot, they become a player; otherwise (full lobby, or already `playing`) they become a spectator — this call never fails just because the game is full or in progress.
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
    gameMode?: 'World Domination' | 'Capital Conquest' | 'Team Deathmatch';
    diceRandomness?: 'Balanced' | 'True';
    defenceDice?: 2 | 3;
    cards?: 'Fixed' | 'Progressive' | 'Exponential';
    turnDuration?: 60 | 90 | 120 | 150 | 180 | 300; // seconds
  }
  ```
  `bannedPlayerIds` replaces the whole ban list at once, not one id at a time — to kick, send the current `bannedPlayers` ids (from `game:state`) plus the new one; to unban, send them minus the id. Any newly-present id belonging to a current player or spectator is kicked (evicted, sent `game:kicked`); the host's own id is silently dropped rather than self-banning.

  `playerTeam` sets one player's `team` (see `GameState.players` above for its valid range); rejected with `invalid team` unless `playerId` is currently a player (not a spectator) and `team` is an integer within that range.
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `not the host`, `game already started`, `invalid name`, `invalid map`, `invalid slots`, `invalid banned players`, `invalid team`, `invalid game mode`, `invalid dice randomness`, `invalid defence dice`, `invalid cards`, `invalid turn duration`, `game name already in use`.

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
- **Purpose:** advance `turnPhase` to the next phase in order; completing `'fortify'` instead ends the turn (see `turnNumber` above). The caller must be the player at `turnPlayerIndex`, and the game must be `playing`. Cannot be used to leave `'deploy'` — that phase only ends via `game:deploy` (see below).
- **Content:** none
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `game not started`, `not your turn`, `cannot skip deploy phase`.

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
- **Purpose:** add `troops` to `territoryId`'s troop count and deduct them from the caller's remaining pool for the turn, clearing `selectedTerritoryId` in the process. Once the pool reaches `0`, the server auto-advances `turnPhase` to `'attack'`, same as a `game:nextPhase` call would. The caller must be the player at `turnPlayerIndex`, the game must be `playing` and in `'deploy'`, `territoryId` must be owned by the caller, and `troops` must be an integer from `1` up to the caller's remaining pool.
- **Content:**
  ```ts
  { territoryId: number; troops: number }
  ```
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `game not started`, `not your turn`, `not deploy phase`, `territory not owned`, `invalid troops`.

### `game:surrender`
- **When sent:** a seated player in a `playing` game gives up.
- **Purpose:** permanently give up the caller's seat for rejoining purposes, and move their socket back to `home`. Slot, territories, and troops stay exactly as they were — same as any other player leaving a `playing` game (see "Leaving and reconnecting" above) — so the game carries on unaffected; the only difference from an ordinary disconnect is that this player can now only ever rejoin as a spectator.
- **Content:** none
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `game not started`, `not a player`.

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
- **When sent:** immediately, to every socket in a game's room, whenever a `game:deploy` call succeeds (including back to the deploying player).
- **Purpose:** let every client play the deploy sound effect in sync, rather than inferring it from the next `game:state` tick.
- **Content:**
  ```ts
  { territoryId: number; troops: number }
  ```

### `game:selected`
- **When sent:** immediately, to every socket in a game's room, whenever a `game:selectTerritory` call succeeds with a non-`null` `territoryId` (including back to the selecting player). Not sent for a deselection.
- **Purpose:** let every client play the territory-selection sound effect in sync, rather than inferring it from the next `game:state` tick.
- **Content:**
  ```ts
  { territoryId: number }
  ```
