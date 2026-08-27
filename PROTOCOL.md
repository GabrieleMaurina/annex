# Server ↔ Client Protocol

This document lists every Socket.IO message exchanged between server and client, and must be followed by both sides, kept clear, precise, comprehensive, short, and up to date.

Every socket starts in the `home` room on connect. A player moves to a game's room (`game:create` / `game:join`) and can be moved back to `home` (kicked, or `player:identify` reporting `room: 'home'`).

### Player identity: `id` vs `key`

Each player known to the server has two distinct identifiers, plus a display name:

- **`id`**: a unique integer the server assigns the first time it sees a player. Safe to share: identifies them in every message to every client (roster entries, host, ban list, kick/unban targets). The client never chooses its own `id`.
- **`key`**: a unique random UUID the client generates and stores (in its cookie), never the server. It's a secret credential: whoever presents a given `key` in `player:identify` is treated as that player, and any other socket already holding that identity is disconnected. **The server must never send any player's `key` to any client, including that player's own socket.** The client learns its own `id` from the `player:identify` ack; it already has its own `key` and never learns anyone else's.
- **`name`**: a display string, not unique, freely chosen via `player:setName`. Must not be empty or all-whitespace: the server ignores it otherwise (see `player:identify` / `player:setName` below).

A player, once seen, stays in server memory (keyed by `id` and `key`) for as long as the server runs, connected or not; nothing is persisted, so a restart wipes it. This is what lets a reconnecting `key` always resume the same `id`.

### Leaving and reconnecting

Closing the tab, opening a new one, refreshing, or otherwise dropping the connection all disconnect the socket. Reconnecting (a fresh `player:identify`) with the same `key` resumes the same `id`; a different or new `key` is a different player: a new `id` who, per the seating rules below, can only ever join as a spectator.

