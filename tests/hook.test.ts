import { test, expect } from "bun:test";
import { handleHook } from "../src/hook";
import { openDb } from "../src/store/db";

function makeDeps(dbPath: string | null) {
  return { dbPath, openDb, branch: "feat" };
}

test("PostToolUse registra el touch; SessionStart devuelve el resumen", () => {
  const db = openDb(":memory:");
  // dbPath no se usa porque inyectamos un openDb que ignora la ruta:
  const deps = { dbPath: "x", openDb: () => db, branch: "feat" };
  handleHook("PostToolUse", { session_id: "s1", cwd: "/r", tool_name: "Edit", tool_input: { file_path: "a.ts" } }, deps);
  const summary = handleHook("SessionStart", { session_id: "s2", cwd: "/r" }, deps);
  expect(summary).toContain("agora");
});

test("dbPath null (no repo) → no-op, devuelve null, no tira", () => {
  expect(handleHook("PostToolUse", { session_id: "s1", cwd: "/r", tool_input: { file_path: "a.ts" } }, makeDeps(null))).toBeNull();
});

test("PreToolUse con colisión devuelve aviso", () => {
  const db = openDb(":memory:");
  const deps = { dbPath: "x", openDb: () => db, branch: "feat" };
  handleHook("SessionStart", { session_id: "s1", cwd: "/r" }, deps);
  handleHook("PostToolUse", { session_id: "s1", cwd: "/r", tool_input: { file_path: "a.ts" } }, deps);
  handleHook("SessionStart", { session_id: "s2", cwd: "/r" }, deps);
  const warn = handleHook("PreToolUse", { session_id: "s2", cwd: "/r", tool_input: { file_path: "a.ts" } }, deps);
  expect(warn).toContain("a.ts");
});
