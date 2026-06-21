import type { Database } from "bun:sqlite";
import type { Note } from "../types";

interface Row {
  id: string; from_session: string; to_session: string | null; body: string;
  kind: string; read_at: number | null; created_at: number;
}
function toNote(r: Row): Note {
  return {
    id: r.id, fromSession: r.from_session, toSession: r.to_session, body: r.body,
    kind: r.kind, readAt: r.read_at, createdAt: r.created_at,
  };
}

export function addNote(
  db: Database,
  input: { fromSession: string; toSession?: string | null; body: string; kind?: string },
): Note {
  const id = crypto.randomUUID();
  const now = Date.now();
  const kind = input.kind ?? "info";
  const toSession = input.toSession ?? null;
  db.run(
    "INSERT INTO notes (id, from_session, to_session, body, kind, read_at, created_at) VALUES (?, ?, ?, ?, ?, NULL, ?)",
    [id, input.fromSession, toSession, input.body, kind, now],
  );
  return { id, fromSession: input.fromSession, toSession, body: input.body, kind, readAt: null, createdAt: now };
}

export function listNotes(db: Database, opts: { forSession?: string; unreadOnly?: boolean }): Note[] {
  const where: string[] = [];
  const params: (string | null)[] = [];
  if (opts.forSession) {
    // dirigidas a esa sesión o broadcast (to_session NULL)
    where.push("(to_session = ? OR to_session IS NULL)");
    params.push(opts.forSession);
  }
  if (opts.unreadOnly) where.push("read_at IS NULL");
  const sql = "SELECT * FROM notes" + (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
    " ORDER BY created_at ASC";
  return (db.query(sql).all(...(params as any)) as Row[]).map(toNote);
}

export function markRead(db: Database, ids: string[]): void {
  if (ids.length === 0) return;
  const now = Date.now();
  const placeholders = ids.map(() => "?").join(",");
  const params: (string | number)[] = [now];
  params.push(...ids);
  db.run(
    `UPDATE notes SET read_at = ? WHERE id IN (${placeholders}) AND read_at IS NULL`,
    params as any,
  );
}
