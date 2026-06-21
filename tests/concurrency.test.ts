import { test, expect } from "bun:test";
import { openDb } from "../src/store/db";
import { upsertClaim, listActiveClaims } from "../src/store/claims";

test("dos escritores al mismo archivo WAL no corrompen (mismo proceso, conexiones distintas)", () => {
  const dir = `${process.cwd()}/.agora-test-${Date.now()}`;
  require("fs").mkdirSync(dir, { recursive: true });
  const path = `${dir}/space.db`;
  const a = openDb(path);
  const b = openDb(path);
  for (let i = 0; i < 50; i++) {
    upsertClaim(a, { sessionId: "sa", filePath: `a${i}.ts` });
    upsertClaim(b, { sessionId: "sb", filePath: `b${i}.ts` });
  }
  a.close(); b.close();
  const c = openDb(path);
  expect(listActiveClaims(c).length).toBe(100);
  c.close();
  require("fs").rmSync(dir, { recursive: true, force: true });
});