What losing (and regaining) the socket does to a player's game membership depends on the game's `state`:
- **`lobby`**: a disconnect is no longer a permanent departure the way it used to be. A disconnecting spectator simply stays queued, not connected. A disconnecting player who holds a slot instead gets stood in for by the front *connected* spectator in the queue, if any (see "Slot stand-ins" below); with no connected spectator waiting, nothing happens beyond a `hostId` reassignment (see below). A mismatched-room `player:identify` (see below) is still a full, permanent departure exactly as before — clicking away or joining a different game removes the player entirely and cements any stand-in currently holding their slot for good. Reconnecting afterward is just a fresh `game:join`, except a player whose slot is currently held by a stand-in, who instead reclaims it via a room-matching `player:identify` (see "Slot stand-ins" below).
- **`playing`**: nothing changes; slot, territories, and troops stay exactly as they were; only the socket drops. Reconnecting with the same `key` (any device) silently resumes that slot. If their turn comes up while away, it just runs out the clock and passes on (see `turnDuration` under `GameState` below), same as anyone taking too long. A surrendered player is the exception: since they can no longer act, a mismatched-room `player:identify` (e.g. clicking the game's "Leave" button) clears their game membership so the client can navigate elsewhere, same as the `ended` case below — the seat itself stays untouched.
- **`ended`**: like `playing`, a disconnect changes nothing. A mismatched-room `player:identify` (e.g. clicking the end page's "leave" button) clears the player's current game membership (so the client can navigate elsewhere), but the seat itself is untouched.

A player who ever held a slot in a game keeps it for that game's lifetime no matter what: disconnecting, navigating away, or `game:surrender` (see below) never frees it or demotes them to a spectator. `game:join` (or a room-matching `player:identify`) always reseats such a player back into their original slot, still counted among `players`, never `spectators`; only someone who never held a slot in that particular game can become a spectator of it. (A player currently stood in for, per below, is the one exception: until they reclaim it, they hold no slot at all.)

#### Slot stand-ins

While a game is still `lobby`, a disconnected player's slot can be temporarily filled by a connected spectator so the game isn't stuck waiting on someone who stepped away. The stand-in takes over the slot outright — same `team` and `color`, counted among `players` like anyone else, able to become host — while the original player keeps the right to reclaim it: reconnecting to that same game while it's still `lobby` (a room-matching `player:identify`) swaps them straight back into the slot and sends the stand-in back to the *front* of the spectator queue, as if nothing had happened. This works transitively — if the stand-in themselves later disconnects and is, in turn, stood in for by another spectator, the original player can still reclaim the slot directly, skipping over every intermediate stand-in. A stand-in's own disconnect and reconnect otherwise behaves like any other player's: if no further spectator is waiting to stand in for *them*, their disconnect just leaves the slot with them, unfilled by anyone else, until they reconnect.

The arrangement is undone, and the stand-in keeps the slot for good, the moment either side makes it permanent: the original player leaving on purpose (a mismatched-room `player:identify`) while someone is standing in for them, or `game:start` firing while any stand-in is still in place (every such original player's game membership is cleared at that point, same as a permanent departure).

`game:surrender` is the one way to give up control of a `playing` game for good: slot, territories, and troops stay untouched, and the player keeps rejoining as a player exactly as above, but they're now permanently skipped in turn order (see `turnPlayerIndex` below) and every `game:*` action requiring their turn is rejected, so they can never again act on their troops or cards. If it was their turn at the moment they surrender, that turn is force-ended immediately, exactly as `turnDuration` timing out would. It also triggers the same end-of-game check a conquest does (see `winnerIds` below), so if it leaves only one player both not-surrendered and still owning territory, the game ends immediately.

Since `playing` games never lose a player this way, one where everyone has disconnected or surrendered would otherwise sit forever with no one able to act. So after every disconnect and every `game:surrender`, the server checks: if no player is both connected and not-surrendered, the game is destroyed (turn timer stopped, every remaining player/spectator's membership cleared, and their socket (if still connected) moved back to `home`) unless someone reconnects first: destruction is held for 5 seconds and re-checked, so a client that merely refreshes (a disconnect immediately followed by a reconnect) doesn't wipe out the game out from under itself.

## Shared types

**GameSummary** (used in `home:games`)
```ts
{
  name: string;
  mapName: string;
  hostName: string;
  playerCount: number;
  slots: number;
  state: 'lobby' | 'playing' | 'ended';
  spectatorCount: number;
  hasPassword: boolean;
}
```
A game with `visibility: 'private'` (see `GameState` below) is never included here at all: the server omits it from the list entirely rather than sending it with any field blanked out. A private game is still joinable via `game:join` by anyone who knows its name (e.g. a direct link). `hasPassword` is whether the game currently has a password set, so a client can show a lock indicator without ever learning the password itself (see `password` under `GameState` below).

**ReplayFrame** (used in `game:replay`'s ack)
```ts
{
  territories: { id: number; ownerId: number; troops: number; entrenchedTurns: number }[];
  toxinTerritories: { id: number; permanent: boolean; turnsRemaining: number }[];
  radiationTerritories: number[];
  animation:
    | { type: 'deploy'; territoryId: number; troops: number; playerId: number }
    | { type: 'fortify'; fromTerritoryId: number; toTerritoryId: number; troops: number; playerId: number }
    | { type: 'attack'; attackingTerritoryId: number; defendingTerritoryId: number; attackerId: number; defenderId: number | undefined; attackLosses: number; defenceLosses: number }
    | { type: 'entrench'; territoryId: number; troops: number; playerId: number }
    | { type: 'starve'; territoryId: number; troops: number; playerId: number }
    | { type: 'toxins'; territoryId: number; playerId: number };
  turnNumber: number;
  playerId: number;
}
```
`territories` is a full snapshot (not a diff) of every territory's owner, troop count, and entrenchment turns remaining immediately after the change described by `animation`: `isCapital` isn't included, since it's a static property of the territory (see `turnPhase` above) that a client already has from `GameState.territories`, but `entrenchedTurns` is included since, unlike `isCapital`, it changes over the course of the game and a replay does depict it (both the octagon and the entrench animation, see `game:entrenched` below). `toxinTerritories` is a parallel, independent snapshot of every currently-toxined territory (it can't live inside `territories`, since a toxined territory has no owner and so is never in that array at all — see the `toxins` paragraph below), same shape as `GameState.toxinTerritories`. `radiationTerritories` is the same idea for radiation (see the `radiations` paragraph below), same shape as `GameState.radiationTerritoryIds`; unlike `toxinTerritories` it isn't empty at the start of a replay, since radiation (when enabled) exists from `game:start` rather than being placed by a player action — the replay's starting point (index `0`, see `game:replay` below) uses `initialRadiation` for it instead of an empty array. A game's replay is the sequence of these snapshots: the state right after `game:start` deals territories (no frame: nothing preceded it, and `toxinTerritories` starts empty since toxins can't exist before any `game:toxins` call), then one `ReplayFrame` for every subsequent troop deployment, fortify, attack, entrenchment, toxin placement, or starvation loss for the rest of the game, in order. `'fortify'`-type frames cover both an actual `game:fortify` move and troops moving into a just-conquered territory (`game:attackMove`, or the turn timer completing either); a `'deploy'`-type frame covers `game:deploy`, a capital's placement troops, a card set's per-territory bonus, and the turn timer dropping leftover troops; a `'entrench'`-type frame covers a `game:entrench` call, reflecting the troops consumed off the board; a `'starve'`-type frame covers troops removed by `starvation` (see above) at the end of a player's turn; a `'toxins'`-type frame covers a `game:toxins` call; one frame per territory actually touched, not per individual troop unit, even when several troops land on (or are removed from) the same territory in one go. A temporary toxin expiring produces no frame of its own (unlike every other `toxinTerritories`/`territories` change, it isn't the direct result of a player action): it's only reflected in whichever `ReplayFrame` happens to come next, whose `toxinTerritories` snapshot simply no longer includes it, exactly as `game:toxinExpired` (see below) reflects it live without a dedicated replay animation to match. Radiation moving or expanding follows the same rule for the same reason (it's never a player action either): it produces no frame of its own, and is only reflected in whichever `ReplayFrame`'s `radiationTerritories` snapshot happens to come next, exactly as `game:radiationChanged` (see below) reflects it live. A successful attack that conquers its target always produces two separate, consecutive frames: the `'attack'` frame for the battle itself (troop losses and, if conquered, the ownership transfer), immediately followed by a `'fortify'` frame for however the resulting troop move happens: a later `game:attackMove`, or, if the attacker's hand hit 5+ cards or the conquest ended the game outright, one resolved automatically within the same turn. This still holds for a free-conquest attack against an unowned, non-toxined territory (see the `toxins` paragraph and `game:attack` below): `defenderId` on the `'attack'` frame is `undefined` in that case, since there was no real defending player. `turnNumber` is `GameState.turnNumber`'s value at the moment this frame happened (see `turnPlayerIndex` above for what it counts); `playerId` is whoever acted: the depositing/fortifying/entrenching/toxining/starving player, or the attacker for an `'attack'` frame.

**GameState** (used in `game:state` and as the `game` field of every ack below)
```ts
{
  name: string;
  mapName: string;
  slots: number;
  hostId: number;
  state: 'lobby' | 'playing' | 'ended';
  gameMode: 'Supremacy' | 'Supremacy 3/4' | 'Supremacy 2/3' | 'Capitals' | 'Team Deathmatch' | 'Continent' | '5-Turn' | '10-Turn' | 'Assassin' | 'Mission' | 'Player Kills' | 'Troop Kills';
  continentId: number | null; // only set in 'Continent', otherwise null; see below
  blitz: 'Balanced' | 'True';
  defenceDice: 2 | 3;
  cards: 'Constant' | 'Linear' | 'Exponential' | 'Linear Per Player' | 'Exponential Per Player';
  placement: 'Random' | 'Semi' | 'Custom';
  fortification: 'Connected' | 'Neighboring' | 'Unrestricted';
  entrenchments: 'off' | 'on';
  toxins: 'off' | 'temporary' | 'permanent';
  portals: 'off' | 'static' | 'dynamic';
  portalTerritoryIds: number[];
  portalsEnabled: boolean;
  radiations: 'off' | 'static' | 'dynamic' | 'expanding';
  radiationTerritoryIds: number[];
  radiationUpcomingTerritoryIds: number[];
  starvation: 'off' | 'territory' | 'total' | 'percent';
  turnTroops: 'off' | 'on';
  bounties: 'off' | 'on';
  supplyLines: 'off' | 'on';
  fogOfWar: 'off' | 'on';
  territoryTroopsCap: number; // 'territory' mode's per-territory troop cap
  totalTroopsCap: number; // 'total' mode's cap on this map (territory count-based)
  turnDuration: 60 | 90 | 120 | 150 | 180 | 300; // seconds
  hasPassword: boolean;
  visibility: 'public' | 'private';
  turnNumber: number;
  turnPlayerIndex: number;
  turnPhase: 'territory' | 'troop' | 'capital' | 'deploy' | 'attack' | 'fortify' | 'entrench' | 'toxins';
  troopsToDeploy: number;
  turnStartedAt: number; // ms since epoch
  paused: boolean;
  selectedTerritoryId: number | null;
  fortifyStartTerritoryId: number | null;
  fortifyEndTerritoryId: number | null;
  attackStartTerritoryId: number | null;
  attackEndTerritoryId: number | null;
  attackConquestMinTroops: number | null;
  fortifyPathTerritoryIds: number[][];
  winnerIds: number[];
  finalRanking: number[];
  nextSetBaseValues: { soldier: number; humvee: number; tank: number; mixed: number };
  upcomingSetValues: number[];
  players: { id: number; name: string; team: number; color: number; territoryCount: number; troopCount: number; capitalCount: number; troopsRemaining: number; cardCount: number; connected: boolean; surrendered: boolean; eliminated: boolean; playersKilled: number[] }[];
  spectators: { id: number; name: string }[];
  bannedPlayers: { id: number; name: string }[];
  territories: { id: number; ownerId: number; troops: number; isCapital: boolean; entrenchedTurns: number }[];
  toxinTerritories: { id: number; permanent: boolean; turnsRemaining: number }[];
  visibleTerritoryIds?: number[];
}
```
`radiationTerritoryIds` and `radiationUpcomingTerritoryIds` are described under `radiations` below.

A `players[]` entry carries only what's needed live: current standing (`territoryCount`, `troopCount`, `capitalCount`, `troopsRemaining`, `cardCount`) and status (`connected`, `surrendered`, `eliminated`). `playersKilled` also lives here, since `bounties: 'on'` shows a live kill count during play (see `bounties` below). A player's cumulative lifetime stats for the just-finished game (troops gained/killed/lost, territories/capitals conquered/lost, cards gained, sets played, turns played) are never part of `GameState` at all: they're irrelevant until the results table after the game ends, so they're pushed once via `game:results` instead of riding along on every `game:state` push for the whole game (see below).

`fogOfWar` is described in its own paragraph further below, alongside `supplyLines`. Unlike every other field on `GameState`, once `fogOfWar` is `'on'` and in effect for a given recipient, `GameState` itself is no longer one single ground truth shared by everyone in the room: `game:state` (and the `game` field of every ack) is computed separately per recipient, and `territories`/`toxinTerritories`/`portalTerritoryIds`/`radiationTerritoryIds`/`radiationUpcomingTerritoryIds` are all filtered down to only the ids that recipient can currently see (an unlisted territory is indistinguishable on the wire from one that's simply unclaimed, or from one that isn't a portal/radiated; the client tells territories apart from unclaimed ones using `visibleTerritoryIds`, see below). `selectedTerritoryId` is nulled out for a recipient who can't see the territory it references. `fortifyStartTerritoryId`/`fortifyEndTerritoryId` and `attackStartTerritoryId`/`attackEndTerritoryId` are each treated as a pair: both stay populated as long as the recipient can see *either* endpoint (so the client always has both ids needed to draw the preview arrow between them, fading it toward whichever end it can't see, the same way it fades the arrow for `game:attacked`/`game:fortified`/`game:attackMoved` below), and both are nulled together only when the recipient can see neither. `attackConquestMinTroops` is nulled independently of that pair, whenever `attackEndTerritoryId`'s own territory specifically isn't visible to the recipient (it's the pending conquest-move amount, tied to the target territory alone). `fortifyPathTerritoryIds` is the actual chain of territory ids between `fortifyStartTerritoryId` and `fortifyEndTerritoryId` under `fortification: 'Connected'` (just the two endpoints under `'Neighboring'`/`'Unrestricted'`), computed server-side (a recipient can never reconstruct it themselves from `territories` alone, since fog can hide the ownership of territories in the middle of the chain) and split into separate runs wherever a hop's two endpoints are *both* invisible to the recipient, so a client never learns that two territories it can't see are connected by the same fortify chain; each remaining hop keeps at least one visible endpoint, same rule as the pair fields above. It's `[]` whenever no fortify selection is active, or once redaction leaves nothing a recipient can see. `visibleTerritoryIds` itself is present only when fog of war is currently restricting this recipient's view; it's the complete set of territory ids they can currently see (their own territories plus every territory directly adjacent to one of them, portal edges included when active — so a recipient who owns a portal always sees every other portal, however far away, since owning one makes every other portal a direct neighbor for this purpose), and its absence means this recipient's view is unrestricted (fog of war off, game not `playing`, still in the `'territory'`/`'troop'` phase, or this recipient is a spectator, eliminated, or surrendered). Every other field — including every `players[]` entry's status fields (`connected`, `surrendered`, `eliminated`, `playersKilled`) — is always the same for every recipient regardless of fog of war, with one exception: a `players[]` entry's own `territoryCount`/`troopCount` are nulled to `null` for every player other than the recipient themselves whenever fog of war is restricting that recipient's view (a recipient always sees their own row's numbers).

`hostId` is the id of the game's current host: the only player who may call `game:settings` or `game:start`. The server recomputes it whenever it might need to change (a leave, kick, join, or reconnect) from the game's host-priority list (every player who's ever held a seat, in the order they first got one, never reordered or shortened by a leave), picking the first one still seated, connected, and not surrendered (see "Leaving and reconnecting" above, `game:surrender` below). So host passes to the next eligible player when the current one disconnects or leaves, and passes back the moment a higher-priority former host reconnects, cascading through however many stand-ins came in between. If no players remain, the game is deleted.

`password` and `visibility` both default to `null` (no password) and `'public'` on `game:create`, and are changed only via `game:settings` (see below); a fresh `game:create` never sets either. The actual `password` string is never included in `GameState` or anywhere else sent to any client, including the host's own: `hasPassword` (`true` once a password is set) is all any client ever learns. Setting or changing the password doesn't affect anyone already seated or spectating, nor anyone who has ever successfully joined this game before (even if they've since left, or a `lobby`-state disconnect purged their seat, see "Leaving and reconnecting" above): the server remembers, for the game's lifetime, every player id that has ever passed its `game:join` password check (or joined while it had none), and `game:join` only checks the password for an id it's never seen before, so a returning player (e.g. simply refreshing the page) is never re-prompted. A `visibility: 'private'` game is simply left out of `home:games` entirely (see `GameSummary` above); it's otherwise a completely ordinary game, still reachable by anyone who calls `game:join` with its name (e.g. a direct link), password permitting.

Once `game:start` succeeds, `turnNumber` counts full rounds completed (starts at `0`); `turnPlayerIndex` indexes `players` for whoever's turn it is; `turnPhase` is that player's progress: `'deploy'`, `'attack'`, `'fortify'`, then `'entrench'` when `entrenchments` is `'on'`, then `'toxins'` when `toxins` isn't `'off'`, in order. Only the player at `turnPlayerIndex` may advance it, via `game:nextPhase`; completing the last phase in that sequence (`'fortify'`, `'entrench'`, or `'toxins'`, whichever is last given the current settings) instead ends the turn, advancing to the next player (`turnPlayerIndex + 1`, wrapping to `0` and incrementing `turnNumber` each time `0` is passed) and resetting `turnPhase` to `'deploy'`; an eliminated player (`territoryCount === 0`) or a surrendered one (see `game:surrender` below) is always skipped over, so `turnPlayerIndex` only ever lands on someone who still owns at least one territory and hasn't surrendered. `'territory'` and `'troop'` are each bounded by a fixed `10` second timer per player turn instead of `turnDuration` (a fast, constant limit, independent of the game's configured `turnDuration`, since one placement action is far quicker to decide than a full turn): in `'territory'`, a timed-out player is assigned one random unclaimed territory (or, if none remain, eliminated, exactly as `game:claimTerritory` below describes); in `'troop'`, a timed-out player has whatever's left of their current turn's troops (`troopsToDeploy`, not their whole remaining pool) dropped at random across their own territories, the same way `'deploy'`'s leftover troops are (see below). `turnDuration` is a hard limit on the whole turn (all phases, not reset between them); if the current player hasn't finished in time, the server force-advances exactly as `game:nextPhase` would from the last phase. Before doing so, it completes whichever action the cut-off phase left unfinished: in `'deploy'`, any remaining `troopsToDeploy` are dropped one at a time on random territories the player owns, and then, same as a player who never gets to act at all, a 5+-card hand keeps auto-playing its single best set (highest value, ties broken by fewest wilds; see "Territory cards" above) and dropping the troops it grants the same random way, until the hand is back under 5; in `'attack'`, a pending conquest (`attackConquestMinTroops` non-`null`) is resolved by moving the minimum number of troops it allows, exactly as `game:attackMove` would; in `'fortify'`, a selection with both `fortifyStartTerritoryId` and `fortifyEndTerritoryId` set moves exactly `1` troop; `'entrench'` and `'toxins'` each have no forced action of their own. Any other in-progress selection (a lone attack or fortify start territory, a selected territory in `'entrench'` or `'toxins'`, or an attack with both territories selected but no conquest pending) is simply discarded. Every territory this touches is still broadcast as `game:deployed`/`game:deployedMany`/`game:attackMoved`/`game:fortified` (see below) exactly as if the player had acted manually, so clients play the same sounds and animations either way. This also covers a disconnected player: `players`/`turnPlayerIndex` are unaffected by leaving a `playing` game (see "Leaving and reconnecting" above), so an absent turn just runs out the clock. `turnStartedAt` is when the current player's turn began (server clock, ms since epoch); it only changes alongside `turnNumber`/`turnPlayerIndex`, not between phases, so every client (including one that just connected or reconnected mid-turn) can derive the same remaining time from it instead of trusting local state. Both `turnNumber` and `turnPhase` sit inert (`0`/`'deploy'`) in the `lobby` state, with `turnStartedAt` at `0`.

`paused` is `false` unless the host has called `game:pause` to freeze the game (see below); always `false` in the `lobby` and `ended` states. While `true`, every `game:*` action that mutates turn state (`game:claimTerritory`, `game:placeTroop`, `game:selectCapital`, `game:selectTerritory`, `game:deploy`, `game:playCardSet`, `game:fortifySelectStart`, `game:fortifySelectEnd`, `game:fortify`, `game:entrench`, `game:toxins`, `game:attackSelectStart`, `game:attackSelectEnd`, `game:attack`, `game:attackMove`, `game:nextPhase`) is rejected with `game paused`, regardless of whose turn it is; `game:chat`, `game:surrender`, and simply viewing the map/cards are unaffected. The turn timer stops the instant the game is paused and resumes with exactly the time it had left when `game:pause` unpauses it: `turnStartedAt` is shifted forward by however long the pause lasted, so the remaining time (and every client's derived countdown) is unaffected by how long the game sat paused.

`placement` controls how territories and starting troops are handed out at `game:start`. Under `'Random'` (the default), territories are dealt out at random and each is seeded with `1` troop, then each player's remaining starting-troop pool (`territoryCount * 2`, plus a turn-order bonus: `0` for the first 3 players in turn order, then `min(index - 2, 6)` for each player after) is dropped `1` troop at a time on random territories they own; this is unchanged from before `placement` existed. Under `'Semi'` and `'Custom'`, no troops are ever dropped at random: instead, territories are each seeded with `1` troop the same way `'Random'`'s are (`'Semi'` on assignment at `game:start`, `'Custom'` on each `game:claimTerritory` claim, see below), and `turnPhase` starts at `'territory'` (Custom only) then `'troop'` (both Semi and Custom) before proceeding to `'capital'` (if `'Capitals'`) or `'deploy'` as normal; so with every option combined, the full phase order is `'territory'`, `'troop'`, `'capital'`, `'deploy'`, `'attack'`, `'fortify'`, `'entrench'` (only when `entrenchments` is `'on'`), `'toxins'` (only when `toxins` isn't `'off'`). Both phases advance strictly one player at a time (`'territory'` one territory-claim per turn; `'troop'` one turn's worth of up to `3` troops, however split across territories, per turn), never letting one player act again before the next player's turn, and are bound by the same fixed `10` second per-turn timeout (see below for what happens on timeout), independent of the game's own `turnDuration`. `turnNumber` stays at `0` throughout both, same as `'capital'`.

Under `'Custom'`, territories start completely unowned (`GameState.territories` is empty until the first territory is claimed) and `turnPhase` starts at `'territory'`: `turnPlayerIndex` cycles through every player, in turn order, each calling `game:claimTerritory` to claim exactly one unclaimed territory as their own (seeded with `1` troop, same as `'Random'`'s baseline) before play passes to the next player; this repeats, wrapping back to the first player, until every territory on the map is claimed. If a player's turn to claim comes up and no unclaimed territory remains (the map has fewer territories than players), that player is instead eliminated: `territoryCount` stays `0` forever, so they show as `eliminated` from the moment `'territory'` ends onward (see `eliminated` below), exactly like a player who never owned any territory. This can only happen to whichever players are still waiting on their first claim once the map runs out.

Once every territory is claimed (immediately, under `'Random'`/`'Semi'`; after `'territory'` finishes, under `'Custom'`), `'Semi'` and `'Custom'` both enter `'troop'`: each player is given a starting-troop pool (`ownedTerritoryCount * 2` either way, since each territory's first troop was already placed, on claim under `'Custom'` or on assignment under `'Semi'`; plus the same turn-order bonus described above), and players take turns cycling the same way as `'territory'`, each spending up to `3` of their own pool per turn: `troopsToDeploy` is set to `min(3, pool)` the moment a player's turn begins, and they call `game:placeTroop` as many times as they like (any number of territories, splitting the `3` across them however they choose) until it reaches `0`, exactly like `'deploy'` (see below) except capped at `3` and with no attack phase to follow; a player whose pool drops below `3` simply gets a smaller turn (`1` or `2`) each time, down to whatever's left. Once `troopsToDeploy` reaches `0`, play passes to the next player with pool remaining; a player whose pool is fully spent is skipped over for the rest of `'troop'`, and the phase ends once every player's pool is empty. `troopsToDeploy` sits at `0` outside both `'deploy'` and `'troop'`.

In `'Capitals'`, `turnPhase` starts at `'capital'` instead of `'deploy'` and stays there until every player has picked one: `turnPlayerIndex` walks `0` to `players.length - 1` once, in turn order, each player calling `game:selectCapital` to name one of their own territories as their capital (a player who surrenders, see `game:surrender` below, during this phase is skipped over the same as during normal turns, and gets no capital unless it was already their turn to pick at that moment, in which case one is still picked for them at random, exactly as timing out would); the map's `bonuses` panel and every other action stay locked out until this finishes, since `'attack'`/`'fortify'` don't exist yet and `'deploy'` hasn't started. `turnNumber` stays at `0` for the whole `'capital'` phase: each player's pick advances `turnPlayerIndex` only, never `turnNumber`, so clients conventionally render it as "Turn 0" during this phase rather than the usual `turnNumber + 1`, since no round has actually begun yet. A capital is a permanent property of the territory itself, not its owner: `isCapital` (see `GameState.territories` above) never changes once set, even if the territory is later conquered, so a player controls exactly one capital right after placement, but that count can rise (by conquering another player's) or fall to `0` (by losing their own) as the game goes on. Picking grants `3` troops on the spot (broadcast as `game:deployed`, see below) and is bound by a fixed `60` second per-player timer, independent of the game's own `turnDuration` (same idea as `'territory'`/`'troop'`'s fixed `10` seconds, just a longer one since a capital pick is a more consequential choice): a player who doesn't call `game:selectCapital` in time has one picked for them at random from their own territories, exactly as an unattended `'deploy'` drops leftover troops randomly. Once the last player has picked, the game proceeds exactly as `game:start` would otherwise begin it: `turnNumber`/`turnPlayerIndex` reset to `0` and `turnPhase` becomes `'deploy'` for the first player in turn order. `game:nextPhase` always rejects `'capital'` (`cannot skip capital phase`); it can only be left by picking.

In `'Continent'`, the server picks one continent, once, at `game:start`, before territories are dealt out, and stores its id as `continentId` (the same continent numbering the map's `bonuses` array is indexed by, see `'deploy'` below); `continentId` is `null` in every other mode and stays fixed for the rest of the game once set. Among every continent on the map with at least `7` territories, one is chosen uniformly at random; if the map has none that large, the server instead chooses uniformly at random among whichever continent(s) tie for the most territories. The win condition this drives is described below.

`'deploy'` is the one phase `game:nextPhase` cannot advance (`cannot skip deploy phase`); it only ends once the current player has placed every troop available that turn, via `game:deploy` (see below). Entering `'deploy'` (turn start, or the timer force-advancing from the last phase) silently grants the player a troop pool: `max(3, floor(territoryCount / 3))`, plus, for every continent where they own every territory, that continent's entry in the map's `bonuses` array, plus, in `'Capitals'`, `2` for every capital the player currently controls (always at least their own, more if they've captured others'). `troopsToDeploy` is that pool, decremented as the player calls `game:deploy`; it sits at `0` outside `'deploy'` and in the `lobby` state.

`'attack'`, `'fortify'`, `'entrench'`, and `'toxins'` are each skipped automatically, the instant they'd otherwise begin, if the player has no legal move in them: `'attack'` needs some owned territory with more than `1` troop next to an enemy one or a free-conquest territory (see the `toxins` paragraph below); `'fortify'` needs some owned territory with more than `1` troop next to another territory the same player owns; `'entrench'` needs some owned, non-capital territory with at least `2` troops (and is skipped outright whenever `entrenchments` is `'off'`, regardless of troops); `'toxins'` needs the player to own more than one territory (toxining a player's last territory would eliminate them, which is never allowed) and, among all but their last, some owned, non-capital territory with enough troops to afford the current toxin cost whose removal wouldn't split the map (see the `toxins` paragraph below), and is skipped outright whenever `toxins` is `'off'`. This is re-checked (and skipped past again if it still doesn't hold) every time entering the phase would otherwise happen: after `'deploy'` ends, after every `game:attack` that doesn't leave a conquest pending, after every `game:attackMove`, after every `game:entrench`, after every `game:toxins`, and after `game:fortify`/timeout would normally hand off to the next phase, so a player can never be left stuck in a phase with nothing legal to do in it. Clients are expected to mirror this check locally (independently of whatever the server has already done) and call `game:nextPhase` themselves the moment they detect it, as a redundant safety net rather than the source of truth; the server's own skip always wins.

`entrenchments` (`'off'` by default) gates the `'entrench'` phase: while `'on'`, a territory can be entrenched by spending troops straight off its own stack via `game:entrench` (see below), and an entrenched territory (`entrenchedTurns > 0`, see `GameState.territories` above) always defends with `3` dice regardless of `defenceDice`, the same override a capital gets. Since that would make `defenceDice: 3` and entrenchment redundant together, `entrenchments` can only be set to `'on'` while `defenceDice` is `2` (`game:settings` rejects it otherwise with `invalid entrenchments`), and switching `defenceDice` to `3` silently forces `entrenchments` back to `'off'`. `entrenchedTurns` decrements by `1` the instant a territory's owner's next turn begins (i.e. `'deploy'` starts for them again), reaching `0` and clearing entirely once its turns run out; conquering an entrenched territory also clears it immediately, since entrenchment doesn't transfer to a new owner. Capitals can never be entrenched.

`toxins` (`'off'` by default) gates the `'toxins'` phase: while `'temporary'` or `'permanent'`, a territory can be toxined by wiping its own troop stack entirely via `game:toxins` (see below), paying a cost taken directly from that stack — `5` troops under `'temporary'` or `10` under `'permanent'`, with `cards: 'Constant'`, or `25%`/`50%` (rounded up) of `nextSetBaseValues.mixed` otherwise (see "Territory cards" below) — and removing it from `territoryOwners` (any troops beyond the cost are forfeited along with the rest, not refunded) while adding it to `toxinTerritories` instead (a parallel array to `territories`, since a toxined territory has no owner and so can never appear in `territories` itself; see `GameState` above). A toxined territory is completely inaccessible while toxined: it can't be attacked, fortified into, selected, or toxined again. Under `'temporary'`, its `turnsRemaining` starts at `3` and decrements by `1` once per full round (the instant `turnNumber` increments, same trigger as the portal rotation described under `portals` above), so every player gets exactly 3 turns' worth of a full round each while it's active, regardless of player count (unlike `entrenchedTurns`, which decrements per individual owner turn — a toxined territory has no owner to key that off, and no single "turn" of its own to count either); reaching `0` broadcasts `game:toxinExpired` (see below) and removes it from `toxinTerritories`, at which point the territory stays unowned but is no longer toxined, so it becomes a free-conquest attack target (see `game:attack` below). Under `'permanent'`, `turnsRemaining` stays `0` and the toxin never clears on its own. A territory can never be toxined if doing so would split the remaining, non-toxined territories into more than one connected group (following each territory's neighbors, portal edges included when active). Capitals can never be toxined, and a player can never toxin their own last remaining territory, since that would eliminate them.

### Territory cards

At `game:start`, the server builds a deck of one card per territory (`territoryId` 0 to the map's territory count − 1, displayed 1-based to the user) plus two wild cards (`territoryId: null`), and deals none of it out. This deck, and every player's hand, live only on the server: no `game:state` field ever exposes them. Each non-wild card carries a `symbol`: `'soldier'`, `'humvee'`, or `'tank'`, distributed as evenly as the territory count allows across the three (any leftover after an even three-way split gets a random symbol each); wild cards have `symbol: null`. A player's own hand is pushed to them individually (see `game:cards` below) whenever it changes; every client sees only `cardCount` per player in `GameState.players`.

Whenever the current player's turn ends (via `game:fortify`, `game:entrench`, or `game:toxins`, whichever phase happens to be last given the current `entrenchments`/`toxins` settings; either way this can also happen through a `game:nextPhase` call that ends the turn, or the turn timer force-ending it) and that player conquered at least one territory during the turn's `'attack'` phase, they're dealt one random card from the deck as their turn ends.

A **set** is any 3 cards forming 3-of-a-kind (same symbol) or one of each symbol; a wild card stands in for whatever symbol a set still needs. `nextSetBaseValues` gives the troop bonus the *next* set played would earn for each possible composition: under `cards: 'Constant'` these are permanently `{ soldier: 4, humvee: 6, tank: 8, mixed: 10 }`; under `'Linear'`, all four equal a single value that climbs with a game-wide count of sets already played (by anyone), following `4, 6, 8, 10, 12, 15, 20, 25, 30`, then `+5` per further set; under `'Exponential'`, all four equal a single value starting at `5` for the game's first set and, for each set after, `ceil(previous × 1.3)`. `'Linear Per Player'` and `'Exponential Per Player'` follow the same two progressions respectively, except each player advances their own count independently instead of sharing one game-wide progression: playing a set only advances the *player who played it*, so a player who hasn't played any sets yet always sees the progression's starting value regardless of how many sets others have played. Since only the current turn player can ever play a set, `nextSetBaseValues`/`upcomingSetValues` always reflect that player's own progress under the per-player modes. `upcomingSetValues` previews this same progression further out: the value of each of the next 3 sets to be played (game-wide, or by the turn player alone under a per-player mode), in order, `upcomingSetValues[0]` always matching `nextSetBaseValues`' single value, so a client can show where values are headed under any mode but `'Constant'` even before the player holds a playable set; always empty under `'Constant'`, since its values never change. During `'deploy'`, playing a set (`game:playCardSet`) adds its value to `troopsToDeploy` for the caller to place normally, and additionally (for any card in the set whose territory the caller currently owns) immediately adds 2 troops straight onto that territory (not drawn from `troopsToDeploy`, see `game:deployed` below).

Because playing a set only requires deploy phase and never costs the player anything but the cards, `'deploy'` no longer always ends the instant `troopsToDeploy` reaches `0`: it only auto-advances to `'attack'` if the player *cannot* currently form any valid set from their hand. If they can, they stay in `'deploy'`: free to play the set, ignore it, or (once `troopsToDeploy` is back at `0` again) explicitly move on via `game:nextPhase`. The one exception is a hand of `5` or more cards: `game:nextPhase` refuses to leave `'deploy'` (`must play a card set`) until a set is played and the hand drops below `5`, which, by construction, is always possible from `5+` cards.

Whenever an attack (see `game:attack` below) eliminates a player (their `territoryOwners` count drops to `0`), the attacker immediately receives the eliminated player's entire hand. If that leaves the attacker with `5` or more cards, their pending conquest move resolves automatically at the minimum troop count (as the turn timer would), `turnPhase` snaps back to `'deploy'` for the rest of their turn, and, if less than 50% of their `turnDuration` remains, `turnStartedAt` is rewound so exactly 50% remains.

### Missions

At `game:start` in `'Mission'` games, and in `'Assassin'` games (a restricted case of the same system, see below), every player is secretly assigned one **mission**: a private objective that wins them the game the instant it's accomplished (checked alongside every other end-of-game condition, see the shared end-of-game paragraph below). This assignment lives only on the server for the rest of the game, exactly like a player's hand of cards above: no `game:state` field ever exposes anyone's mission, including the caller's own to anyone else.

Assignment is uniform and independent per player: first, a mission *type* is picked uniformly from `'territories'`, `'continents'`, or `'assassinate'` (in `'Assassin'` games, the choice is fixed to `'assassinate'` for every player, making it exactly this same system with only one type in play), except `'continents'` is left out of that choice entirely for a map with no valid continent combination (see below), so the type is then picked uniformly from whichever of the three remain; then a specific mission of the chosen type is picked uniformly:
- **`'territories'`**: control a fraction of the map's territories, uniformly `1/2` or `3/4`. The `1/2` variant additionally requires at least `2` troops on every one of those territories; the `3/4` variant has no troop minimum. Accomplished the moment the player's own qualifying territory count reaches `ceil(territoryCount × fraction)` (`territoryCount` being the map's total).
- **`'continents'`**: fully control a specific combination of `2` to `4` continents (every territory in each, not just a majority). At `game:start`, the server computes every *minimal* such combination whose territories together make up at least `1/4` of the map; a combination qualifies only if no smaller in-range combination inside it already does (conquering that smaller one would already satisfy the mission, so its supersets aren't offered as separate missions; a continent that clears the threshold on its own still ends up paired into `2`-continent missions rather than dropping out of this mission type, since a `1`-continent combination is never a candidate); and the assigned combination is picked uniformly from that set. If a map has no such valid combination at all, `'continents'` is dropped from the mission type pool entirely for that game (see below), so a player never draws it with nothing to assign.
- **`'assassinate'`**: eliminate one specific other player. Targets come from a random derangement over the game's (already randomized) turn order (each player's candidate target is the next player in `players`, wrapping around), restricted to whichever players actually drew this mission type, so no player targets themselves and no two players sharing this mission type ever share a target. Accomplished the instant the assigned player's own attack eliminates that target (their `territoryOwners` count drops to `0`, see `game:attack` below); if someone *else* eliminates that target first, this player's mission instead falls back to the `'territories'` `3/4` condition above, checked from then on using their own current territory count.

A player's own mission is pushed to them individually (see `game:mission` below): the only place it's ever revealed, and only to the player it belongs to. It's fixed for the whole game, never reassigned once accomplished or made unreachable (e.g. an `'assassinate'` target dying to someone else). A client tells whether an `'assassinate'` mission's target is still alive by looking up its `eliminated` flag on `GameState.players`. Outside `'Mission'`/`'Assassin'`, no player has a mission and the event is never sent.

`selectedTerritoryId` is the territory the player at `turnPlayerIndex` currently has selected (`null` if none), set via `game:selectTerritory`: it's part of `GameState` so every client, not just the selecting player, sees the same selection highlighted on the map. It resets to `null` whenever the turn or phase changes (including the automatic `'deploy'` → `'attack'` advance) and whenever a `game:deploy` or `game:placeTroop` succeeds, regardless of whether the player's troop pool is now empty.

`fortification` controls which pairs of the caller's own territories troops can move between during `'fortify'` (see `game:fortifySelectStart` / `game:fortifySelectEnd` below): under `'Connected'` (the default), the start and end territory must be joined by a path of territories the caller owns; under `'Neighboring'`, they must be direct neighbors of each other; under `'Unrestricted'`, any two territories the caller owns qualify, connected or not.

`portals` (`'off'` by default) adds extra neighbor links to the map: every territory listed in `portalTerritoryIds` is treated as a direct neighbor of every *other* territory in that list, in addition to its normal geographic neighbors, wherever adjacency is checked (`'attack'` start/end candidates, and `'fortify'`'s `'Neighboring'`/`'Connected'` adjacency, see `fortification` above; `'Unrestricted'` fortify already ignores adjacency, so portals change nothing there). This only applies while `portalsEnabled` is `true`; while `false`, `portalTerritoryIds` still lists the current portal locations (so clients can keep drawing them) but they grant no adjacency. `portalTerritoryIds` is always empty and `portalsEnabled` always `false` under `'off'`. The number of portals is `min(6, ceil(territoryCount / 10), continentCount)` (`territoryCount` and `continentCount` being the map's totals), placed on random territories such that no territory has more than one portal, no two portals sit on directly (geographically) neighboring territories, and no two portals sit in the same continent; this selection happens once turn tracking actually begins (see `turnNumber` above: the moment the first `'deploy'` phase starts, after any `'territory'`/`'troop'`/`'capital'` phase has finished), for both `'static'` and `'dynamic'`. Under `'static'`, that placement is permanent: `portalsEnabled` is `true` for the rest of the game and `portalTerritoryIds` never changes. Under `'dynamic'`, portals alternate every round: freshly placed, `portalsEnabled` starts `false` for round `0` (`turnNumber: 0`); it flips to `true` for round `1` with no change in location; round `2` moves every portal to a newly chosen set of territories (same placement rules, plus none of the new territories were a portal in the immediately preceding set) and sets `portalsEnabled` back to `false`; round `3` flips it back to `true` with no move; and so on, alternating for the rest of the game.

`radiations` (`'off'` by default) marks some territories completely unusable: no owner, no troops, and inaccessible the same way a toxined territory is (can't be attacked, fortified into, selected, or counted toward anyone's `territoryCount`). `toxins` and `radiations` can both be on in the same game; `game:settings` no longer rejects either one for the other being on. A single territory is still never both toxined and radiated: `game:toxins` rejects toxining a territory the caller doesn't own, which a radiated territory never is, and `radiations`' `'dynamic'` rotation (see below) never moves onto a currently-toxined territory. `'expanding'` radiation is the one exception, since its growth can land on a currently-toxined territory like any other eligible neighbor, silently clearing that toxin the instant the territory turns radiated. Either way, toxining a territory and radiation's own "would split the map" check (see the `toxins` paragraph above) each treat the other's current territories as removed too, alongside their own. Capitals can never be radiated. Unlike toxins, radiation is never placed by a player action: the server decides it entirely on its own. Placement happens once, at `game:start`, *before* territories are dealt out (so `'Random'`/`'Semi'` dealing, and `'Custom'`'s claimable set, both exclude whatever's radiated from the start): `min(8, ceil(territoryCount / 10))` territories under `'static'` or `'dynamic'` (`territoryCount` being the map's total, same formula for both), or exactly `1` under `'expanding'`. `radiationTerritoryIds` lists the currently-radiated territories; always empty under `'off'`.

Under `'static'`, that placement is permanent: `radiationTerritoryIds` never changes for the rest of the game. Under `'dynamic'` and `'expanding'`, it changes every 2 rounds, on a fixed cycle synchronized with `turnNumber` the same way `portals`' `'dynamic'` rotation is (see above): nothing changes for an even `turnNumber`'s round; at the moment `turnNumber` becomes odd, the server computes what's about to happen and publishes it as `radiationUpcomingTerritoryIds` (a preview, one full round in advance, of what `radiationTerritoryIds` will become) and broadcasts `game:radiationUpcoming` (see below); at the moment `turnNumber` next becomes even, that computed set is applied — it becomes the new `radiationTerritoryIds` and `radiationUpcomingTerritoryIds` reverts to empty — and the server broadcasts `game:radiationChanged` (see below). `radiationUpcomingTerritoryIds` is always empty except during that one preview round. Under `'dynamic'`, each currently-radiated territory independently picks one of its own neighboring territories to move into (never a capital, or a territory some other radiated territory is simultaneously moving into — though moving into a territory a *different* radiated territory is simultaneously moving out of is fine, since both changes land at the same instant); a territory with no eligible neighbor that round simply stays put — nothing happens to it. `radiationUpcomingTerritoryIds` under `'dynamic'` is the *complete* resulting set (same size as `radiationTerritoryIds`, since every instance either moved or stayed), not just the ones that changed. Under `'expanding'`, the current set never loses a territory: exactly one eligible neighbor of the current set (if any exists) is added on top of it each cycle, so `radiationUpcomingTerritoryIds` is `radiationTerritoryIds` plus that one addition (or, if nothing eligible exists that cycle, identical to `radiationTerritoryIds` — nothing happens). Either way, "eligible" always means: not already radiated, not a capital, and wouldn't split the map (per the check described above). Under `'dynamic'`, a territory a radiated instance moves out of stops being radiated the instant `game:radiationChanged` applies the move: like a toxin clearing, it stays unowned but becomes a free-conquest attack target with no dice roll required (see the `toxins` paragraph above).

Whenever a territory becomes newly radiated (initial placement never applies here, since no territory is owned yet at that point; only a `'dynamic'`/`'expanding'` cycle can), any troops it held are destroyed and it's removed from `territoryOwners` entirely, exactly as toxining wipes a territory (see the `toxins` paragraph above), except there's no cost or troop threshold to it. If that was the owner's last territory, they're eliminated (`territoryCount` reaches `0`) exactly as an attack-caused elimination would be, including the same end-of-game check (see `winnerIds` below) — the only difference from a combat elimination is that no other player's `playersKilled` is credited for it, since there was no attacker.

`starvation` (`'off'` by default) penalizes a player for massing troops on a single territory instead of spreading out; either way, a territory's troops are never reduced below `1` by it. It's checked once per player, whenever their turn ends (the same moment card-conquest draws and, once tracked, `nextAlivePlayerIndex`/`turnNumber` advance happen), regardless of whether the turn ended normally, via `game:nextPhase`, or via the turn timer. Under `'territory'`, every owned territory is capped individually at `30` troops; any territory over that, at the moment the check runs, has its excess removed. Under `'total'`, a player's troops across every territory they own are capped at `3` times the map's total territory count (`territoryCount`); if their total exceeds it, troops are removed one at a time from whichever owned territory currently has the most (which can change mid-removal as the largest shrinks) until the total is back at the cap or every owned territory is down to `1` troop. Under `'percent'`, the player's *largest army* (the owned territory with the most troops; the first one found if several tie) loses `30%` of its troops, rounded down. Any troops removed this way, under any of the three modes, are broadcast via `game:starved` below, one entry per territory actually touched, and recorded as `'starve'`-type `ReplayFrame`s (see above) the same way.

`turnTroops` (`'off'` by default) grants every player extra troops each turn on top of their normal deploy pool (see `turnPhase` above): under `'on'`, entering `'deploy'` adds `turnNumber + 1` troops to that turn's `troopsToDeploy` (`1` on turn 1, `2` on turn 2, and so on), reflected in `game:turnStarted`'s `troopsFromTurnTroops` field below. `bounties` (`'off'` by default) rewards eliminating other players: under `'on'`, entering `'deploy'` adds `10` troops to that turn's `troopsToDeploy` for every player this player has ever eliminated by conquest (`playersKilled.length`, see `GameState.players` above), permanently and cumulatively for the rest of the game, reflected in `game:turnStarted`'s `troopsFromBounties` field below. Both are folded into `troopsToDeploy` the same way territory/continent/capital troops are, and neither applies to the `'territory'`, `'troop'`, or `'capital'` phases' own troop grants.

`supplyLines` (`'off'` by default) restricts which of a player's own territories `game:selectTerritory` (during `'deploy'`/`'troop'` only) and `game:deploy`/`game:placeTroop` will accept: under `'on'`, a deposit is only accepted on a territory reachable from one of the caller's supply hubs by a path of territories the caller owns (the same connectivity `fortification: 'Connected'` uses, see the `fortification` paragraph above, portal edges included when active). A player's hubs are every capital they currently own (`isCapital: true`, see `turnPhase` above) if they own at least one, *regardless of `gameMode`* (a non-`'Capitals'` game simply never has any capitals, so this case never applies there); otherwise, their own territories are split into clusters connected only through territories they themselves own (the same connectivity notion as above), and the sole hub is the single highest-troop territory within whichever one cluster ranks highest by, in order: combined troop count across the whole cluster, then territory count, then that cluster's own single highest troop count, then (to break a tie at that highest troop count) the lowest territory id — every other cluster gets no hub at all and stays entirely unreachable for deposits until reconnected to the hub's cluster. Capitals and armies are never combined as hubs; the army-cluster fallback only ever applies when the player owns zero capitals. A territory that is itself a hub always qualifies trivially. This has no effect on troops placed any other way: a capital's own `3`-troop grant (`game:selectCapital`), a card set's automatic 2-troop territory bonuses (`game:playCardSet`), or the turn timer dropping leftover troops at random, are never subject to it, even onto a territory the path check would otherwise reject.

`fogOfWar` (`'off'` by default) restricts each player's own view of the board once in effect: a player sees only their own territories and every territory directly adjacent to one of them (portal edges included when active) — everything else is indistinguishable from unclaimed to them, both in `GameState` and in every action broadcast (see `GameState` above and the affected events below). It has no effect during the `'territory'` or `'troop'` phases (every territory is still being assigned or is not yet reachable from anyone's holdings, so full visibility applies to everyone regardless of this setting), taking effect starting with `'capital'` and remaining in effect for the rest of the match. It never restricts spectators, and never restricts a player once they're eliminated or have surrendered — both see the board exactly as if `fogOfWar` were `'off'`. It has no effect on `game:replay` (always full-fidelity, see "Shared types" above), `game:cards`/`game:mission` (already private per-player), `game:turnStarted` (carries no territory ids), or chat/emoji.

`fortifyStartTerritoryId` and `fortifyEndTerritoryId` track the two-step territory selection specific to the `'fortify'` phase, set via `game:fortifySelectStart` / `game:fortifySelectEnd` below (both `null` outside an in-progress fortify selection). Like `selectedTerritoryId`, they're part of `GameState` so every client sees the same start/end highlighting and, once both are set, the same animated arrow between them; `game:selectTerritory` is not used during `'fortify'`. Both reset to `null` whenever the turn or phase changes and whenever a `game:fortify` succeeds.

`attackStartTerritoryId` and `attackEndTerritoryId` track the same kind of two-step selection for the `'attack'` phase, set via `game:attackSelectStart` / `game:attackSelectEnd` below (both `null` outside an in-progress attack). Unlike fortify, they are **not** cleared once `game:attack` resolves an attack that fails to fully conquer the defending territory, nor once it does (`game:selectTerritory` is not used during `'attack'`, either). A failed or inconclusive attack (defender still owns the territory afterward) resets both to `null`, letting the player pick a fresh attack. A conquering attack (defender's territory reaches `0` troops) instead transfers `territoryOwners` for `attackEndTerritoryId` to the attacker immediately but leaves both ids set and populates `attackConquestMinTroops`: the game is now waiting on `game:attackMove` to finish moving troops in, and no other attack-phase action (including `game:nextPhase`) is accepted until it does. `attackConquestMinTroops` is `null` whenever no conquest is pending. All three reset to `null` whenever the turn or phase changes.

`team` is only meaningful when `gameMode` is `'Team Deathmatch'`; it always defaults to `0` otherwise and is ignored by the client. Its valid range is `0` to `max(0, players.length - 1)`, one value per player, so team counts from a single shared team up to every player on their own team are all valid. The client displays teams 1-based (`team + 1`); the wire value stays 0-based.

`color` is an index into a 20-entry palette the client owns: the server sends only the index, never actual color values. Assigned at random when seated (`game:create`, `game:join`, spectator promotion), always unique among current players. To keep early joiners' colors nicer (palette ordered nicest-first), both random assignment and `game:cycleColor` are restricted to the first `min(20, players.length + 3)` indices. Spectators have no color.

`territoryCount` and `troopCount` are the number of territories the player currently controls and the total troops on them; both are `0` until the game starts. `capitalCount` is how many capitals (territories with `isCapital: true`, see `turnPhase` above) the player currently controls; always `0` outside `'Capitals'`, since no territory is ever marked a capital in other game modes. `troopsRemaining` is how many troops this player still has left in their starting-troop pool (see `turnPhase` above); always `0` outside `'troop'`. It's populated for every player, not just whoever's turn it currently is, but is chiefly meant to be paired with `troopsToDeploy` for the active player: a client showing "current turn's troops / troops left overall" (e.g. `3/42`) reads `troopsToDeploy` and this player's `troopsRemaining` together. Once `game:start` succeeds, `players` is reordered into the game's randomized turn order and stays that way for the rest of the game.

The remaining `players` fields are running totals for the whole game, all `0`/empty until `game:start` and never reset afterward: meant for the end-of-game stats screen, but updated live throughout `'playing'` too. `troopsGained` counts troops gained during play only (turn deploy pools, card-set territory bonuses, capital bonuses); not the initial random troop placement `game:start` deals out. `troopsKilled` and `troopsLost` count enemy/own troop losses from every attack this player was on either side of (attacker or defender), regardless of whether the attack conquered anything. `territoriesConquered` and `territoriesLost` count every ownership-flipping conquest this player caused or suffered (conquering the same territory twice counts twice). `capitalsConquered` and `capitalsLost` are the same count restricted to conquests of a territory with `isCapital: true`; always `0` outside `'Capitals'`, since no territory is ever marked a capital in other game modes. `cardsGained` counts every card ever added to this player's hand (the end-of-turn conquest draw, plus an eliminated opponent's hand transferred on elimination). `playersKilled` lists the ids of every player this player has eliminated (reduced to zero territories) by conquest; a client can look up their names in `players`/`bannedPlayers`, since an eliminated player is never removed from `players`. `turnsPlayed` is how many of this player's own turns have completed (normally or via the turn timer), stopping once they die or the game ends, pair it with `turnNumber + 1` for a "turns played / total turns" figure. `setsPlayed` is how many card sets this player has played, manually or auto-played by the turn timer (see `turnDuration` above).

`connected` is whether the player currently has a live socket on the server *and* that socket's current room membership is still this game (i.e. hasn't navigated elsewhere via a mismatched-room `player:identify`, see "Leaving and reconnecting" above); this stays live after `state` becomes `'ended'` too, so an end-of-game UI reflects a player disconnecting, clicking "leave", or reconnecting after the fact. It's independent of `surrendered`: a player can be connected and surrendered, disconnected and not surrendered, or any other combination — surrendering doesn't disconnect them, and disconnecting doesn't surrender them. `connected` is otherwise informational only: an absent, not-surrendered player's territories, troops, and turn are still tracked exactly like anyone else's.

`eliminated` is `true` once the player owns zero territories (`territoryCount === 0`), and always `false` in the `lobby` state, before territories are dealt, and during `'territory'` itself (see `turnPhase` above): territory ownership is still being claimed at that point, so owning none yet doesn't mean a player is out, only that their claim hasn't come up (or, under `'Custom'`, isn't guaranteed one) yet; it becomes accurate again the moment `'territory'` ends. An eliminated player is skipped over in turn order (see `turnPlayerIndex` above) and rejected by every other `game:*` action that requires owning a territory (which, having none, is all of them) plus `game:surrender` (`already eliminated`); `game:chat` is unaffected. They keep receiving `game:state` like anyone else, so they can keep watching the game play out.

`territories` is empty until the game starts; once `playing`, it lists every territory on the map with its current owner (`ownerId`, a player's `id`) and troop count.

The server checks for the end of the game every time a territory is conquered (see `game:attack` below), every time a player surrenders (see `game:surrender` below), and every time a turn ends and hands off to the next player: the last of these exists because, in `Capitals` and `Continent`, the game's own `turnNumber` crossing the round-3 gate described below can turn an already-decided capitals or continent ownership into a win with no attack or surrender involved. Independent of game mode: if only one player is both not-surrendered and still owns at least one territory, the game ends immediately with that player as the winner (or, in `Team Deathmatch`, every player on their team), except in `Player Kills` / `Troop Kills`, where the winner is instead whichever seated player (any of them, not just the lone survivor) has the most `playersKilled` / `troopsKilled` respectively, ties broken by who died last (the lone survivor, having never died, wins any such tie) and then the same `territoryCount`/other-kill-stat/`troopsGained` cascade described under `finalRanking` below; no `turnNumber` minimum, no attack required, so a game can end the instant everyone else surrenders, capital phase or not. Besides that shared rule, each mode has its own way to end while more than one player is still un-surrendered: in `Supremacy`, the game ends the moment a single player owns every territory. In `Supremacy 3/4` / `Supremacy 2/3`, it ends the moment any un-surrendered player who still owns territory controls at least `ceil(territoryCount × 3/4)` / `ceil(territoryCount × 2/3)` territories (`territoryCount` being the map's total). In `Capitals`, it ends the moment either: a single player owns every territory (same as `Supremacy`), or a single player owns every capital (every territory with `isCapital: true`, see `turnPhase` above) *and* `turnNumber` is `2` or higher (i.e. the game is in its 3rd round or later), independent of who owns everything else; this `turnNumber` gate only applies to this capitals-ownership path, not to the shared lone-survivor rule above. In `Team Deathmatch`, it ends the moment every territory is owned by players on a single team. In `Continent`, it ends the moment a single player owns every one of `continentId`'s territories (see the `continentId` paragraph below) that isn't currently toxined or radiated, *and* `turnNumber` is `2` or higher (i.e. the game is in its 3rd round or later); this is the identical gate `Capitals` uses above, and for the same reason it applies only to this continent-ownership path, not to the shared lone-survivor rule above. A continent entirely toxined/radiated simply can't be won this way until at least one of its territories is owned again, and reaching full ownership of the continent before turn 3 doesn't end the game until the gate opens (it will, the instant it does, without requiring a further conquest). In `5-Turn` / `10-Turn`, it ends the moment `turnNumber` reaches `5` / `10` (i.e. that many full rounds have completed): the winner is whichever un-surrendered player who still owns territory then controls the most territories, ties broken the same way as the `finalRanking` tiebreak described below. In `Assassin` / `Mission`, it ends the moment any player accomplishes their own secret mission (see "Missions" below): that player wins outright. `Player Kills` and `Troop Kills` have no such separate path: they only ever end via the shared lone-survivor rule above. Either way, `state` moves to `'ended'`, `winnerIds` is set to that player's id (or every player id on the winning team), and the turn timer stops; `turnPhase`/`selectedTerritoryId`/`fortifyStartTerritoryId`/`fortifyEndTerritoryId`/`attackStartTerritoryId`/`attackEndTerritoryId`/`attackConquestMinTroops` reset exactly as they do on a normal turn change. `winnerIds` is empty while the game is `lobby` or `playing`.

`finalRanking` is every seated player's id, best-to-worst, computed once as part of ending the game and never recomputed afterward; empty while `state` is `lobby` or `playing`. The winner(s) (`winnerIds`) always rank first. In `'Team Deathmatch'`, the rest is teams in reverse order of elimination (the last team standing besides the winner ranks next, and so on; a team is "eliminated" the moment none of its members own any territory, tracked independently of any one member surrendering or being eliminated), and within each team, its own players are ordered by: not yet dead before dead (surrendering counts as dying here too, exactly like being eliminated by conquest, see below), then `playersKilled` count descending, then current `territoryCount` descending, then `troopsKilled` descending, then `troopsGained` descending. Outside `'Team Deathmatch'`, the rest is ordered by the reverse of when each player died: surrendering (`game:surrender`) counts as dying, exactly like being eliminated by conquest, whichever happens first for that player; so the most recently dead ranks just below the winner and the first to die ranks last; the one exception is `'Capitals'`, `'Continent'`, `'5-Turn'`, `'10-Turn'`, `'Assassin'`, and `'Mission'`, where the game can end while players other than the winner still own territory (never having died), and those are ranked between the winner and the dead using the same `playersKilled`/`territoryCount`/`troopsKilled`/`troopsGained` cascade as the Team Deathmatch tiebreak above, except in `'5-Turn'`/`'10-Turn'`, where that cascade instead starts with `territoryCount` descending (falling back to `playersKilled`/`troopsKilled`/`troopsGained` only to break a tie), matching how the winner itself is chosen in those two modes.

`'Player Kills'` and `'Troop Kills'` compute the whole ranking differently from every other mode: instead of ordering the living ahead of the dead, every seated player is sorted purely by `playersKilled` count (`'Player Kills'`) or `troopsKilled` (`'Troop Kills'`) descending — so a player who died having racked up many kills can outrank the lone survivor who has fewer — ties broken first by who died last (a still-living player, i.e. the lone survivor, having never died, always wins any such tie), then by the same `playersKilled`/`territoryCount`/`troopsKilled`/`troopsGained` cascade used elsewhere (see the Team Deathmatch tiebreak under `finalRanking` below), skipped past wherever it reaches the stat already used as the primary sort key: so `'Player Kills'` falls through to `territoryCount`, then `troopsKilled`, then `troopsGained`, while `'Troop Kills'` falls through to `playersKilled`, then `territoryCount`, then `troopsGained`. `winnerIds` is always just the single player ranked first by this same sort.

No further `game:*` actions are accepted once `state` is `'ended'` (they all require `'playing'`): the game just sits, still joinable as a spectator (see `game:join` below), until everyone still viewing it (players and spectators alike, going by `connected` and current game membership) has navigated away, at which point the server deletes it (same as `home:games` no longer listing it, and its room being torn down), subject to the same 5-second reconnect grace period described above, so a refresh doesn't delete an ended game either.

Players who never held a slot and couldn't be seated (lobby full, or the game already `playing`/`ended`) become **spectators**: same room, full `game:state` visibility, no roster slot, no gameplay actions. In the `lobby` state, spectators are an ordered queue (`spectators[0]` next in line): if a seated player leaves, the front spectator is promoted automatically. Nothing promotes spectators once `playing`, and leaving (or disconnecting from) a `playing` game never frees a seat, see "Leaving and reconnecting" above. A player who once held a slot always keeps it and is never demoted to spectator, however they left (disconnect, navigating away, or `game:surrender`), see "Leaving and reconnecting" above.

**Ack response**: `game:create`, `game:join`, `game:settings`, `game:start`, `game:cycleColor`, `game:nextPhase`, and `game:surrender` all reply via the Socket.IO acknowledgement callback with:
```ts
{ ok: true; game: GameState } | { ok: false; error: string }
```

---

## Client → Server

### `player:identify`
- **When sent:** once, immediately after connecting; re-sent on every reconnect (new tab, reload, dropped connection); and re-sent whenever the client's own declared room changes, e.g. after creating/joining a game, navigating back to `/`, or navigating directly to a different game's URL.
- **Purpose:** register this socket against a persistent player identity, and declare which room the client believes it's in: `'home'` or a game name. The server uses this to place the socket correctly and to detect stale membership: if `room` doesn't match its record (e.g. another tab is still in a game but this one reports `'home'`), it updates their game membership accordingly (see "Leaving and reconnecting" above). A reconnect also re-checks `hostId` for whatever game the player is in, in case a former host is due back (see `hostId` above).
- **Content:**
  ```ts
  { playerKey: string; playerName: string; room: string }
  ```
  `playerName` only sets the name the first time a `playerKey` is seen (player creation); later identifies (reconnects, tab duplicates) ignore it, since renaming is `player:setName`'s job. If it's empty, all-whitespace, or over 10 characters (trimmed) at creation, the server assigns a default name instead.
- **Ack:**
  ```ts
  { id: number; gameName: string | null }
  ```
  `id` is the caller's own id: assigned once, the first time the server sees this `playerKey`, and stable for as long as the player exists on the server. `gameName` is the player's actual game membership after the server resolved this identify (see "Leaving and reconnecting" above) — `null` if they're not seated/spectating anywhere. A seated, not-surrendered player in a `playing` game can never shed this by declaring `room: 'home'` (or any other game's name): the server keeps their membership and reports the real `gameName` back regardless of what `room` was requested, and the client always navigates to whatever `gameName` the ack reports when it differs from the requested `room`, forcing them back to their game. Surrendering, or simply never reconnecting after closing the tab, are the only ways to actually leave a `playing` game early; once `state` is `'ended'`, a mismatched-room identify clears membership as normal (see "Leaving and reconnecting" above), so leaving then works as requested.

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
- **Purpose:** create a game with default settings: name `Game with <playerName>` unless `name` is given, map `World`, 2 slots, `Supremacy` game mode, `Balanced` blitz, 2 defence dice, `Constant` cards, `Random` placement, entrenchments off, toxins off, portals off, radiations off, starvation off, turn troops off, bounties off, supply lines off, 120s turn duration; make the caller host and move their socket into the room.
- **Content:**
  ```ts
  { name?: string } // same validation as game:settings' name field; defaults to `Game with <playerName>` when omitted
  ```
- **Ack:** shared Ack response. Errors: `not identified`, `already in a game`, `invalid name`, `game name already in use`.

### `game:join`
- **When sent:** a player in `home` joins a game from the list, or navigates straight to a game's URL without joining from `home` first (sent right after `player:identify`, once per such navigation). In the URL-navigation case, if the ack comes back `game not found`, the client falls back to `game:create` with that name (see `game:create` above) to create the game at that URL; if that in turn fails with `game name already in use` (another client won the race), the client retries `game:join` once more.
- **Purpose:** add the caller to the game and move their socket into its room. If the game is still `lobby` with an open slot, they become a player; otherwise (full lobby, already `playing`, or `ended`) they become a spectator; this call never fails just because the game is full, in progress, or over. If it has a `password` set (see `GameState` above) and the caller has never successfully called `game:join` on this game before (as tracked server-side for the game's lifetime, keyed by the caller's player id, itself only ever assigned via their secret `key`, see "Player identity" above), `password` must match exactly, or the call fails without adding them; anyone who has joined before, even a game with no password at the time, is permanently exempt from this check for as long as the game exists, so neither a password change nor losing and regaining a seat (e.g. a page refresh) ever re-prompts someone who was already in.
- **Content:**
  ```ts
  { gameName: string; password?: string }
  ```
- **Ack:** shared Ack response. Errors: `not identified`, `already in a game`, `game not found`, `banned from this game`, `invalid password`.

### `game:settings`
- **When sent:** the host of a game changes any settings.
- **Purpose:** single bundled message for every settings mutation: rename, change map, slot count, ban list, a player's team, game mode / blitz / defence dice / cards / placement / fortification / entrenchments / toxins / portals / radiations / starvation / turn troops / bounties / supply lines / fog of war / turn duration / password / visibility. Only the fields present are applied; the caller must be host, and the game must still be `lobby`: nothing can change once `playing`. Fields apply in a fixed order: `mapName`, `gameMode`, `name`, `bannedPlayerIds`, `playerTeam`, `slots`, `blitz`, `defenceDice`, `cards`, `placement`, `fortification`, `entrenchments`, `toxins`, `portals`, `radiations`, `starvation`, `turnTroops`, `bounties`, `supplyLines`, `fogOfWar`, `turnDuration`, `password`, `visibility`, so `slots`/`playerTeam` are validated against the roster *after* any kicks in the same request, and `entrenchments` is validated against the (possibly just-updated) `defenceDice` from the same call. `gameMode` and the last seventeen fields are independent of the rest; their position otherwise doesn't matter, except `entrenchments` must come after `defenceDice`: setting `defenceDice` to `3` in the same call always forces `entrenchments` to `'off'` first, and `entrenchments: 'on'` is rejected outright unless `defenceDice` ends up `2`.
- **Content:** (all fields optional, only send what changed)
  ```ts
  {
    name?: string;              // trimmed; empty, all-whitespace, over 20 characters, or the reserved name `home` is rejected
    mapName?: string;
    slots?: number;            // 2–20, and never below the player count once bannedPlayerIds (if present) has been applied
    bannedPlayerIds?: number[]; // replaces the game's entire ban list
    playerTeam?: { playerId: number; team: number };
    gameMode?: 'Supremacy' | 'Supremacy 3/4' | 'Supremacy 2/3' | 'Capitals' | 'Team Deathmatch' | 'Continent' | '5-Turn' | '10-Turn' | 'Assassin' | 'Mission' | 'Player Kills' | 'Troop Kills';
    blitz?: 'Balanced' | 'True';
    defenceDice?: 2 | 3;
    cards?: 'Constant' | 'Linear' | 'Exponential' | 'Linear Per Player' | 'Exponential Per Player';
    placement?: 'Random' | 'Semi' | 'Custom';
    fortification?: 'Connected' | 'Neighboring' | 'Unrestricted';
    entrenchments?: 'off' | 'on'; // 'on' requires defenceDice to be (or become, in this same call) 2
    toxins?: 'off' | 'temporary' | 'permanent';
    portals?: 'off' | 'static' | 'dynamic';
    radiations?: 'off' | 'static' | 'dynamic' | 'expanding';
    starvation?: 'off' | 'territory' | 'total' | 'percent';
    turnTroops?: 'off' | 'on';
    bounties?: 'off' | 'on';
    supplyLines?: 'off' | 'on';
    fogOfWar?: 'off' | 'on';
    turnDuration?: 60 | 90 | 120 | 150 | 180 | 300; // seconds
    password?: string | null;  // trimmed; empty/all-whitespace is rejected, over 50 characters is rejected; null clears it
    visibility?: 'public' | 'private';
  }
  ```
  `bannedPlayerIds` replaces the whole ban list at once, not one id at a time: to kick, send the current `bannedPlayers` ids (from `game:state`) plus the new one; to unban, send them minus the id. Any newly-present id belonging to a current player or spectator is kicked (evicted, sent `game:kicked`); the host's own id is silently dropped rather than self-banning.

  `playerTeam` sets one player's `team` (see `GameState.players` above for its valid range); rejected with `invalid team` unless `playerId` is currently a player (not a spectator) and `team` is an integer within that range.
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `not the host`, `game already started`, `invalid name`, `invalid map`, `invalid slots`, `invalid banned players`, `invalid team`, `invalid game mode`, `invalid blitz`, `invalid defence dice`, `invalid cards`, `invalid placement`, `invalid fortification`, `invalid entrenchments`, `invalid toxins`, `invalid portals`, `invalid radiations`, `invalid starvation`, `invalid turn troops`, `invalid bounties`, `invalid supply lines`, `invalid turn duration`, `invalid password`, `invalid visibility`, `game name already in use`.

### `game:cycleColor`
- **When sent:** a player clicks their own color in the lobby's player table.
- **Purpose:** change the caller's own `color` to the next available one; unlike `game:settings`, no host privileges needed since players only change their own color. Starting from the caller's current index, the server walks forward (wrapping) through the same restricted range described under `color` above, stopping at the first one unused by another player. The caller must be a seated player (not spectator), and the game must still be `lobby`: colors can't change once playing.
- **Content:** none
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `not a player`, `game already started`.

### `game:start`
- **When sent:** the host of a game starts it from the lobby.
- **Purpose:** move the game from `lobby` to `playing`, switching every client from the Lobby subpage to the Map subpage. The caller must be host, with at least 2 players; if `gameMode` is `'Team Deathmatch'`, at least 2 distinct teams must be represented among them too. If it is `'Team Deathmatch'`, `team` values are also compacted to remove gaps left by the host skipping numbers (e.g. teams `0` and `2` but no `1` become `0` and `1`), preserving their relative order. Player order (`players`) is then set at random to establish turn order: plain random shuffle normally, but for `'Team Deathmatch'` it's randomized *and* interleaved so two teammates never end up back-to-back (wrapping from the last player to the first counts too) unless a team's size makes that unavoidable, in which case it's kept to the minimum number of forced adjacencies. Territories and starting troops are then handed out according to `placement` (see `turnPhase` above): under `'Random'`, the map's territories are dealt out as evenly as possible (if they don't divide evenly, the last players in turn order get one extra each), each starting with 1 troop plus `territoryCount * 2` more (and a turn-order bonus) dropped at random; under `'Semi'`, territories are dealt out the same way but no troops are placed yet; under `'Custom'`, no territories are dealt out at all. Turn tracking starts here too: `turnNumber`/`turnPlayerIndex` set to `0`, `turnPhase` set to whichever of `'territory'`, `'troop'`, `'capital'`, `'deploy'` is first in the sequence `placement` and `gameMode` call for (see `turnPhase` above), and the server begins counting down the first player's turn (`turnDuration`, or the fixed timer `'territory'`/`'troop'`/`'capital'` use instead, whichever phase it started in; see `turnNumber` above).
- **Content:** none
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `not the host`, `already started`, `not enough players`, `not enough teams`.

### `game:pause`
- **When sent:** the host of a `playing` game toggles pause, from the players panel.
- **Purpose:** toggle `paused` (see above). The caller must be host, and the game must be `playing`.
- **Content:** none
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `not the host`, `game not started`.

### `game:claimTerritory`
- **When sent:** in `'Custom'` games only, the player whose turn it currently is to claim, during `'territory'`, clicks an unclaimed territory.
- **Purpose:** assign `territoryId` to the caller and seed it with `1` troop (broadcast as `game:territoryClaimed`, see below, not `game:deployed`), then advance to the next player's claim, or, once every territory is claimed, move on to `'troop'` (see `turnPhase` above). The caller must be the player at `turnPlayerIndex`, the game must be `playing` and in `'territory'`, and `territoryId` must be a valid, currently-unclaimed territory.
- **Content:**
  ```ts
  { territoryId: number }
  ```
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `game not started`, `game paused`, `not territory phase`, `not your turn`, `invalid territory`, `territory already claimed`.

### `game:placeTroop`
- **When sent:** in `'Semi'` or `'Custom'` games only, the player whose turn it currently is to place, during `'troop'`, deposits some of their turn's troops (see `turnPhase` above) on one of their own territories, same as `game:deploy`.
- **Purpose:** add `troops` to `territoryId` and deduct it from both `troopsToDeploy` (this turn's `min(3, pool)` allotment) and the caller's remaining starting-troop pool, clearing `selectedTerritoryId` in the process, and broadcast `game:deployed` like any other deposit. Once `troopsToDeploy` reaches `0`, play advances to the next player who still has pool left, or, once every pool is empty, moves on to `'capital'` (if `'Capitals'`) or `'deploy'`; until then, the same caller keeps this turn and may call it again to spread the remaining troops across other territories. The caller must be the player at `turnPlayerIndex`, the game must be `playing` and in `'troop'`, `territoryId` must be owned by the caller, `troops` must be an integer from `1` up to `troopsToDeploy`, and, while `supplyLines` is `'on'`, `territoryId` must be reachable from one of the caller's supply hubs (see the `supplyLines` paragraph above).
- **Content:**
  ```ts
  { territoryId: number; troops: number }
  ```
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `game not started`, `game paused`, `not troop phase`, `not your turn`, `territory not owned`, `invalid troops`, `territory not connected to supply hub`.

### `game:selectCapital`
- **When sent:** in `'Capitals'` games only, the player whose turn it currently is to pick, during `'capital'`, clicks one of their own territories.
- **Purpose:** name `territoryId` as the caller's capital: it permanently gains `isCapital: true`, receives `3` troops on the spot (broadcast as `game:deployed`, see below), and `turnPlayerIndex` advances to the next player's pick, or, if the caller was last, the game proceeds into normal turns (see `turnPhase` above). The caller must be the player at `turnPlayerIndex`, the game must be `playing` and in `'capital'`, and `territoryId` must be owned by the caller.
- **Content:**
  ```ts
  { territoryId: number }
  ```
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `game not started`, `game paused`, `not capital phase`, `not your turn`, `invalid territory`, `territory not owned`.

### `game:nextPhase`
- **When sent:** the player whose turn it currently is finishes a phase (`attack`, `fortify`, `entrench`, or `toxins`) and is ready to move on.
- **Purpose:** advance `turnPhase` to the next phase in order; completing the last phase in the sequence (`'fortify'`, `'entrench'`, or `'toxins'`, whichever is last given the current settings) instead ends the turn (see `turnNumber` above). The caller must be the player at `turnPlayerIndex`, and the game must be `playing`. Cannot be used to leave `'territory'`, `'troop'`, or `'capital'` at all: those phases only end via `game:claimTerritory`, `game:placeTroop`, and `game:selectCapital` respectively. Cannot be used to leave `'deploy'` while `troopsToDeploy` is above `0`, or while the caller holds `5` or more cards (see "Territory cards" above). Cannot be used to leave `'attack'` while a conquest is pending (`attackConquestMinTroops` non-`null`): that must be resolved via `game:attackMove` first.
- **Content:** none
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `game not started`, `game paused`, `not your turn`, `cannot skip territory phase`, `cannot skip troop phase`, `cannot skip capital phase`, `cannot skip deploy phase`, `must play a card set`, `pending conquest move`.

### `game:selectTerritory`
- **When sent:** the player whose turn it currently is clicks one of their selectable territories on the map, or deselects the current one.
- **Purpose:** set (or clear, with `territoryId: null`) `selectedTerritoryId` so every client (not just the caller) sees the same territory highlighted. The caller must be the player at `turnPlayerIndex`, and the game must be `playing`. A non-`null` `territoryId` must belong to some player; during `'deploy'`, `'troop'`, `'entrench'`, or `'toxins'` it must additionally be owned by the caller (other phases don't yet restrict this, see `turnPhase` above); during `'deploy'` or `'troop'` specifically, while `supplyLines` is `'on'`, it must also be reachable from one of the caller's supply hubs (see the `supplyLines` paragraph above), the same restriction `game:deploy`/`game:placeTroop` themselves enforce, checked here too so an unreachable territory can't even be selected in the first place.
- **Content:**
  ```ts
  { territoryId: number | null }
  ```
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `game not started`, `game paused`, `not your turn`, `invalid territory`, `territory not owned`, `territory not connected to supply hub`.

### `game:deploy`
- **When sent:** the player whose turn it currently is, during `'deploy'`, places some of their troop pool (see `turnPhase` above) on one of their own territories.
- **Purpose:** add `troops` to `territoryId`'s troop count and deduct them from the caller's remaining pool for the turn, clearing `selectedTerritoryId` in the process. Once the pool reaches `0`, the server auto-advances `turnPhase` to `'attack'` (same as a `game:nextPhase` call would) unless the caller can currently play a card set, in which case `turnPhase` stays `'deploy'` (see "Territory cards" above). The caller must be the player at `turnPlayerIndex`, the game must be `playing` and in `'deploy'`, `territoryId` must be owned by the caller, `troops` must be an integer from `1` up to the caller's remaining pool, and, while `supplyLines` is `'on'`, `territoryId` must be reachable from one of the caller's supply hubs (see the `supplyLines` paragraph above).
- **Content:**
  ```ts
  { territoryId: number; troops: number }
  ```
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `game not started`, `game paused`, `not your turn`, `not deploy phase`, `territory not owned`, `invalid troops`, `territory not connected to supply hub`.

### `game:requestCards`
- **When sent:** a seated player's client, whenever it (re)mounts the UI that displays the caller's hand. This exists because the reconnect push described under `game:cards` below fires on `player:identify`, before that UI may have mounted (e.g. right after a page refresh, while waiting on the first `game:state`), so a client can't rely on the push alone to always catch it.
- **Purpose:** have the server resend the caller's current hand via `game:cards` (see below). No-op if the caller isn't a seated player in a `playing` game.
- **Content:** none.
- **Ack:** none.

### `game:requestState`
- **When sent:** the game view's client, every time it mounts. `game:create` and `game:join`'s own broadcast (see `game:state` below) deliberately excludes the acting player — they get their copy folded into that call's own ack instead — but the Game view doesn't read `game` off that ack: it only mounts (and starts listening for `game:state`) after the ack already came back and triggered navigation, by which point that one excluded broadcast is long gone. This request exists to close that gap, the same way `game:requestCards` closes it for hands.
- **Purpose:** have the server resend the caller's current `GameState` via `game:state` (see below). No-op if the caller isn't in a game.
- **Content:** none.
- **Ack:** none.

### `game:requestResults`
- **When sent:** the game view's client, every time it mounts, for the same reason as `game:requestState` above — a fresh spectator joining an already-`ended` game, or the Home page's own create/join flow, can easily mount after the one-time `game:results` push (see below) already fired.
- **Purpose:** have the server resend the caller's results via `game:results` (see below). No-op if the caller isn't in a game that's `ended`.
- **Content:** none.
- **Ack:** none.

### `game:playCardSet`
- **When sent:** the player whose turn it currently is, during `'deploy'`, plays 3 cards from their own hand as a set.
- **Purpose:** validate and resolve a set (see "Territory cards" above): remove the 3 cards from the caller's hand and return them to the deck, add the set's base value (per `nextSetBaseValues`) to `troopsToDeploy`, and add 2 troops directly to any of the 3 cards' territories the caller currently owns (each such territory also gets a `game:deployed` broadcast, see below). The caller must be the player at `turnPlayerIndex`, and the game must be `playing` and in `'deploy'`. `cards` must reference exactly 3 cards actually in the caller's hand: a `territoryId` for a specific non-wild card, or `null` for "any wild card" (so two `null`s require two wild cards in hand), forming a valid set (3-of-a-kind or one of each symbol, wilds filling in); the server, never the client, decides the resulting value and territory bonuses. A successful call also broadcasts `game:cardSetPlayed` (see below) to everyone in the room, ahead of any `game:deployed` broadcasts for the territory bonuses.
- **Content:**
  ```ts
  { cards: (number | null)[] } // exactly 3 entries
  ```
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `game not started`, `game paused`, `not your turn`, `not deploy phase`, `invalid cards`, `invalid set`.

### `game:fortifySelectStart`
- **When sent:** the player whose turn it currently is, during `'fortify'`, clicks one of their candidate start territories on the map, or cancels the in-progress fortify selection (clicking/right-clicking outside it, or pressing Escape).
- **Purpose:** set (or clear, with `territoryId: null`) `fortifyStartTerritoryId`, clearing `fortifyEndTerritoryId` in the same call. A candidate start territory must be owned by the caller and have at least 2 troops; under `fortification: 'Connected'` or `'Neighboring'` it must additionally have at least one neighboring territory also owned by the caller, while `'Unrestricted'` only requires the caller to own some other territory. The client computes candidacy itself (for highlighting/hover), but the server independently re-checks it here. The caller must be the player at `turnPlayerIndex`, and the game must be `playing` and in `'fortify'`.
- **Content:**
  ```ts
  { territoryId: number | null }
  ```
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `game not started`, `game paused`, `not your turn`, `not fortify phase`, `invalid territory`, `territory not owned`, `invalid start territory`.

### `game:fortifySelectEnd`
- **When sent:** the player whose turn it currently is, during `'fortify'` with `fortifyStartTerritoryId` already set, clicks one of the candidate end territories on the map.
- **Purpose:** set `fortifyEndTerritoryId`. A candidate end territory must be owned by the caller and different from `fortifyStartTerritoryId`; which ones qualify depends on `fortification` (see `GameState.fortification` above): reachable through a path of territories all owned by the caller under `'Connected'`, a direct neighbor of the start territory under `'Neighboring'`, or any other territory the caller owns under `'Unrestricted'`. As with the start territory, the client computes this for highlighting and the server re-checks it. The caller must be the player at `turnPlayerIndex`, and the game must be `playing` and in `'fortify'`.
- **Content:**
  ```ts
  { territoryId: number }
  ```
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `game not started`, `game paused`, `not your turn`, `not fortify phase`, `no start territory selected`, `invalid territory`, `territory not owned`, `invalid end territory`.

### `game:fortify`
- **When sent:** the player whose turn it currently is, during `'fortify'` with both `fortifyStartTerritoryId` and `fortifyEndTerritoryId` set, confirms the troop movement from the fortify panel (its confirm button, or Enter).
- **Purpose:** move `troops` from `fortifyStartTerritoryId` to `fortifyEndTerritoryId`, then immediately advance the turn phase (same as completing `'fortify'` via `game:nextPhase`, see `turnNumber` above) — landing on `'entrench'` or `'toxins'` if either is enabled and the player has a legal move in it, otherwise ending the turn right away — since only one movement is allowed per fortify phase. The caller must be the player at `turnPlayerIndex`, the game must be `playing` and in `'fortify'` with both fortify territories selected, and `troops` must be an integer from `1` up to the start territory's current troop count minus `1` (at least 1 troop always stays behind).
- **Content:**
  ```ts
  { troops: number }
  ```
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `game not started`, `game paused`, `not your turn`, `not fortify phase`, `no fortify selection`, `invalid troops`.

### `game:entrench`
- **When sent:** the player whose turn it currently is, during `'entrench'`, spends troops off one of their own territories to entrench it (or extend an already-entrenched one) from the entrench panel (its confirm button, or Enter).
- **Purpose:** deduct `troops` from `territoryId`'s troop count and add that many to its entrenchment turn count (`entrenchedTurns`, see `GameState.territories` above; starts at `0`, so a fresh entrenchment and topping up an existing one work identically), clearing `selectedTerritoryId` in the process. Unlike `'deploy'`, this doesn't itself end the phase or advance the turn: the player may repeat this on as many of their own territories as they like before ending their turn via `game:nextPhase`, though the turn ends automatically in its place the moment no legal entrench move remains (see `turnPhase` above). The caller must be the player at `turnPlayerIndex`, the game must be `playing` and in `'entrench'`, `territoryId` must be owned by the caller and not a capital, and `troops` must be an integer from `1` up to the territory's current troop count minus `1` (at least 1 troop always stays behind).
- **Content:**
  ```ts
  { territoryId: number; troops: number }
  ```
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `game not started`, `game paused`, `not your turn`, `not entrench phase`, `invalid territory`, `territory not owned`, `capital cannot be entrenched`, `invalid troops`.

### `game:toxins`
- **When sent:** the player whose turn it currently is, during `'toxins'`, spends the troops off one of their own territories to toxin it, from the toxins panel (its confirm button, Enter, Space, or clicking the already-selected territory a second time).
- **Purpose:** remove `territoryId` from `territoryOwners` entirely, wiping every troop it held (regardless of the toxin's cost — any excess is forfeited, not refunded), and add it to `toxinTerritories` with `permanent`/`turnsRemaining` set per the game's `toxins` setting (see the `toxins` paragraph above), clearing `selectedTerritoryId` in the process. Like `'entrench'`, this doesn't itself end the phase or advance the turn: the player may repeat this on as many of their own territories as they like before ending their turn via `game:nextPhase`, though the turn ends automatically in its place the moment no legal toxin move remains. The caller must be the player at `turnPlayerIndex`, the game must be `playing` and in `'toxins'`, `territoryId` must be owned by the caller and not a capital, the caller must own more than this one territory (toxining a player's last territory would eliminate them, which is never allowed), the territory's current troop count must be at least the toxin cost for the game's current `toxins` setting and `cards` mode, and placing it must not split the remaining, non-toxined territories into more than one connected group.
- **Content:**
  ```ts
  { territoryId: number }
  ```
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `game not started`, `game paused`, `not your turn`, `not toxins phase`, `invalid territory`, `territory not owned`, `capital cannot be toxined`, `cannot toxin your last territory`, `not enough troops`, `would split the map`.

### `game:attackSelectStart`
- **When sent:** the player whose turn it currently is, during `'attack'`, clicks one of their candidate attacking territories on the map, or cancels the in-progress attack selection (clicking/right-clicking outside it, or pressing Escape), only while no conquest is pending (see `attackConquestMinTroops` above).
- **Purpose:** set (or clear, with `territoryId: null`) `attackStartTerritoryId`, clearing `attackEndTerritoryId` and `attackConquestMinTroops` in the same call. A candidate attacking territory must be owned by the caller, have more than 1 troop, and have at least one neighboring territory owned by a different player or unowned and not currently toxined (a free-conquest target, see the `toxins` paragraph above); the client computes candidacy itself (for highlighting/hover), but the server independently re-checks it here. The caller must be the player at `turnPlayerIndex`, the game must be `playing` and in `'attack'`, and no conquest may currently be pending.
- **Content:**
  ```ts
  { territoryId: number | null }
  ```
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `game not started`, `game paused`, `not your turn`, `not attack phase`, `pending conquest move`, `invalid territory`, `territory not owned`, `invalid start territory`.

### `game:attackSelectEnd`
- **When sent:** the player whose turn it currently is, during `'attack'` with `attackStartTerritoryId` already set, clicks one of the candidate defending territories on the map.
- **Purpose:** set `attackEndTerritoryId`, and compute the blitz win probability of every troop count the attack panel can offer, all in one response so the client never has to ask again while the panel is open. Regular attacks (1–3 troops) have no probability computed or sent: a regular attack is a single dice exchange with no meaningful "chance of winning the territory" the way a blitz has, so the panel shows no percentage for those options. A candidate defending territory must be a neighbor of `attackStartTerritoryId` and either be owned by a different player than the caller, or be unowned and not currently toxined (a free-conquest target, see the `toxins` paragraph above); the client computes this for highlighting, the server re-checks it here. The caller must be the player at `turnPlayerIndex`, and the game must be `playing` and in `'attack'` with a start territory already selected.
- **Content:**
  ```ts
  { territoryId: number }
  ```
- **Ack:** unlike other calls, this one is not the shared Ack response: it carries the computed probabilities alongside it:
  ```ts
  | {
      ok: true;
      game: GameState;
      blitzWinProbabilities: number[]; // index i = probability of winning with i+1 troops via blitz (trueWinProb or balancedWinProb, chosen by the game's blitz setting), length attacking territory's troops − 1
    }
  | { ok: false; error: string }
  ```
  Errors: `not in a game`, `game not found`, `game not started`, `game paused`, `not your turn`, `not attack phase`, `no start territory selected`, `invalid territory`, `invalid end territory`.

### `game:attack`
- **When sent:** the player whose turn it currently is, during `'attack'` with both attack territories selected, confirms an attack option from the attack panel (its confirm button, or Enter).
- **Purpose:** resolve one battle between `attackStartTerritoryId` and `attackEndTerritoryId`. If the defending territory is unowned (a free-conquest target — see the `toxins` paragraph above), no dice are rolled at all regardless of `type`: the attack always succeeds with `attackLosses: 0` and `defenceLosses: 0` (there are never any troops to lose either side, since a free-conquest territory always holds `0`), and `attackerDice`/`defenderDice` both come back empty, same as they would for `type: 'blitz'`; the caller still picks `type`/`troops` as normal and still moves troops in afterward exactly as any other conquest. Otherwise, the defending territory rolls `min(its troops, defenceDice)` dice per exchange: except a capital (`isCapital: true`, see `turnPhase` above) or an entrenched territory (`entrenchedTurns > 0`, see `turnPhase` above), either of which always uses `3` in place of `defenceDice`, win or lose, regardless of the game's `defenceDice` setting. For `type: 'regular'`, `troops` (1–3, capped at the attacking territory's troops − 1) fight exactly one exchange via `attack()` in `dice.ts`, and the raw dice results are returned (see Ack below) so the client can animate the roll. For `type: 'blitz'`, `troops` (1 up to the attacking territory's troops − 1) fight to elimination of one side via `trueBlitz()` or `balancedBlitz()` (chosen by the game's `blitz` setting). Losses on both sides are applied immediately. If the defending territory's troops reach `0`, it's conquered: ownership transfers to the caller right away, the end-of-game check described under `GameState.territories` above runs immediately (possibly moving `state` to `'ended'`, in which case every surviving attacking troop is moved into the newly conquered territory automatically, broadcast via `game:attackMoved` since there's no further turn left for the player to choose a smaller amount, and nothing further below in this paragraph happens), and otherwise `attackConquestMinTroops` is set to `min(troops used, 3, remaining attacking-territory troops − 1)` with both attack territory ids left set awaiting `game:attackMove`, unless the conquest eliminated the defender (see "Territory cards" above for the card transfer and its side effects), in which case a `5+`-card attacker instead has that pending move resolved immediately and lands back in `'deploy'`. Otherwise, if the attacking territory still has more than 1 troop left, both attack territory ids are left set (so the attack panel stays open against the same defending territory) and blitz win probabilities are recomputed for the reduced troop counts; if it's down to 1 troop (can't attack again), both reset to `null` instead. The caller must be the player at `turnPlayerIndex`, the game must be `playing` and in `'attack'` with both territories selected, and no conquest may already be pending.
- **Content:**
  ```ts
  { type: 'regular'; troops: 1 | 2 | 3 } | { type: 'blitz'; troops: number }
  ```
- **Ack:** like `game:attackSelectEnd`, not the shared Ack response: it carries fresh blitz win probabilities (empty when the battle was conquered, or when the attacking territory can no longer attack) plus the dice actually rolled (both empty for `type: 'blitz'`, since blitz doesn't animate a roll):
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
  Errors: `not in a game`, `game not found`, `game not started`, `game paused`, `not your turn`, `not attack phase`, `no attack selection`, `territory already conquered`, `invalid attack type`, `invalid troops`.

### `game:attackMove`
- **When sent:** the player whose turn it currently is, during `'attack'` with a conquest pending (`attackConquestMinTroops` non-`null`), confirms how many troops to move into the just-conquered territory from the attack panel.
- **Purpose:** move `troops` from `attackStartTerritoryId` to `attackEndTerritoryId`, then clear both attack territory ids and `attackConquestMinTroops`, ending this attack. The caller must be the player at `turnPlayerIndex`, the game must be `playing` and in `'attack'` with a conquest pending, and `troops` must be an integer from `attackConquestMinTroops` up to the attacking territory's current troops − 1.
- **Content:**
  ```ts
  { troops: number }
  ```
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `game not started`, `game paused`, `not your turn`, `not attack phase`, `no pending conquest`, `invalid troops`.

### `game:surrender`
- **When sent:** a seated player in a `playing` game gives up.
- **Purpose:** permanently give up the caller's ability to act in the game. The caller's socket stays in the game's room, so they can keep watching the game play out. Slot, territories, and troops stay exactly as they were (same as any other player leaving a `playing` game, see "Leaving and reconnecting" above), so the game carries on unaffected, and the caller keeps rejoining as a player exactly as before; the only lasting difference from an ordinary disconnect is that they're now permanently skipped in turn order and every `game:*` action requiring their turn is rejected, so they can never again act on their troops or cards. If it was the caller's turn at the moment they surrender, that turn is force-ended immediately, exactly as `turnDuration` timing out would.
- **Content:** none
- **Ack:** shared Ack response. Errors: `not in a game`, `game not found`, `game not started`, `not a player`, `already eliminated`.

### `game:replay`
- **When sent:** a client wants to show the end-of-game map replay, e.g. when the player clicks "View Map" from the end screen.
- **Purpose:** fetch the full history of territory ownership/troop changes for an `ended` game, as a list of `ReplayFrame`s (see above), so the client can play back the whole game on the map. Recorded live throughout `'playing'` (one frame per deployment, fortify, and attack, in order) and only returned once the game has actually ended.
- **Content:** none
- **Ack:**
  ```ts
  | { ok: true; initial: { id: number; ownerId: number; troops: number }[]; initialRadiation: number[]; frames: ReplayFrame[] }
  | { ok: false; error: string }
  ```
  `initial` is the territory snapshot right after `game:start` dealt them out, before any turn was played, the replay's starting point, index `0`; `initialRadiation` is that same starting point's `radiationTerritoryIds` (see the `radiations` paragraph above), needed since, unlike `toxinTerritories`, radiation doesn't start empty; `frames[i]` is the state after the `(i + 1)`th change. Errors: `not in a game`, `game not found`, `game not ended`.

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

### `game:sendEmoji`
- **When sent:** a seated player sends a quick emoji to another player, or to every player in the game: right after clicking a player (or the "Everyone" row) in the players list (during a game) or the roster/results table (in the lobby or after the game ends) and picking one of the eight fixed emojis (👍, 👎, ❤️, 🙂, 🙁, 😲, 🙏, ⚔️), or, for the attack emoji (⚔️) specifically, after the follow-up click on a player or a territory that names its target. The attack emoji's follow-up targeting only exists in the in-game players list, since it relies on the map; the lobby and results tables only ever send it (if at all) without an `attackTarget`. The attack emoji can't be sent to everyone — it always requires a specific `targetPlayerId`.
- **Purpose:** relay one emoji from the caller to `targetPlayerId`, or, if `targetPlayerId` is omitted, to every seated player in the game (an emoji sent to everyone). A targeted emoji is delivered only to the two sockets involved; one sent to everyone is delivered individually to every seated player's own socket (see `game:emojiSent` below) — neither is ever broadcast to spectators. The caller must be a seated player, in any game state (`lobby`, `playing`, or `ended`); if given, `targetPlayerId` must be a currently seated player other than the caller (a player can't send themselves an emoji). `attackTarget` is required if and only if `emoji` is `'⚔️'`, which also requires `targetPlayerId` to be given: `{ type: 'player'; playerId }` names any seated player, including the caller or `targetPlayerId`, as the attack's target — unlike `targetPlayerId`, this one may name the caller — `{ type: 'territory'; territoryId }` names any territory on the map, owned by anyone or no one. Silently ignored (no ack) on any invalid input, same as `game:chat`.
- **Content:**
  ```ts
  {
    targetPlayerId?: number;
    emoji: '👍' | '👎' | '❤️' | '🙂' | '🙁' | '😲' | '🙏' | '⚔️';
    attackTarget?:
      | { type: 'player'; playerId: number }
      | { type: 'territory'; territoryId: number };
  }
  ```
- **Ack:** none

---

## Server → Client

### `home:games`
- **When sent:** event-driven, not polled: to every socket currently in the `home` room, whenever a change could affect the list — a game created, destroyed, or ended, or a `game:join`/`game:settings`/leave/reconnect changing a public game's roster, name, map, slots, host, or password.
- **Purpose:** keep the lobby's list of joinable games current.
- **Content:**
  ```ts
  GameSummary[]
  ```

### `game:state`
- **When sent:** event-driven, not polled: individually to every socket currently in a given game's room (every seated player and every spectator each get their own emission, rather than one shared room broadcast), immediately after any server-side mutation of that game — every successful `game:*` action, the turn timer force-completing a phase or turn, a join/leave/kick/reconnect/disconnect affecting the room, and the game ending. The acting player (where there is one) always gets their own copy folded into that action's own ack instead of a second, separate emission — including for `game:create`/`game:join`, even though the client doesn't happen to read `game` off either of those two acks (see `game:requestState` above for why that matters). Also individually resent to a single socket on `game:requestState` (see above).
- **Purpose:** keep everyone in a game synced on its settings, roster, ban list, and (once `playing`) turn progress (including for the host's own settings UI, and so clients can offer an "unban" action from `bannedPlayers`). While `fogOfWar` is `'on'` and in effect for a given recipient, the `GameState` they receive is filtered down to what they can currently see (see `GameState` and the `fogOfWar` paragraph above); every other recipient in the same room may receive a differently-filtered payload for the same emission.
- **Content:**
  ```ts
  GameState
  ```

### `game:cards`
- **When sent:** individually to each seated player's own socket (never broadcast to the room), only when that player's own hand actually changes: right after `game:start` deals empty hands (so the hand, empty or not, is always current from the start, see "Territory cards" above), whenever `game:playCardSet` or the turn timer's auto-play removes cards from the hand, whenever the end-of-turn conquest draw or an eliminated opponent's hand transfer adds cards to it, once on reconnect (a fresh `player:identify` while seated in a `playing` game) so a client that just (re)connected is caught up without waiting on the next change, and whenever the caller sends `game:requestCards` (see above).
- **Purpose:** let a player see their own territory cards: the only place this ever reaches a client; `GameState` never includes any player's actual cards, only `cardCount`.
- **Content:**
  ```ts
  { cards: { territoryId: number | null; symbol: 'soldier' | 'humvee' | 'tank' | null }[] }
  ```

### `game:mission`
- **When sent:** individually to each player with an assigned mission (never broadcast to the room), i.e. every seated player, once right after `game:start` assigns missions, and once more on reconnect (a fresh `player:identify` while seated in a game that's `playing` or `ended`) so a client that just (re)connected is caught up. Never resent afterward: a mission is fixed for the whole game once assigned (see below), so there's nothing further to push.
- **Purpose:** let a player see their own secret mission: the only place this ever reaches a client; `GameState` never exposes anyone's mission, including the caller's own to anyone else. See "Missions" above.
- **Content:**
  ```ts
  {
    mission:
      | { type: 'territories'; fraction: number; minTroopsPerTerritory: number }
      | { type: 'continents'; continentIds: number[] }
      | { type: 'assassinate'; targetId: number };
  }
  ```

### `game:logs`
- **When sent:** individually to each seated player's or spectator's own socket (never broadcast to the room), once on reconnect (a fresh `player:identify` while seated in a game that's `playing` or `ended`) so a client that just (re)connected can rebuild its activity log without having lived through the events that produced it — same motivation as `game:cards`/`game:mission` above, but for the log rather than hand/mission state. Never sent otherwise: a client already connected simply keeps accumulating its log from the individual events below as they happen.
- **Purpose:** replay every event this recipient would have received so far that useGameLogs.ts's log turns into human-readable lines — `game:deployed`, `game:deployedMany`, `game:fortified`, `game:attackMoved`, `game:entrenched`, `game:toxined`, `game:radiationChanged`, `game:attacked`, `game:cardSetPlayed`, `game:turnStarted`, `game:capitalPlacementStarted`, and `game:territoryClaimed` — in the exact order and with the exact payload this recipient was originally sent (or would have been sent, for the events among those that are `fogOfWar`-filtered): the server records a copy of each such event into that recipient's own history as it sends it, so replaying it later reproduces exactly what they'd have seen live, fog of war included. `entries` is empty for anyone who (re)connects before the game has produced any loggable event yet.
- **Content:**
  ```ts
  { entries: { type: string; payload: unknown }[] }
  ```
  Each `type` is one of the twelve event names above, and its `payload` is that event's own documented content.

### `game:results`
- **When sent:** to every socket in a game's room, once, the instant the game's `state` becomes `'ended'` (see `checkGameEnd` under `turnPhase` above — covers every way a game can end, not just one). Individually resent to a single socket, the same way `game:cards`/`game:mission`/`game:logs` are, on reconnect (a fresh `player:identify` while seated or spectating in a game that's `ended`), and on `game:requestResults` (see above) — which is what actually covers a fresh `game:join` to a game that's already `ended`, since that join's own ack isn't read for this either.
- **Purpose:** deliver each player's final cumulative stats for the results table (see `players[]` above for why these live here and not in `GameState`).
- **Content:**
  ```ts
  {
    stats: {
      id: number;
      troopsGained: number;
      troopsKilled: number;
      troopsLost: number;
      territoriesConquered: number;
      territoriesLost: number;
      capitalsConquered: number;
      capitalsLost: number;
      cardsGained: number;
      turnsPlayed: number;
      setsPlayed: number;
    }[]
  }
  ```
  One entry per `id` in `GameState.players[]`.

### `game:cardSetPlayed`
- **When sent:** immediately, to every socket in a game's room, whenever a `game:playCardSet` call succeeds (including back to the playing player).
- **Purpose:** let every client show which 3 cards were just played and by whom: `GameState` never exposes anyone's hand, so this is the only way other clients learn a set's actual cards. `troops` is the set's total value (`nextSetBaseValues` entry played, plus `2` per territory bonus, i.e. everything the play added to the caller's `troopsToDeploy` pool and territories combined). `territoryBonusCount` is how many of `cards`' territories the caller owned at the moment of play (each worth that `2`-troop bonus baked into `troops`); the server sends it rather than leaving a client to recompute it from current territory ownership, which would only be reliable live, not for one replaying `game:logs` after reconnecting much later.
- **Content:**
  ```ts
  { playerId: number; troops: number; cards: { territoryId: number | null; symbol: 'soldier' | 'humvee' | 'tank' | null }[]; territoryBonusCount: number }
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

### `game:emojiSent`
- **When sent:** immediately, individually to the sender's own socket and `targetPlayerId`'s socket (a single event if they're the same player), whenever a targeted `game:sendEmoji` call succeeds; individually to every seated player's own socket (sender included) whenever a `game:sendEmoji` call sent to everyone succeeds.
- **Purpose:** let every recipient play the emoji sound effect and show the emoji as a "pop" in the players list (during a game) or the roster/results table (in the lobby or after the game ends), with a brief highlight animation; `GameState`/`game:state` never carries emojis, so this is the only way a client learns of one. For a targeted emoji (`targetPlayerId` present), the pop shows next to the other party's row — next to `targetPlayerId`'s row on the sender's own client, and next to `senderId`'s row on the recipient's client. For one sent to everyone (`targetPlayerId` omitted), every client, including the sender's, shows the pop next to `senderId`'s row, marked as sent to everyone. For an attack emoji (`emoji: '⚔️'`, always targeted) with a territory `attackTarget`, this is also what triggers the animation flying the emoji from that row to the target territory on the map (only possible during a game, since the lobby and results tables have no map).
- **Content:**
  ```ts
  {
    senderId: number;
    targetPlayerId?: number;
    emoji: '👍' | '👎' | '❤️' | '🙂' | '🙁' | '😲' | '🙏' | '⚔️';
    attackTarget?:
      | { type: 'player'; playerId: number }
      | { type: 'territory'; territoryId: number };
  }
  ```

### `game:capitalPlacementStarted`
- **When sent:** immediately, to every socket in a game's room, once, when a `'Capitals'` game's `'capital'` phase begins (see `turnPhase` above).
- **Purpose:** let every client announce that capital placement has started; `GameState` itself carries no record of this transition happening, only the resulting `turnPhase`.
- **Content:** none

### `game:territoryClaimed`
- **When sent:** immediately, to every socket in a game's room, whenever a `game:claimTerritory` call succeeds (including back to the claiming player) or the turn timer auto-claims one on a player's behalf (see `turnPhase` above).
- **Purpose:** let every client show the newly-claimed territory in `playerId`'s color right away, since `GameState`'s `territories` array alone doesn't say which entry just changed or who claimed it. Also covers the `1`-troop seed the claim always carries (see `game:claimTerritory` above): clients play the usual deploy sound/animation for it here, keyed off this event's own `playerId` rather than `game:deployed`, since at the instant this fires the territory's ownership hasn't reached the rest of the room yet.
- **Content:**
  ```ts
  { territoryId: number; playerId: number }
  ```

### `game:turnStarted`
- **When sent:** immediately, to every socket in a game's room, whenever a player's deploy pool is granted: the start of a normal turn (`advanceToNextPlayer`, including via the turn timer) or, in `'Capitals'`, the first turn right after the last player picks a capital (see `turnPhase` above).
- **Purpose:** announce the new turn and its troop grant, and the breakdown behind it, none of which `GameState` records anywhere. A dedicated event also guarantees this arrives before whatever `game:state` push reflects the new turn, so a client logging this player's later, real-time actions (`game:deployed`, etc.) never has to reorder them after the fact.
- **Content:**
  ```ts
  {
    playerId: number;
    turnNumber: number;
    troopsFromTerritories: number;
    troopsFromBonuses: number;
    troopsFromCapitals: number; // always 0 outside 'Capitals'
    troopsFromTurnTroops: number; // always 0 while turnTroops is 'off'
    troopsFromBounties: number; // always 0 while bounties is 'off'
  }
  ```
  `troopsFromTerritories + troopsFromBonuses + troopsFromCapitals + troopsFromTurnTroops + troopsFromBounties` is the pool granted, matching `GameState.troopsToDeploy`'s value at that instant (see `turnPhase` above, and `turnTroops`/`bounties` above, for how each is computed).

### `game:deployed`
- **When sent:** immediately, individually to every socket in a game's room whenever a `game:deploy` or `game:placeTroop` call succeeds (including back to the acting player), once per territory for a `game:playCardSet` call's automatic 2-troop territory bonuses (see "Territory cards" above), and once for a capital's `3` troops, whether picked via `game:selectCapital` or assigned at random by the turn timer (see `turnPhase` above). Not sent for `game:claimTerritory`: its `1`-troop seed is folded into `game:territoryClaimed` instead (see below), since the claim already carries the acting player's id. While `fogOfWar` is in effect for a given recipient (see the `fogOfWar` paragraph above), this event is withheld entirely from them unless `territoryId` is currently visible to them.
- **Purpose:** let every client play the deploy sound effect in sync, since `GameState` is a snapshot, not a record of individual actions, so a client has nothing to infer this from even once its next push arrives. `playerId` is the acting player, included so a reconnecting client can attribute this entry correctly when replaying `game:logs` (see below) without depending on `territoryId`'s current owner, who may no longer be `playerId` by the time of a later reconnect.
- **Content:**
  ```ts
  { territoryId: number; troops: number; playerId: number }
  ```

### `game:deployedMany`
- **When sent:** immediately, individually to every socket in a game's room whenever the turn timer force-completes an unattended `'deploy'` phase and it touched at least one territory (see `turnDuration` above): covering both the leftover troop pool and any troops granted by auto-played card sets, as one batch. Also sent, the same way, whenever the turn timer force-completes an unattended `'troop'` turn and the player still had troops left in that turn's `troopsToDeploy` allotment (see `turnPhase` above). While `fogOfWar` is in effect for a given recipient, `deposits` is filtered down to only the entries currently visible to them, and the whole event is withheld if that leaves it empty.
- **Purpose:** let every client play the deploy sound effect exactly once for the whole batch, while still animating every territory that received troops, instead of either replaying the sound per territory or depending on `GameState`, which carries no record of this batch happening at all. `playerId` is the player whose auto-deploy this batch belongs to (every entry in one batch always belongs to the same player), included for the same `game:logs` replay-attribution reason as `game:deployed` above.
- **Content:**
  ```ts
  { deposits: { territoryId: number; troops: number }[]; playerId: number }
  ```

### `game:fortified`
- **When sent:** immediately, individually to every socket in a game's room whenever a `game:fortify` call succeeds (including back to the moving player), or the turn timer force-completes a pending `'fortify'` move. While `fogOfWar` is in effect for a given recipient, this event is withheld entirely from them unless at least one of `territoryId`/`fromTerritoryId` is currently visible to them; unlike the pair fields on `GameState`, this event's troop-count fields *are* redacted field-by-field even though ownership never changes here — a troop move still reveals a troop-count delta, which fog must hide for whichever endpoint isn't visible (see `troopsRemoved`/`troopsAdded` below).
- **Purpose:** let every client play the fortify sound effect and the deploy animation on the destination territory in sync, since `GameState` is a snapshot, not a record of individual actions, so a client has nothing to infer this from even once its next push arrives. `playerId` is the acting player, included for the same `game:logs` replay-attribution reason as `game:deployed` above. `path` is the same server-computed, per-recipient-redacted run list described under `GameState.fortifyPathTerritoryIds` above, computed for this specific move (`fromTerritoryId` to `territoryId`) so the client can draw the multi-hop arrow correctly instead of reconstructing it locally from a possibly fog-incomplete `territories` list. `troopsRemoved` (the amount taken off `fromTerritoryId`) is included only if `fromTerritoryId` is visible to the recipient; `troopsAdded` (the same amount, added to `territoryId`) is included only if `territoryId` is visible to them — both are the same number when both are present, but a recipient who can see only one end never learns the troop-count change at the end they can't see, only that a chain touches it (via `fromTerritoryId`/`territoryId`, which are always sent — territory ids/positions are public regardless of fog).
- **Content:**
  ```ts
  { territoryId: number; fromTerritoryId: number; troopsRemoved?: number; troopsAdded?: number; playerId: number; path: number[][] }
  ```

### `game:entrenched`
- **When sent:** immediately, individually to every socket in a game's room whenever a `game:entrench` call succeeds (including back to the entrenching player). While `fogOfWar` is in effect for a given recipient, this event is withheld entirely from them unless `territoryId` is currently visible to them.
- **Purpose:** let every client play a cost animation on the entrenched territory in sync, since `GameState` is a snapshot, not a record of individual actions, so a client has nothing to infer this from even once its next push arrives. `turnsRemaining` is the territory's resulting `entrenchedTurns` (see `GameState.territories` above) after adding `troops`, so a client doesn't need to separately track what it was before this call. `playerId` is the acting player, included for the same `game:logs` replay-attribution reason as `game:deployed` above.
- **Content:**
  ```ts
  { territoryId: number; troops: number; turnsRemaining: number; playerId: number }
  ```

### `game:toxined`
- **When sent:** immediately, individually to every socket in a game's room whenever a `game:toxins` call succeeds (including back to the toxining player). While `fogOfWar` is in effect for a given recipient, this event is withheld from them unless `territoryId` is currently visible to them or they are the toxining player themselves (toxining a territory releases its ownership, which can immediately drop it out of the acting player's own visible set too if it wasn't otherwise adjacent to one of their remaining territories; the acting player is always told the outcome of their own action regardless).
- **Purpose:** let every client play a placement effect on the newly-toxined territory in sync, since `GameState` is a snapshot, not a record of individual actions, so a client has nothing to infer this from even once its next push arrives. `playerId` is the caller, included since `territoryId` no longer has an owner to attribute the action to once it's toxined.
- **Content:**
  ```ts
  { territoryId: number; permanent: boolean; turnsRemaining: number; playerId: number }
  ```

### `game:toxinExpired`
- **When sent:** immediately, individually to every socket in a game's room, whenever at least one temporary toxin's `turnsRemaining` reaches `0` as a player's turn ends.
- **Purpose:** let every client clear the toxin cloud/countdown for each affected territory in sync, since `GameState` is a snapshot, not a record of individual actions, so a client has nothing to infer this from even once its next push arrives. Batches every territory whose toxin expired in that same turn transition into one event, the same way `game:deployedMany`/`game:starved` batch their own multi-territory changes. While `fogOfWar` is in effect for a given recipient, `territoryIds` is filtered down to only the ones currently visible to them, and the whole event is withheld if that leaves it empty.
- **Content:**
  ```ts
  { territoryIds: number[] }
  ```

### `game:radiationUpcoming`
- **When sent:** immediately, individually to every socket in a game's room, whenever `radiations` is `'dynamic'` or `'expanding'` and `turnNumber` becomes odd, publishing that round's preview (see the `radiations` paragraph above).
- **Purpose:** let every client show the lighter, "about to be irradiated" version of the radiation animation one full round ahead of it actually happening, since `GameState` is a snapshot, not a record of individual actions, so a client has nothing to infer this from even once its next push arrives. `territoryIds` is the complete resulting `radiationTerritoryIds` the following `game:radiationChanged` will apply (see above for why it's the complete set, not just the changed entries), same as this event's payload lands in `GameState.radiationUpcomingTerritoryIds`. Sent individually per recipient: while `fogOfWar` is in effect for a given recipient, `territoryIds` is filtered down to only the ones currently visible to them (the event is still sent even if that leaves it empty, unlike `game:toxinExpired`/`game:starved`, since an empty array is itself meaningful here — it clears a stale preview).
- **Content:**
  ```ts
  { territoryIds: number[] }
  ```

### `game:radiationChanged`
- **When sent:** immediately, individually to every socket in a game's room, whenever `radiations` is `'dynamic'` or `'expanding'` and `turnNumber` becomes even (2 or higher), applying that cycle's previously-previewed move or growth.
- **Purpose:** let every client update the radiation clouds (and clear any now-stale "upcoming" preview) in sync, since `GameState` is a snapshot, not a record of individual actions, so a client has nothing to infer this from even once its next push arrives. `territoryIds` is the new, complete `radiationTerritoryIds`. `newlyRadiatedIds` is the subset of `territoryIds` that just became irradiated this change (the server computes this directly rather than leaving it to a client-side diff against its previously-known set, since that diff would only be reliable for a client processing events live in order — it'd be wrong for one replaying `game:logs` after reconnecting much later, by which point its "previous" set is really just whatever the game looks like today). `eliminatedPlayerIds` lists any player eliminated by this change (see the `radiations` paragraph above), in no particular order; empty most of the time. Sent individually per recipient: while `fogOfWar` is in effect for a given recipient, `territoryIds` and `newlyRadiatedIds` are filtered down to only the ones currently visible to them (still sent when that leaves it empty, same reasoning as `game:radiationUpcoming` above), but `eliminatedPlayerIds` is never filtered — an elimination is player status, not territory ownership, and (like every other `players[]` status field) is always visible to everyone regardless of fog of war.
- **Content:**
  ```ts
  { territoryIds: number[]; newlyRadiatedIds: number[]; eliminatedPlayerIds: number[] }
  ```

### `game:starved`
- **When sent:** immediately, individually to every socket in a game's room whenever a player's turn ends with `starvation` (see above) removing at least one troop from at least one of their territories. While `fogOfWar` is in effect for a given recipient, `losses` is filtered down to only the entries currently visible to them, and the whole event is withheld if that leaves it empty.
- **Purpose:** let every client play a troop-loss animation (the same floating loss number as `game:attacked`'s explosion, but without the explosion itself) on each affected territory in sync, since `GameState` is a snapshot, not a record of individual actions, so a client has nothing to infer this from even once its next push arrives. `losses` has one entry per territory that lost troops, `troops` being the total lost from that territory this turn (so a client plays the animation once per territory even if `starvation: 'total'` removed several 1-troop increments from it).
- **Content:**
  ```ts
  { losses: { territoryId: number; troops: number }[] }
  ```

### `game:attacked`
- **When sent:** immediately, individually to every socket in a game's room whenever a `game:attack` call resolves a battle (including back to the attacking player).
- **Purpose:** let every client play the explosion sound effect and animation on whichever side(s) lost troops, in sync, since `GameState` is a snapshot, not a record of individual actions, so a client has nothing to infer this from even once its next push arrives. `attackerId` and `defenderId` are the owners of the two territories at the moment of the attack (`defenderId` in particular is captured before a conquering attack transfers ownership); `defenderId` is `undefined` for a free-conquest attack against an unowned territory (see the `toxins` paragraph above), since there's no real defending player. `type` echoes the `game:attack` call's own `type`: the client uses it to delay the explosion until its dice-roll animation (`type: 'regular'` only, and only when there was an actual roll — a free conquest never rolls dice regardless of `type`) finishes, so the explosion lands right as the dice settle instead of overlapping them.

  While `fogOfWar` is in effect for a given recipient, this event's fields split into three groups: `attackingTerritoryId`, `defendingTerritoryId`, `attackerId`, and `type` are always sent (they're either public territory ids/geometry or already-public turn-player identity, and the client needs both ids regardless to draw the connecting arrow, fading it toward whichever end it can't see — see `GameState.visibleTerritoryIds` above); `attackingTroops` and `attackLosses` are included only if `attackingTerritoryId` is currently visible to the recipient; `defenderId`, `defendingTroops`, `defenceLosses`, and `conquered` are included only if `defendingTerritoryId` is currently visible to them, or if the recipient is the defender themselves (a conquering attack transfers ownership before this event is computed, which can otherwise cost the defender visibility of their own just-lost territory — they always learn the outcome of an attack on their own territory regardless). The whole event is withheld if neither territory is visible to them (and the recipient isn't the defender).
- **Content:**
  ```ts
  {
    attackingTerritoryId: number;
    defendingTerritoryId: number;
    attackerId: number;
    defenderId?: number;
    attackingTroops?: number; // troops committed to this exchange (the game:attack call's own `troops`)
    defendingTroops?: number; // defending territory's troop count immediately before this exchange
    attackLosses?: number;
    defenceLosses?: number;
    conquered?: boolean;
    type: 'regular' | 'blitz';
  }
  ```

### `game:tankFired`
- **When sent:** immediately, to every socket in a game's room, whenever a `game:attack` call resolves a battle (alongside `game:attacked` above). Never filtered by `fogOfWar`: it carries no territory or player data.
- **Purpose:** let every client play a tank-recoil animation in the turn panel in sync, regardless of whether they can see the attacked territory. `type` and `hasDefender` (`false` for a free-conquest attack against an unowned territory) let the client delay the recoil the same way `game:attacked`'s `type` delays the map explosion, so the two animations land together for clients that can see both.
- **Content:**
  ```ts
  { type: 'regular' | 'blitz'; hasDefender: boolean }
  ```

### `game:attackMoved`
- **When sent:** immediately, individually to every socket in a game's room whenever a `game:attackMove` call succeeds (including back to the moving player), the turn timer force-completes a pending conquest move, a conquest eliminates the defender and the attacker's hand hits `5+` cards (auto-resolving the move at the minimum troop count, see `turnPhase` and "Territory cards" above), or a conquest ends the game outright (auto-resolving the move with every surviving attacking troop, since no further turn is left to choose a smaller amount). While `fogOfWar` is in effect for a given recipient, this event is withheld entirely from them unless at least one of `territoryId`/`fromTerritoryId` is currently visible to them; like `game:fortified` above, the troop-count fields are still redacted field-by-field even though this event carries no ownership field.
- **Purpose:** let every client play the fortify sound effect and the deploy animation on the newly-conquered territory in sync, since `GameState` is a snapshot, not a record of individual actions, so a client has nothing to infer this from even once its next push arrives. `troopsRemoved`/`troopsAdded` follow exactly the `game:fortified` rule above: the same moved amount, included only for whichever of `fromTerritoryId`/`territoryId` is visible to this recipient.
- **Content:**
  ```ts
  { territoryId: number; fromTerritoryId: number; troopsRemoved?: number; troopsAdded?: number }
  ```

### `game:selected`
- **When sent:** immediately, to every socket in a game's room, whenever a `game:selectTerritory`, `game:fortifySelectStart`, `game:fortifySelectEnd`, `game:attackSelectStart`, or `game:attackSelectEnd` call succeeds with a non-`null` `territoryId` (including back to the selecting player). Not sent for a deselection. Never filtered by `fogOfWar`: it carries only a territory id, no ownership or troop data.
- **Purpose:** let every client play the territory-selection sound effect in sync, since `GameState` is a snapshot, not a record of individual actions, so a client has nothing to infer this from even once its next push arrives.
- **Content:**
  ```ts
  { territoryId: number }
  ```
