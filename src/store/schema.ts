export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  label TEXT NOT NULL DEFAULT '',
  branch TEXT NOT NULL DEFAULT '',
  worktree_path TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  started_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS file_claims (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'writing',
  first_touched_at INTEGER NOT NULL,
  last_touched_at INTEGER NOT NULL,
  released_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_claims_active ON file_claims(file_path, mode, released_at);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  type TEXT NOT NULL,
  payload TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_time ON events(created_at);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  from_session TEXT NOT NULL,
  to_session TEXT,
  body TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'info',
  read_at INTEGER,
  created_at INTEGER NOT NULL
);
`;
