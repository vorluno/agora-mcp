export type SessionStatus = "active" | "idle" | "stopped";

export interface Session {
  sessionId: string;
  label: string;
  branch: string;
  worktreePath: string;
  status: SessionStatus;
  startedAt: number;
  lastSeenAt: number;
}

export type ClaimMode = "writing" | "reading";

export interface FileClaim {
  id: string;
  sessionId: string;
  filePath: string;
  mode: ClaimMode;
  firstTouchedAt: number;
  lastTouchedAt: number;
  releasedAt: number | null;
}

export interface AgoraEvent {
  id: string;
  sessionId: string | null;
  type: string;
  payload: unknown;
  createdAt: number;
}

export interface Note {
  id: string;
  fromSession: string;
  toSession: string | null;
  body: string;
  kind: string;
  readAt: number | null;
  createdAt: number;
}

export interface FileConflict {
  filePath: string;
  sessionIds: string[];
}

export interface BranchCollision {
  branch: string;
  sessionIds: string[];
}
