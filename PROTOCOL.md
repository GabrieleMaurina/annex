# Server ↔ Client Protocol

This document lists every Socket.IO message exchanged between server and a client, and must be followed by both sides. This document must be clear, precise, comprehensive, short, and up to date.

Every socket starts in the `home` room on connect. A player moves to a game's room (`game:create` / `game:join`) and can be moved back to `home` (kicked, or `player:identify` reporting `room: 'home'`).

### Player identity: `id` vs `key`

Each player known to the server has two distinct identifiers, plus a display name:

- **`id`** — a unique integer assigned by the server the first time it sees a given player. Safe to share: it identifies a player in every message to every client (roster entries, host, ban list, kick/unban targets). A client cannot choose its own `id`; the server hands it out.
- **`key`** — a unique random UUID, generated and stored by the client (in its cookie) and never by the server. It is a secret credential that proves the client's identity: whoever presents a given `key` in `player:identify` is treated as that player, and any other socket currently holding that identity is disconnected. **The server must never send any player's `key` to any client — including that player's own socket.** A client learns its own `id` from the `player:identify` ack, but it generates and already holds its own `key`; it never learns anyone else's `key`.
- **`name`** — a display string, not unique, freely chosen by the client via `player:setName`. Must not be empty or all-whitespace; the server ignores a `playerName`/`name` that fails this check (see `player:identify` and `player:setName` below).

## Shared types

**GameSummary** (used in `home:games`)
```ts
{
  name: string;
  mapName: string;
  playerCount: number;
  slots: number;
  phase: 'lobby' | 'playing';
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
  phase: 'lobby' | 'playing';
  gameMode: 'World Domination' | 'Capital Conquest' | 'Team Deathmatch';
  diceRandomness: 'Balanced' | 'True';
  defenceDice: 2 | 3;
  cards: 'Fixed' | 'Progressive' | 'Exponential';
  turnDuration: 60 | 90 | 120 | 150 | 180 | 300; // seconds
  players: { id: number; name: string; team: number; color: number; territoryCount: number; troopCount: number }[];
  spectators: { id: number; name: string }[];
  bannedPlayers: { id: number; name: string }[];
  territories: { id: number; ownerId: number; troops: number }[];
}
```
`hostId` is the id of the game's current host — the only player who may call `game:settings` or `game:start`. If the host leaves the game (disconnects, is kicked, or `player:identify`s reporting a different room) while other players remain, it passes to the next player in `players` order; if no players remain, the game is deleted.

`team` is only meaningful when `gameMode` is `'Team Deathmatch'` — it always defaults to `0` otherwise and is ignored by the client. Its valid range is `0` to `max(0, players.length - 2)`, guaranteeing at least one team has more than one member.

`color` is an index into a 20-entry color palette the client owns — the server never sends actual color values, only the index. It's assigned at random when a player is seated (`game:create`, `game:join`, or spectator promotion), and is always unique among the game's current players. To keep early joiners' colors nicer (the palette is ordered nicest-first), both the random assignment and `game:cycleColor` are restricted to the first `min(20, players.length + 3)` palette indices. Spectators have no color.

`territoryCount` and `troopCount` are the number of territories the player currently controls and the total troops on them; both are `0` until the game starts. Once `game:start` succeeds, `players` is reordered into the game's randomized turn order and stays in that order for the rest of the game.

