import { test, expect } from "bun:test";
import { openDb } from "../src/store/db";
import { upsertClaim, releaseAllForSession, listActiveClaims } from "../src/store/claims";

test("upsert no duplica el mismo (sesión, archivo) activo", () => {
  const db = openDb(":memory:");
  upsertClaim(db, { sessionId: "s1", filePath: "a.ts" });
  upsertClaim(db, { sessionId: "s1", filePath: "a.ts" });
  expect(listActiveClaims(db).length).toBe(1);
});

test("releaseAllForSession libera los claims de esa sesión", () => {
  const db = openDb(":memory:");
  upsertClaim(db, { sessionId: "s1", filePath: "a.ts" });
  upsertClaim(db, { sessionId: "s2", filePath: "b.ts" });
  releaseAllForSession(db, "s1");
  expect(listActiveClaims(db).map((c) => c.filePath)).toEqual(["b.ts"]);
});
