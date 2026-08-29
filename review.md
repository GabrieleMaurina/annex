# Master Agent: Codebase-Wide Review & Cleanup Orchestrator

You are the master agent coordinating a thorough review of this codebase. The goal is small, high-value improvements: remove duplicate code, simplify what can be simplified, and refactor only where it genuinely improves readability or maintainability. The code is already believed to be in good shape, so expect modest findings, not a rewrite. Do not invent work.

You will NOT review code yourself. You partition the codebase and delegate to sub-agents, then consolidate their reports.

## Ground rules (apply to you and every sub-agent)

From the project's CLAUDE.md, these override default behavior:
- Readability first, then simplicity, then performance.
- No comments in code. Single-quote strings. Semicolons. No `async`/`await`.
- No CSS/inline styles, use Bootstrap classes. Only if strictly necessary.
- No source file over 1000 lines; no folder over 10 source files.
- Surgical changes only. Every changed line must trace to the review goal. Don't "improve" adjacent code, don't refactor what isn't broken, match existing style.
- When a change orphans an import/var/function, remove it. Don't delete pre-existing dead code, report it instead.
- `engine` must stay independent of any UI or network code.
- `server` and `client` follow PROTOCOL.md for socket.io events and data types.
- Do NOT run the app or do browser verification.
- Do NOT commit or push. Leave changes in the working tree.
- **Shared working tree, concurrent editors.** Every sub-agent edits the SAME working tree at the SAME time as other sub-agents working on other units. Do NOT run any git command that changes repo or index state: no `git stash` (it will sweep up and hide other agents' in-progress edits), no `git checkout`/`git restore`/`git reset`/`git clean`/`git rebase`/`git apply`, no `git add`/`git commit`. Only read-only git is allowed (`git status`, `git diff`, `git log`, `git ls-files`). Make all edits with the file-editing tools directly. To type-check, run `tsc`/`eslint` against the tree as-is; if you see errors only in files OUTSIDE your unit, ignore them and note it in your report (another agent's edit is mid-flight) — do not try to "clean" or reset the tree to get a green baseline.

## Phase 1: Discovery (terminal commands only, do NOT read files)

Run terminal commands to establish:
1. Total number of source files (`.ts`, `.tsx`), excluding `node_modules`, `dist`, `build`, `.git`.
2. The full folder structure (a tree of directories, and files per directory).
3. Line count for every source file.

Suggested commands (adapt to the shell, this is Windows PowerShell plus a Bash tool):
- File list plus LOC: `git ls-files "*.ts" "*.tsx" | xargs wc -l` (via the Bash tool)
- Folder structure: derive from the file list, or `find . -type d -not -path "*/node_modules/*"`

Produce a table: file path, LOC, and which top-level module it belongs to (`engine` / `server` / `client` / `mapper` / root).

## Phase 2: Partition into review units

Split the codebase into logical review units based ONLY on folder structure and file names (you may not read file contents). Rules:
- Every source file belongs to exactly one unit (disjoint cover, no file reviewed twice, no file skipped).
- A unit holds up to 30 source files, regardless of line count. A unit can be smaller than 30 files when that makes it a more coherent slice. Prefer clean feature/folder boundaries over packing units to the limit.
- Keep each unit a coherent slice (one feature area or folder subtree), not an arbitrary cut.
- `engine` and `client` are large and MUST be split further. `server` and `mapper` are smaller, split only if a unit would otherwise exceed 30 files.
- Shared files (e.g. `types.ts`, `index.ts`, top-level `*.css`) go to the most related unit; list them explicitly so no sub-agent assumes someone else owns them.
- Cross-cutting duplication (e.g. an engine helper mirrored in client) won't be visible to a single unit's sub-agent. Note any suspected cross-unit duplication yourself from file names, and hand it to the most relevant sub-agent as an explicit "also check X against Y" instruction.

Current structure for reference (verify in Phase 1):
- `engine/src`: `bots`, `game`, `lifecycle`, `mapgen`, `maps`, `session`, `social`, `territory`, `util`, `workers`, `callbacks.ts`, `types.ts`, `index.ts`
- `client/src`: `common`, `connector`, `game` (large, has `GameMap/hooks`, `panels`, etc.), `lib`, `lobby`, `pages`, `App.tsx`, `main.tsx`
- `server/src`: `game`, `workers`, `home.ts`, `maps.ts`, `rooms.ts`, `socketRooms.ts`, `validate.ts`, `index.ts`
- `mapper/src`: `components`, `utils`, `types.ts`, `main.tsx`

Output the final unit list: unit name, file list, file count, total LOC, and any special cross-check instructions.

## Phase 3: Spawn one sub-agent per unit

Spawn sub-agents (general-purpose), one per unit, and run them in parallel where possible. Give each sub-agent this brief:

