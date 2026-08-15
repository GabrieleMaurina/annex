# Server ↔ Client Protocol

This document lists every Socket.IO message exchanged between server and a client, and must be followed by both side. This document must be clear, precise, and short.

Every socket starts in the `home` room on connect. A player moves to a game's room (`game:create` / `game:join`) and can be moved back to `home` (kicked, or `player:identify` reporting `room: 'home'`).

### Player identity: `id` vs `key`

Each player known to the server has two distinct identifiers, plus a display name:

- **`id`** — a unique integer assigned by the server the first time it sees a given player. Safe to share: it identifies a player in every message to every client (roster entries, host, ban list, kick/unban targets). A client cannot choose its own `id`; the server hands it out.
- **`key`** — a unique random UUID, generated and stored by the client (in its cookie) and never by the server. It is a secret credential that proves the client's identity: whoever presents a given `key` in `player:identify` is treated as that player, and any other socket currently holding that identity is disconnected. **The server must never send any player's `key` to any client — including that player's own socket.** A client learns its own `id` from the `player:identify` ack, but it generates and already holds its own `key`; it never learns anyone else's `key`.
- **`name`** — a display string, not unique, freely chosen by the client via `player:setName`. Must not be empty or all-whitespace; the server ignores a `playerName`/`name` that fails this check (see `player:identify` and `player:setName` below).

A client can choose its own `name` and `key`, but never its own `id`, nor its `socket.id` (managed entirely by Socket.IO).

## Shared types

**GameSummary** (used in `home:games`)
```ts
{
  name: string;
  mapName: string;
  playerCount: number;
  slots: number;
}
```

**GameState** (used in `game:state` and as the `game` field of every ack below)
```ts
{
  name: string;
  mapName: string;
  slots: number;
  hostId: number;
  players: { id: number; name: string }[];
  bannedPlayers: { id: number; name: string }[];
}
```

**Ack response** — `game:create`, `game:join`, and `game:settings` all reply via the Socket.IO acknowledgement callback with:
```ts
{ ok: true; game: GameState } | { ok: false; error: string }
```

---

## Client → Server

### `player:identify`
- **When sent:** once, immediately after the socket connects; re-sent any time the client reconnects (new tab, page reload, dropped connection); and re-sent any time the client's own declared room changes on the client side — e.g. after creating/joining a game, after navigating back to `/` to leave a game, or when navigating directly to a different game's URL.
- **Purpose:** register this socket against a persistent player identity, and declare which room the client believes it's in — `'home'` or a game name. The server uses this to place the socket in the correct room and to detect stale game membership: if `room` doesn't match what the server has on record (e.g. another of the player's tabs is still in a game but this tab reports `'home'`), the server removes the player from that game, reassigning the host or deleting the game if no players remain. If the same `playerKey` is already attached to a different, still-connected socket, that older socket is disconnected and dropped. `playerName` only sets the player's name the first time a given `playerKey` is seen (i.e. when the player is created) — on every later identify (reconnects, tab duplicates) it is ignored, since renaming afterward is `player:setName`'s job. If `playerName` is empty or all-whitespace at creation time, the server assigns a default name instead.
- **Content:**
  ```ts
  { playerKey: string; playerName: string; room: string }
  ```
- **Ack:**
  ```ts
  { id: number }
  ```
  The caller's own `id` — assigned once by the server the first time it sees this `playerKey`, and stable for as long as the player exists on the server.

### `player:setName`
- **When sent:** any time the player changes their display name (their `playerKey` never changes).
- **Purpose:** update the stored name for the identified player. If `name` is empty or all-whitespace, the message is ignored and the stored name is left unchanged.
- **Content:**
  ```ts
  { name: string }
  ```
- **Ack:** none

### `game:create`
- **When sent:** a player in `home` starts a new game.
- **Purpose:** create a game with default settings — name `Game with <playerName>`, the first available map, 2 slots — make the caller its host, and move their socket into the game's room.
- **Content:** none
- **Ack:** shared Ack response. Errors: `not identified`, `already in a game`, `game name already in use`.

### `game:join`
- **When sent:** a player in `home` joins an existing game from the games list, or a client navigates straight to a game's URL without having joined from `home` first (sent immediately after `player:identify`, once per such navigation).
- **Purpose:** add the caller to the game's roster and move their socket into its room.
- **Content:**
  ```ts
  { gameName: string }
  ```
- **Ack:** shared Ack response. Errors: `not identified`, `already in a game`, `game not found`, `banned from this game`, `game is full`.

### `game:settings`
- **When sent:** the host of a game changes any settings.
- **Purpose:** single bundled message for every game-settings mutation: rename, change map, change slot count, replace the ban list. Only the fields present are applied; the caller must be the game's current host. Fields are applied in a fixed order — `mapName`, then `name`, then `bannedPlayerIds`, then `slots` — so a `slots` shrink is validated against the player count *after* any kicks from the same request have been applied.
- **Content:** (all fields optional — only send what changed)
  ```ts
  {
    name?: string;              // trimmed; empty or all-whitespace is rejected
    mapName?: string;
    slots?: number;            // 1–20, and never below the player count once bannedPlayerIds (if present) has been applied
    bannedPlayerIds?: number[]; // replaces the game's entire ban list
  }
  ```
  `bannedPlayerIds` replaces the full ban list in one shot rather than adding/removing one id at a time — to kick a player, send the current `bannedPlayers` ids (from `game:state`) plus the new id; to unban, send them minus the id to remove. Any id newly present that belongs to a player currently in the game is kicked (evicted and sent `game:kicked`); the host's own id is silently dropped from the list rather than self-banning.
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `not the host`, `invalid name`, `invalid map`, `invalid slots`, `game name already in use`.

---

## Server → Client

### `maps:list`
- **When sent:** once, immediately after the socket connects.
- **Purpose:** tell the client which map names are available to choose from (e.g. for the host's map-select control in `game:settings`).
- **Content:**
  ```ts
  string[]
  ```

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
- **When sent:** immediately, only to the socket of the player who was just kicked.
- **Purpose:** tell that client it has been removed and banned from the game, so it can leave the game view. The server has already moved that socket back to `home`.
- **Content:**
  ```ts
  { gameName: string }
  ```
