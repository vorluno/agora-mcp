import type { Database } from "bun:sqlite";
import type { AgoraEvent } from "../types";

interface Row { id: string; session_id: string | null; type: string; payload: string | null; created_at: number; }
function toEvent(r: Row): AgoraEvent {
  return { id: r.id, sessionId: r.session_id, type: r.type,
    payload: r.payload ? JSON.parse(r.payload) : null, createdAt: r.created_at };
}

export function logEvent(
  db: Database,
  input: { sessionId?: string | null; type: string; payload?: unknown },
): AgoraEvent {
  const id = crypto.randomUUID();
  const now = Date.now();
  const payload = input.payload === undefined ? null : JSON.stringify(input.payload);
  db.run("INSERT INTO events (id, session_id, type, payload, created_at) VALUES (?, ?, ?, ?, ?)",
    [id, input.sessionId ?? null, input.type, payload, now]);
  return { id, sessionId: input.sessionId ?? null, type: input.type, payload: input.payload ?? null, createdAt: now };
}

export function listEvents(db: Database, limit = 100): AgoraEvent[] {
  return (db.query("SELECT * FROM events ORDER BY created_at DESC, rowid DESC LIMIT ?")
    .all(limit) as Row[]).map(toEvent);
}

export function listEventsSince(
  db: Database, sinceMs: number, opts: { sessionId?: string; limit?: number } = {},
): AgoraEvent[] {
  const cutoff = Date.now() - sinceMs;
  const limit = opts.limit ?? 200;
  if (opts.sessionId) {
    return (db.query("SELECT * FROM events WHERE created_at >= ? AND session_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?")
      .all(cutoff, opts.sessionId, limit) as Row[]).map(toEvent);
  }
  return (db.query("SELECT * FROM events WHERE created_at >= ? ORDER BY created_at DESC, rowid DESC LIMIT ?")
    .all(cutoff, limit) as Row[]).map(toEvent);
}
