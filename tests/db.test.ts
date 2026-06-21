import { test, expect } from "bun:test";
import { openDb } from "../src/store/db";

test("openDb crea las 4 tablas y activa WAL", () => {
  const db = openDb(":memory:");
  const names = (db.query("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[])
    .map((r) => r.name).sort();
  expect(names).toEqual(["events", "file_claims", "notes", "sessions"]);
  db.close();
});
