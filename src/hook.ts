#!/usr/bin/env bun
import type { Database } from "bun:sqlite";
import { openDb as realOpenDb } from "./store/db";
import { agoraDbPath } from "./lib/space-path";
import { currentBranch } from "./lib/git";
import { enterSession, recordTouch, markStatus, buildResume } from "./service";
import { listActiveClaims } from "./store/claims";

const ACTIVE_WINDOW_MS = 30 * 60_000;

interface HookDeps {
  dbPath: string | null;
  openDb: (path: string) => Database;
  branch: string;
}

/** PURO respecto del proceso: nunca tira; devuelve texto a inyectar (o null). */
export function handleHook(event: string, input: any, deps: HookDeps): string | null {
  try {
    if (!deps.dbPath) return null;
    const sessionId = input?.session_id;
    if (!sessionId) return null;
    const db = deps.openDb(deps.dbPath);
    const cwd = String(input?.cwd ?? "");

    if (event === "SessionStart") {
      enterSession(db, { sessionId, label: basename(cwd), branch: deps.branch, worktreePath: cwd });
      return buildResume(db, ACTIVE_WINDOW_MS).summary;
    }
    if (event === "PostToolUse") {
      const filePath = input?.tool_input?.file_path;
      if (!filePath) return null;
      const { newFileConflict } = recordTouch(db, { sessionId, filePath });
      if (newFileConflict) {
        const others = newFileConflict.sessionIds.filter((id) => id !== sessionId);
        return `⚠️ agora: acabás de tocar ${filePath}, que también está trabajando: ${others.join(", ")}. Coordiná para no pisarse.`;
      }
      return null;
    }
    if (event === "PreToolUse") {
      const filePath = input?.tool_input?.file_path;
      if (!filePath) return null;
      const claims = listActiveClaims(db);
      const others = claims
        .filter((c) => c.filePath === filePath && c.sessionId !== sessionId && c.releasedAt === null)
        .map((c) => c.sessionId);
      if (others.length) {
        return `⚠️ agora: ${filePath} ya lo está trabajando ${others.join(", ")}. Si editás pueden pisarse.`;
      }
      return null;
    }
    if (event === "Stop") { markStatus(db, sessionId, "idle"); return null; }
    if (event === "SessionEnd") { markStatus(db, sessionId, "stopped"); return null; }
    return null;
  } catch {
    return null; // best-effort: jamás romper la sesión
  }
}

function basename(p: string): string {
  const parts = p.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "session";
}

async function main(): Promise<void> {
  try {
    const event = process.argv[2] ?? "";
    const raw = await Bun.stdin.text();
    const input = raw ? JSON.parse(raw) : {};
    const cwd = String(input?.cwd ?? process.cwd());
    const dbPath = agoraDbPath(cwd);
    const branch = currentBranch(cwd);
    const out = handleHook(event, input, { dbPath, openDb: realOpenDb, branch });
    if (out) {
      const payload = { hookSpecificOutput: { hookEventName: event, additionalContext: out } };
      process.stdout.write(JSON.stringify(payload) + "\n");
    }
  } catch {
    // tragamos todo
  } finally {
    process.exit(0);
  }
}

if (import.meta.main) void main();
