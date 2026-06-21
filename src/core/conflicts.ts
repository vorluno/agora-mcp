import type { FileClaim, Session, FileConflict, BranchCollision } from "../types";

export function detectFileConflicts(claims: FileClaim[]): FileConflict[] {
  const byFile = new Map<string, Set<string>>();
  for (const c of claims) {
    if (c.releasedAt !== null) continue;
    if (c.mode !== "writing") continue;
    let set = byFile.get(c.filePath);
    if (!set) { set = new Set(); byFile.set(c.filePath, set); }
    set.add(c.sessionId);
  }
  const out: FileConflict[] = [];
  for (const [filePath, sessions] of byFile) {
    if (sessions.size >= 2) out.push({ filePath, sessionIds: [...sessions] });
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
