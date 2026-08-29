## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.
- No comments in the code. The code should be self-explanatory. If it isn't, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Stack

Code for readability first, then simplicity, and finally performance.
- No comments in the code.
- Single quote string.
- No async/await.
- No CSS or style, unless strictly necessary. Use Bootstrap classes instead.
- No source files with more than 1000 lines. Split into smaller files if necessary.
- No folders with more than 10 source files. Split into subfolders if necessary.
- No sub-agents unless explicitly requested.
- No browser verification/running unless explicitly requested.

**Engine**
- Pure TypeScript
- Contains the game logic, bots ai, and map generation.
- Used by both the server and client. Must be independent of any UI or network code.

**Server**
- Node.js, nodemon, Express, Socket.io, TypeScript, ESLint, Prettier.
- Follow PROTOCOL.md for socket.io events and data types.

**Client**
- Vite, React, React-Bootstrap, TypeScript, ESLint, Prettier.
- Follow PROTOCOL.md for socket.io events and data types.

**Mapper**
- Vite, React, React-Bootstrap, TypeScript, ESLint, Prettier.
- Independent and disconnected from client and server.
