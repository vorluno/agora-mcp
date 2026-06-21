import { test, expect } from "bun:test";
import { detectFileConflicts, detectBranchCollisions } from "../src/core/conflicts";
import type { FileClaim, Session } from "../src/types";

const claim = (sessionId: string, filePath: string): FileClaim => ({
  id: sessionId + filePath, sessionId, filePath, mode: "writing",
  firstTouchedAt: 0, lastTouchedAt: 0, releasedAt: null,
});

test("file conflict: 2 sesiones writing el mismo archivo", () => {
  const out = detectFileConflicts([claim("s1", "a.ts"), claim("s2", "a.ts"), claim("s1", "b.ts")]);
  expect(out).toEqual([{ filePath: "a.ts", sessionIds: ["s1", "s2"] }]);
});

test("file: una sola sesión no es conflicto; reading no cuenta", () => {
  const reading: FileClaim = { ...claim("s2", "a.ts"), mode: "reading" };
  expect(detectFileConflicts([claim("s1", "a.ts"), reading])).toEqual([]);
});

const sess = (sessionId: string, branch: string, wt: string): Session => ({
  sessionId, label: sessionId, branch, worktreePath: wt, status: "active",
  startedAt: 0, lastSeenAt: 0,
});

test("branch collision: misma rama, distinto worktree", () => {
  const out = detectBranchCollisions([sess("s1", "feat", "/a"), sess("s2", "feat", "/b")]);
  expect(out).toEqual([{ branch: "feat", sessionIds: ["s1", "s2"] }]);
});

test("branch: mismo worktree no colisiona; rama vacía se ignora", () => {
  expect(detectBranchCollisions([sess("s1", "feat", "/a"), sess("s2", "feat", "/a")])).toEqual([]);
  expect(detectBranchCollisions([sess("s1", "", "/a"), sess("s2", "", "/b")])).toEqual([]);
});
