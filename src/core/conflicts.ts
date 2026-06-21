import type { FileClaim, Session, FileConflict, BranchCollision } from "../types";

export function detectFileConflicts(claims: FileClaim[]): FileConflict[] {
  const byFile = new Map<string, Map<string, number>>(); // filePath -> (sessionId -> firstTouchedAt)
  for (const c of claims) {
    if (c.releasedAt !== null) continue;
    if (c.mode !== "writing") continue;
    let m = byFile.get(c.filePath);
    if (!m) { m = new Map(); byFile.set(c.filePath, m); }
    const prev = m.get(c.sessionId);
    m.set(c.sessionId, prev === undefined ? c.firstTouchedAt : Math.min(prev, c.firstTouchedAt));
  }
  const out: FileConflict[] = [];
  for (const [filePath, sessions] of byFile) {
    if (sessions.size >= 2) {
      const sessionIds = [...sessions.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);
      out.push({ filePath, sessionIds });
    }
  }
  return out;
}

export function detectBranchCollisions(sessions: Session[]): BranchCollision[] {
  const byBranch = new Map<string, { sessions: Set<string>; worktrees: Set<string> }>();
  for (const s of sessions) {
    if (s.status !== "active") continue;
    if (s.branch.trim() === "") continue;
    let entry = byBranch.get(s.branch);
    if (!entry) { entry = { sessions: new Set(), worktrees: new Set() }; byBranch.set(s.branch, entry); }
    entry.sessions.add(s.sessionId);
    entry.worktrees.add(s.worktreePath);
  }
  const out: BranchCollision[] = [];
  for (const [branch, entry] of byBranch) {
    if (entry.sessions.size >= 2 && entry.worktrees.size >= 2) {
      out.push({ branch, sessionIds: [...entry.sessions] });
    }
  }
  return out;
}
