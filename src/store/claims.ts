import type { Database } from "bun:sqlite";
import type { FileClaim, ClaimMode } from "../types";

interface Row {
  id: string; session_id: string; file_path: string; mode: string;
  first_touched_at: number; last_touched_at: number; released_at: number | null;
}
function toClaim(r: Row): FileClaim {
  return {
    id: r.id, sessionId: r.session_id, filePath: r.file_path, mode: r.mode as ClaimMode,
    firstTouchedAt: r.first_touched_at, lastTouchedAt: r.last_touched_at, releasedAt: r.released_at,
  };
}

export function upsertClaim(
  db: Database,
  input: { sessionId: string; filePath: string; mode?: ClaimMode },
): FileClaim {
  const mode = input.mode ?? "writing";
  const now = Date.now();
  const existing = db
    .query("SELECT * FROM file_claims WHERE session_id = ? AND file_path = ? AND released_at IS NULL")
    .get(input.sessionId, input.filePath) as Row | null;
  if (existing) {
    db.run("UPDATE file_claims SET last_touched_at = ?, mode = ? WHERE id = ?", [now, mode, existing.id]);
    return toClaim({ ...existing, last_touched_at: now, mode });
  }
  const id = crypto.randomUUID();
  db.run(
    `INSERT INTO file_claims (id, session_id, file_path, mode, first_touched_at, last_touched_at, released_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`,
    [id, input.sessionId, input.filePath, mode, now, now],
  );
  return { id, sessionId: input.sessionId, filePath: input.filePath, mode, firstTouchedAt: now, lastTouchedAt: now, releasedAt: null };
}

export function releaseAllForSession(db: Database, sessionId: string): void {
  db.run("UPDATE file_claims SET released_at = ? WHERE session_id = ? AND released_at IS NULL",
    [Date.now(), sessionId]);
}

export function listActiveClaims(db: Database): FileClaim[] {
  return (db.query("SELECT * FROM file_claims WHERE released_at IS NULL ORDER BY last_touched_at DESC")
    .all() as Row[]).map(toClaim);
}
