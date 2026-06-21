<div align="center">

<img src="./assets/banner.jpg" alt="agora — a shared space for your Claude Code sessions" width="100%" />

# agora

**A shared, persistent space for your Claude Code sessions — per repository.**

See what other sessions are doing, get warned before you overwrite their work, and leave notes. No daemon, no server to run.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Bun](https://img.shields.io/badge/Bun-1.3+-fbf0df?logo=bun&logoColor=black)](https://bun.sh)
[![Model Context Protocol](https://img.shields.io/badge/MCP-compatible-6E56CF)](https://modelcontextprotocol.io)
[![Built with Claude Code](https://img.shields.io/badge/Built_with-Claude_Code-D97757)](https://claude.com/claude-code)

</div>

---

## Why

When several Claude Code sessions work on the same repository — in parallel, or just over the course of a day — they're **blind to each other**. None of them knows what the others touched, they overwrite the same files silently, and the context is lost when you close them.

**agora** gives every session a shared place to leave a trail and look at each other's work.

## How it works

The whole system is **one SQLite file per repo**: `<repo-root>/.agora/space.db` (in WAL mode, so multiple processes read and write it at once without corruption).

- **No one runs a server.** There's no daemon, no web app. The "space" *is* the file.
- Every session of the repo **writes** what it does and **reads** what the others did.
- Because it's a file, it **persists by itself** — close everything, come back tomorrow, the state is still there.
- It's a **shared board**, not a live chat: sessions find out when they **start**, when they're **about to edit** (collision), or when they **ask** (the tools).

> Multi-worktree friendly: the `.db` lives at the **main repo root**, so every session of the repo — including those in different worktrees — shares **one** agora.

## Features

- 🟢 **See who's here** and what files each session is touching, live.
- ⚠️ **Collision warnings** — before you edit a file (or work a branch) another active session already holds.
- 📋 **Project resume** — open a session and get a summary of what the others did.
- 📓 **Activity log** — a per-repo timeline of everything that happened.
- ✉️ **Notes** between sessions (directed or broadcast).
- 🛡️ **Best-effort hooks** — they exit `0` no matter what; they never block your session.

## Requirements

- [Bun](https://bun.sh) 1.3+
- `git` 2.x
- [Claude Code](https://claude.com/claude-code) (or any MCP client)

## Installation

```bash
git clone https://github.com/vorluno/agora-mcp.git
cd agora-mcp
bun install

# Install the 5 hooks (idempotent). Add --project to scope to the current repo only.
bun run src/cli.ts init

# Register the MCP server
claude mcp add agora -- bun run /absolute/path/to/agora-mcp/src/index.ts
```

## Configuration

Any MCP client works. The `mcpServers` entry:

```json
{
  "mcpServers": {
    "agora": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/agora-mcp/src/index.ts"]
    }
  }
}
```

For **Claude Code**, `claude mcp add` (above) writes this for you. For **Warp** or **Cursor**, paste the snippet into their MCP settings.

## Tools

| Tool | Description |
|------|-------------|
| `resume_project` | Summary of the agora: active sessions, recent activity, collisions, unread notes. |
| `who_is_here` | Active sessions and which files each one is touching. |
| `activity_log` | The repo's event log, filterable by time/session. |
| `check_collision` | Is another active session touching these files or this branch? |
| `leave_note` | Leave a note for another session (or broadcast to all). |
| `read_notes` | Read notes addressed to a session (marks them read). |

## How collisions are detected

- **File collision:** 2+ distinct sessions with an active `writing` claim on the **same file**.
- **Branch collision:** 2+ active sessions on the **same branch** but in **different worktrees**.

Only **live** sessions are counted, so a session that died without a clean exit won't produce false positives.

## Automatic capture (hooks)

`init` installs 5 best-effort hooks (they always `exit 0`):

| Hook | What it does |
|------|--------------|
| `SessionStart` | Registers the session **and injects the agora summary** into your context (also fires on `/resume` and after a context compaction). |
| `PostToolUse` (Edit/Write) | Records the file claim + event; warns if a new collision appears. |
| `PreToolUse` (Edit/Write) | Warns you *before* editing if another session already holds the file. |
| `Stop` / `SessionEnd` | Marks the session idle / stopped and releases its claims. |

## Development

```bash
bun test          # full suite (incl. a real WAL concurrency test)
bunx tsc --noEmit # type-check
```

Built test-first across 14 TDD tasks with per-task and whole-branch review.

## License

[MIT](./LICENSE) © 2026 Vorluno

---

<div align="center">

Built by **[Vorluno](https://vorluno.dev)** — a software studio from Panamá 🇵🇦

Part of the [`mcp-s`](https://github.com/vorluno/mcp-s) family of MCP servers.

</div>
