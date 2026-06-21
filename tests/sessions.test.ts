import { test, expect } from "bun:test";
import { openDb } from "../src/store/db";
import {
  registerOrTouchSession, getSession, setStatus, listSessions, listActiveSessions,
} from "../src/store/sessions";

test("register crea; segundo register del mismo id actualiza, no duplica", () => {
  const db = openDb(":memory:");
  const a = registerOrTouchSession(db, { sessionId: "s1", label: "uno", branch: "main" });
  expect(a.sessionId).toBe("s1");
  const b = registerOrTouchSession(db, { sessionId: "s1", label: "uno-b", branch: "feat" });
  expect(b.branch).toBe("feat");
  expect(listSessions(db).length).toBe(1);
});

test("setStatus y listActiveSessions filtran por estado y frescura", () => {
  const db = openDb(":memory:");
  registerOrTouchSession(db, { sessionId: "s1", label: "a" });
  registerOrTouchSession(db, { sessionId: "s2", label: "b" });
  setStatus(db, "s2", "stopped");
  const active = listActiveSessions(db, 60_000);
  expect(active.map((s) => s.sessionId)).toEqual(["s1"]);
});

test("getSession null si no existe", () => {
  const db = openDb(":memory:");
  expect(getSession(db, "nope")).toBeNull();
});
