import { test, expect } from "bun:test";
import { openDb } from "../src/store/db";
import { logEvent, listEvents, listEventsSince } from "../src/store/events";

test("logEvent persiste y parsea payload; listEvents desc", () => {
  const db = openDb(":memory:");
  logEvent(db, { sessionId: "s1", type: "file_touched", payload: { filePath: "a.ts" } });
  logEvent(db, { sessionId: "s1", type: "registered" });
  const evs = listEvents(db);
  expect(evs[0]!.type).toBe("registered");
  expect((evs[1]!.payload as { filePath: string }).filePath).toBe("a.ts");
});

test("listEventsSince filtra por sesión", () => {
  const db = openDb(":memory:");
  logEvent(db, { sessionId: "s1", type: "x" });
  logEvent(db, { sessionId: "s2", type: "y" });
  const evs = listEventsSince(db, 60_000, { sessionId: "s2" });
  expect(evs.map((e) => e.type)).toEqual(["y"]);
});
