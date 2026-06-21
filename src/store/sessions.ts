import type { Database } from "bun:sqlite";
import type { Session, SessionStatus } from "../types";

interface Row {
  session_id: string; label: string; branch: string; worktree_path: string;
  status: string; started_at: number; last_seen_at: number;
}
function toSession(r: Row): Session {
  return {
    sessionId: r.session_id, label: r.label, branch: r.branch, worktreePath: r.worktree_path,
    status: r.status as SessionStatus, startedAt: r.started_at, lastSeenAt: r.last_seen_at,
  };
}

export function registerOrTouchSession(
  db: Database,
  input: { sessionId: string; label?: string; branch?: string; worktreePath?: string },
): Session {
  const now = Date.now();
  const existing = db.query("SELECT * FROM sessions WHERE session_id = ?").get(input.sessionId) as Row | null;
  if (existing) {
    db.run(
      `UPDATE sessions SET label = COALESCE(NULLIF(?, ''), label),
         branch = COALESCE(NULLIF(?, ''), branch),
         worktree_path = COALESCE(NULLIF(?, ''), worktree_path),
         status = 'active', last_seen_at = ? WHERE session_id = ?`,
      [input.label ?? "", input.branch ?? "", input.worktreePath ?? "", now, input.sessionId],
    );
    return getSession(db, input.sessionId)!;
  }
  db.run(
    `INSERT INTO sessions (session_id, label, branch, worktree_path, status, started_at, last_seen_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?)`,
    [input.sessionId, input.label ?? "", input.branch ?? "", input.worktreePath ?? "", now, now],
  );
  return getSession(db, input.sessionId)!;
}

export function getSession(db: Database, sessionId: string): Session | null {
  const r = db.query("SELECT * FROM sessions WHERE session_id = ?").get(sessionId) as Row | null;
  return r ? toSession(r) : null;
}

export function setStatus(db: Database, sessionId: string, status: SessionStatus): void {
  db.run("UPDATE sessions SET status = ?, last_seen_at = ? WHERE session_id = ?", [status, Date.now(), sessionId]);
}

export function touchSession(db: Database, sessionId: string): void {
  db.run("UPDATE sessions SET last_seen_at = ? WHERE session_id = ?", [Date.now(), sessionId]);
}

export function listSessions(db: Database): Session[] {
  return (db.query("SELECT * FROM sessions ORDER BY started_at ASC").all() as Row[]).map(toSession);
}

export function listActiveSessions(db: Database, sinceMs: number): Session[] {
  const cutoff = Date.now() - sinceMs;
  return (db.query("SELECT * FROM sessions WHERE status = 'active' AND last_seen_at >= ? ORDER BY started_at ASC")
    .all(cutoff) as Row[]).map(toSession);
}