`territories` is empty until the game starts; once `playing`, it lists every territory on the map with its current owner (`ownerId`, a player's `id`) and troop count.

Players who couldn't be seated (lobby full, or the game is already `playing`) become **spectators**: same room, full visibility of `game:state`, but no roster slot and no gameplay actions. In the `lobby` phase, spectators are an ordered queue (`spectators[0]` is next in line) — if a seated player leaves while the game is still in `lobby`, the front spectator is promoted to a player automatically. Nothing promotes spectators once the game is `playing`; a player leaving mid-game just shrinks the roster.

**Ack response** — `game:create`, `game:join`, `game:settings`, `game:start`, and `game:cycleColor` all reply via the Socket.IO acknowledgement callback with:
```ts
{ ok: true; game: GameState } | { ok: false; error: string }
```

---

## Client → Server

### `player:identify`
- **When sent:** once, immediately after the socket connects; re-sent any time the client reconnects (new tab, page reload, dropped connection); and re-sent any time the client's own declared room changes on the client side — e.g. after creating/joining a game, after navigating back to `/` to leave a game, or when navigating directly to a different game's URL.
- **Purpose:** register this socket against a persistent player identity, and declare which room the client believes it's in — `'home'` or a game name. The server uses this to place the socket in the correct room and to detect stale game membership: if `room` doesn't match what the server has on record (e.g. another of the player's tabs is still in a game but this tab reports `'home'`), the server removes the player from that game (see `hostId` above for what happens next).
- **Content:**
  ```ts
  { playerKey: string; playerName: string; room: string }
  ```
  `playerName` only sets the player's name the first time a given `playerKey` is seen (i.e. when the player is created) — on every later identify (reconnects, tab duplicates) it is ignored, since renaming afterward is `player:setName`'s job. If `playerName` is empty, all-whitespace, or longer than 10 characters (after trimming) at creation time, the server assigns a default name instead.
- **Ack:**
  ```ts
  { id: number }
  ```
  The caller's own `id` — assigned once by the server the first time it sees this `playerKey`, and stable for as long as the player exists on the server.

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
- **Purpose:** create a game with default settings — name `Game with <playerName>`, map `World`, 2 slots, `World Domination` game mode, `Balanced` dice randomness, 2 defence dice, `Fixed` cards, 120s turn duration — make the caller its host, and move their socket into the game's room.
- **Content:** none
- **Ack:** shared Ack response. Errors: `not identified`, `already in a game`, `game name already in use`.

### `game:join`
- **When sent:** a player in `home` joins an existing game from the games list, or a client navigates straight to a game's URL without having joined from `home` first (sent immediately after `player:identify`, once per such navigation).
- **Purpose:** add the caller to the game and move their socket into its room. If the game is still in `lobby` phase and has an open slot, the caller becomes a player; otherwise (lobby full, or the game is already `playing`) the caller becomes a spectator instead — this call never fails just because the game is full or in progress.
- **Content:**
  ```ts
  { gameName: string }
  ```
- **Ack:** shared Ack response. Errors: `not identified`, `already in a game`, `game not found`, `banned from this game`.

### `game:settings`
- **When sent:** the host of a game changes any settings.
- **Purpose:** single bundled message for every game-settings mutation: rename, change map, change slot count, replace the ban list, set a player's team, change game mode / dice randomness / defence dice / cards mode / turn duration. Only the fields present are applied; the caller must be the game's current host, and the game must still be in the `lobby` phase — nothing about a game's settings can change once it's `playing`. Fields are applied in a fixed order — `mapName`, then `gameMode`, then `name`, then `bannedPlayerIds`, then `playerTeam`, then `slots`, then `diceRandomness`, then `defenceDice`, then `cards`, then `turnDuration` — so `slots` and `playerTeam` are validated against the roster *after* any kicks from the same request have been applied. `gameMode` and the last four fields are independent of the rest and of each other; their position in the order doesn't otherwise matter.
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
  `bannedPlayerIds` replaces the full ban list in one shot rather than adding/removing one id at a time — to kick a player or spectator, send the current `bannedPlayers` ids (from `game:state`) plus the new id; to unban, send them minus the id to remove. Any id newly present that belongs to a player or spectator currently in the game is kicked (evicted and sent `game:kicked`); the host's own id is silently dropped from the list rather than self-banning.

  `playerTeam` sets one player's `team` (see `GameState.players` above for its valid range); the request is rejected with `invalid team` unless `playerId` is currently a player in the game (not a spectator) and `team` is an integer within that range.
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `not the host`, `game already started`, `invalid name`, `invalid map`, `invalid slots`, `invalid banned players`, `invalid team`, `invalid game mode`, `invalid dice randomness`, `invalid defence dice`, `invalid cards`, `invalid turn duration`, `game name already in use`.

### `game:cycleColor`
- **When sent:** a player clicks their own color in the lobby's player table.
- **Purpose:** change the caller's own `color` to the next available one; unlike `game:settings` this needs no host privileges, since players only ever change their own color. Starting from the caller's current index, the server walks forward (wrapping) through the same restricted index range described under `color` above, stopping at the first one not already used by another player. The caller must currently be a seated player (not a spectator), and the game must still be in the `lobby` phase — colors can't change once playing.
- **Content:** none
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `not a player`, `game already started`.

### `game:start`
- **When sent:** the host of a game starts it from the lobby.
- **Purpose:** move the game from the `lobby` phase to the `playing` phase, so every client in the game switches from the Lobby subpage to the Map subpage. The caller must be the game's current host, and the game must have at least 2 players. The player order is shuffled at random to establish turn order (reflected in `players`); the map's territories are then dealt out at random in as equal shares as the player count allows — if they don't divide evenly, the last players in turn order get one extra territory each. Each player's territories start with 1 troop each, plus `territoryCount * 2` more troops dropped one at a time on random territories they own.
- **Content:** none
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `not the host`, `already started`, `not enough players`.

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
- **Purpose:** keep everyone in a game synced on its settings, roster, and ban list (including for the host's own settings UI, and so clients can offer an "unban" action from `bannedPlayers`).
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
