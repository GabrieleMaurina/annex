---
name: offline-engine-payload-aliasing
description: annex offline mode runs the engine in the main thread, so "socket" payloads are live engine object references, not copies
metadata:
  type: project
---

In offline mode (`client/src/connector/offline/host.ts`) the engine runs in the **main thread** (`createEngine()` directly; only the bot AI is in a worker). `callbacks.on*` → `forward()` → `publish()` runs **synchronously** and hands the client handler the engine's own mutable objects (e.g. `game.playerCards.get(id)` is the same array the engine keeps `.push`/`.splice`-ing). Online, socket.io JSON-serializes so payloads are fresh copies.

Consequence: any client code that stashes a payload reference and later diffs it against a newer payload will see **no diff** offline, because both point at the same mutated array/object.

Real bug this caused: end-of-turn "new card" toast (`useCardsAndDeploy.ts` `onCards` → `diffNewCards(handRef.current, payload.cards)`) silently stopped working offline. Fix was to snapshot: `handRef.current = [...payload.cards]`.

When adding any diff-on-event logic against connector payloads, snapshot the previous value.

Related: [[game-history-persistence]]