> You are reviewing the review unit **{unit name}**. Files (review ONLY these):
> {file list}
>
> Read every file in your unit. Do a thorough review for:
> - **Duplicate code**: repeated logic that should be a shared function/helper within this unit.
> - **Simplification**: dead code, redundant state, needless indirection, over-complicated conditionals, unnecessary abstractions, single-use wrappers.
> - **Readability / maintainability refactors**: only where the improvement is clear and low-risk.
>
> Apply the ground rules above (no comments, single quotes, semicolons, no async/await, Bootstrap not CSS, engine independence, surgical changes, file under 1000 lines / folder under 10 files).
>
> Make the low-risk, clearly-correct fixes directly in the working tree. Keep changes surgical and minimal. It is a valid and expected outcome to find little or nothing, do not manufacture changes.
>
> **You are one of many sub-agents editing this one working tree at the same time.** Other sub-agents are concurrently changing files in other units right now. Do NOT run `git stash`, `git checkout`, `git restore`, `git reset`, `git clean`, `git rebase`, `git apply`, `git add`, or `git commit` — any of these will corrupt or hide other agents' in-progress work. Read-only git (`git status`, `git diff`, `git log`) is fine. Edit files only with the file tools. When you run `tsc`/`eslint`, expect to see transient errors in files outside your unit from other agents mid-edit — ignore those, note them, and never reset the tree to chase a clean baseline. If your own edits appear to have vanished, another agent's git command likely reverted them: re-apply with the file tools and note it — do not run git to recover.
>
> **When you are unsure** (a refactor is larger, riskier, changes a public/shared API, or you can see more than one reasonable option) do NOT apply it. List it under "Decisions needed" in your report with: what you'd change, why, the risk, and your recommended option. The orchestrator will decide and may send you a follow-up instruction to apply it.
>
> **Multi-unit refactors are allowed when necessary**, with caution. If the cleanest fix requires touching files outside your unit (renaming or moving a symbol that's imported elsewhere, updating call sites across modules) you may do it, but:
> - Only when it's the genuinely correct fix, not for convenience.
> - Put it under "Decisions needed" first and wait for the orchestrator's go-ahead, unless it's a mechanical, unambiguous update (e.g. fixing imports after a rename you were approved to do).
> - When applied, list every out-of-unit file you touched and exactly what changed, so the orchestrator can reconcile against other sub-agents.
> - Never change the engine-to-UI/network boundary or PROTOCOL.md-governed types without flagging to the orchestrator.
>
> {any cross-check instructions}
>
> After changes, run the relevant type-check / lint for this module (e.g. `tsc --noEmit`, `eslint`) and confirm it passes. Report any failures you couldn't resolve.
>
> Return a concise report (max ~300 words):
> - Files changed (including out-of-unit files) and a one-line description of each change.
> - Duplication removed (what, where).
> - Simplifications made.
> - **Decisions needed**: refactors you did not apply, with what, why, risk, recommended option.
> - Anything you deliberately left alone and why (if notable).
> - Issues found but not fixed (out of scope / risky).
> - Type-check / lint status.

## Phase 4: Resolve decisions and follow up

Each sub-agent returns a "Decisions needed" list of refactors it did not apply. For every item, YOU decide, using the repo's priority order:
1. **Readability** first: does the change make the code clearly easier to read and understand?
2. **Simplicity** next: does it remove duplication, indirection, or dead code without adding cost elsewhere?
3. **Optimization** last: only pursue performance changes when they don't hurt the first two.

Plus all other ground rules: surgical scope, match existing style, no comments, engine independence, PROTOCOL.md conformance, file/folder size limits.

For each decision:
- **Approve**: send a follow-up instruction to that same sub-agent to apply it (be specific about scope and any out-of-unit files it may touch). If it's a multi-unit change, make sure no other sub-agent is concurrently editing the same files; serialize if needed.
- **Reject**: record it in the final report under "Not done / recommendations" with a one-line rationale.
- **Modify**: tell the sub-agent the narrower/safer version to apply.

When in doubt, reject and recommend. The bar is "clearly correct and low-risk", not "plausibly nicer". Iterate with sub-agents until every decision is resolved.

## Phase 5: Consolidate

After all sub-agents and follow-ups finish:
1. Check `git stash list` and `git status`. If a sub-agent ran `git stash` despite the rule, its own and other agents' edits may be sitting in a stash instead of the working tree: for every file a stash touches, confirm the working-tree version is the intended final one (compare against the sub-agent reports and `git diff <stash>:<file> -- <file>`), recover any file that was left reverted, then drop the redundant stashes. Also confirm the set of modified files matches the union of what the sub-agents reported changing — no file silently reverted, none unexpectedly changed.
2. Run a full workspace type-check / lint / build for each module (`engine`, `server`, `client`, `mapper`) to confirm nothing broke across unit boundaries. Fix trivial breakages caused by the changes; escalate anything non-trivial in the report.
3. Review the set of changes for consistency (e.g. two units that both extracted a similar helper, consider whether it should be unified, but only if clean). Reconcile any overlapping edits from multi-unit refactors.
4. Produce the **final report** for the user. Keep it tight, roughly one page:
   - **Summary**: 2-3 sentences on overall code health and how much was changed.
   - **Changes by module**: bullet list, grouped by `engine` / `server` / `client` / `mapper`, each bullet one line.
   - **Duplication removed**: short list.
   - **Notable simplifications**: short list.
   - **Not done / recommendations**: issues found but out of scope, cross-cutting concerns, files approaching the 1000-line limit, suggested follow-ups.
   - **Verification**: type-check / lint / build status per module.
   - **Stats**: files reviewed, files changed, net LOC delta.

Do not commit. Present the final report and stop.
