import type { Database } from "bun:sqlite";
import type {
  Session, SessionStatus, FileConflict, BranchCollision, AgoraEvent,
} from "./types";
import { registerOrTouchSession, setStatus, touchSession, listSessions, listActiveSessions } from "./store/sessions";
import { upsertClaim, releaseAllForSession, listActiveClaims } from "./store/claims";
import { logEvent, listEventsSince } from "./store/events";
import { detectFileConflicts, detectBranchCollisions } from "./core/conflicts";

export function enterSession(
  db: Database,
  input: { sessionId: string; label?: string; branch?: string; worktreePath?: string },
): Session {
  const s = registerOrTouchSession(db, input);
  logEvent(db, { sessionId: s.sessionId, type: "session_start", payload: { label: s.label, branch: s.branch } });
  return s;
}

export function recordTouch(
  db: Database, input: { sessionId: string; filePath: string },
): { newFileConflict: FileConflict | null } {
  const before = new Set(detectFileConflicts(listActiveClaims(db)).map((c) => c.filePath));
  upsertClaim(db, { sessionId: input.sessionId, filePath: input.filePath });
  touchSession(db, input.sessionId);
  logEvent(db, { sessionId: input.sessionId, type: "file_touched", payload: { filePath: input.filePath } });
  const afterClaims = listActiveClaims(db);
  const after = detectFileConflicts(afterClaims);
  let fresh = after.find((c) => c.filePath === input.filePath && !before.has(c.filePath)) ?? null;
  if (fresh) {
    // Sort sessionIds by first_touched_at ascending so order is deterministic (first claimer first)
    const claimOrder = new Map(afterClaims.map((c) => [c.sessionId, c.firstTouchedAt]));
    fresh = {
      ...fresh,
      sessionIds: [...fresh.sessionIds].sort((a, b) => (claimOrder.get(a) ?? 0) - (claimOrder.get(b) ?? 0)),
    };
  }
  if (fresh) {
    logEvent(db, { sessionId: input.sessionId, type: "conflict_detected", payload: fresh });
  }
  return { newFileConflict: fresh };
}

export function markStatus(db: Database, sessionId: string, status: SessionStatus): void {
  setStatus(db, sessionId, status);
  if (status === "stopped") releaseAllForSession(db, sessionId);
  logEvent(db, { sessionId, type: "status_changed", payload: { status } });
}

export function collisionsFor(
  db: Database,
  input: { sessionId: string; paths: string[]; branch?: string },
  sinceMs: number,
): { fileConflicts: FileConflict[]; branchCollisions: BranchCollision[] } {
  const claims = listActiveClaims(db);
  const fileConflicts = detectFileConflicts(claims).filter(
    (c) => input.paths.includes(c.filePath) && c.sessionIds.some((id) => id !== input.sessionId),
  );
  const sessions = listActiveSessions(db, sinceMs);
  let branchCollisions = detectBranchCollisions(sessions);
  if (input.branch) branchCollisions = branchCollisions.filter((b) => b.branch === input.branch);
  branchCollisions = branchCollisions.filter((b) => b.sessionIds.some((id) => id !== input.sessionId));
  return { fileConflicts, branchCollisions };
}

export function buildResume(
  db: Database, sinceMs: number,
): {
  sessions: Session[]; recentActivity: AgoraEvent[];
  fileConflicts: FileConflict[]; branchCollisions: BranchCollision[]; summary: string;
} {
  const sessions = listSessions(db);
  const active = listActiveSessions(db, sinceMs);
  const recentActivity = listEventsSince(db, sinceMs, { limit: 30 });
  const fileConflicts = detectFileConflicts(listActiveClaims(db));
  const branchCollisions = detectBranchCollisions(active);
  const parts: string[] = [`📋 agora — ${active.length} sesión(es) activa(s).`];
  for (const s of active) {
    parts.push(`🟢 ${s.label || s.sessionId} (rama ${s.branch || "?"})`);
  }
  if (fileConflicts.length) parts.push(`⚠️ ${fileConflicts.length} colisión(es) de archivo abiertas.`);
  if (branchCollisions.length) parts.push(`⚠️ ${branchCollisions.length} colisión(es) de rama.`);
  return { sessions, recentActivity, fileConflicts, branchCollisions, summary: parts.join("\n") };
}
