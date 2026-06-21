import { test, expect } from "bun:test";
import { openDb } from "../src/store/db";
import { enterSession, recordTouch, markStatus, buildResume } from "../src/service";

test("recordTouch detecta conflicto nuevo cuando una 2da sesión toca el mismo archivo", () => {
  const db = openDb(":memory:");
  enterSession(db, { sessionId: "s1", label: "A" });
  enterSession(db, { sessionId: "s2", label: "B" });
  expect(recordTouch(db, { sessionId: "s1", filePath: "a.ts" }).newFileConflict).toBeNull();
  const r = recordTouch(db, { sessionId: "s2", filePath: "a.ts" });
  expect(r.newFileConflict).toEqual({ filePath: "a.ts", sessionIds: ["s1", "s2"] });
});

test("buildResume arma summary con sesiones y conflictos", () => {
  const db = openDb(":memory:");
  enterSession(db, { sessionId: "s1", label: "A", branch: "feat" });
  recordTouch(db, { sessionId: "s1", filePath: "a.ts" });
  const resume = buildResume(db, 60 * 60_000);
  expect(resume.sessions.length).toBe(1);
  expect(resume.summary).toContain("agora");
});

test("markStatus stopped libera claims", () => {
  const db = openDb(":memory:");
  enterSession(db, { sessionId: "s1", label: "A" });
  recordTouch(db, { sessionId: "s1", filePath: "a.ts" });
  markStatus(db, "s1", "stopped");
  const resume = buildResume(db, 60 * 60_000);
  expect(resume.fileConflicts).toEqual([]);
});
