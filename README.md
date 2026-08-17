# Panel

A local-first, multi-agent code review companion for Electron. Point it at a local git repo; three specialized Claude agents review the current diff **concurrently**, each through a narrow lens defined by its own skill file, and a fourth orchestrator agent merges their findings into one ranked report.

Your code never leaves your machine except for the diff text sent to the Anthropic API for review — there's no cloud upload, no account, no server component.

## Architecture

- **`skills/`** — one Markdown file per agent (`security.md`, `correctness.md`, `simplification.md`, `orchestrator.md`). Each is a scoped system prompt: what that agent looks for, what it explicitly ignores, and what a valid finding requires. This is the same skill-file pattern used to scope specialized subagents in Claude Code itself.
- **`src/main/git.ts`** — reads the current diff (staged changes, or working tree if nothing's staged) from a local repo via `git diff`.
- **`src/main/agents.ts`** — runs the three reviewers concurrently (`Promise.all`) against the diff, each forced into a structured JSON tool call so output is parseable, then runs the orchestrator pass to dedupe/rank the combined findings.
- **`src/main/store.ts`** — persists review history locally (`userData/review-history.json`), no database.
- **`src/preload`** — the only bridge between renderer and main; exposes a narrow `window.panel` API via `contextBridge`.
- **`src/renderer`** — React UI: pick a repo, watch the three agents' status live while they run in parallel, browse the merged findings.

## Running it

```bash
npm install
cp .env.example .env   # add your ANTHROPIC_API_KEY
npm run dev
```

## Status

Early-stage MVP. Packaging/distribution (electron-builder, code signing, auto-update) is intentionally deferred until the core review loop is proven out end to end.
