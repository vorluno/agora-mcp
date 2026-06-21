import { test, expect } from "bun:test";
import { mergeHooks } from "../src/cli";

const PREFIX = "bun run C:/agora-mcp/src/hook.ts";

test("agrega los 5 hooks de agora", () => {
  const out = mergeHooks({}, PREFIX);
  expect(Object.keys(out.hooks).sort()).toEqual(
    ["PostToolUse", "PreToolUse", "SessionEnd", "SessionStart", "Stop"],
  );
  const cmds = out.hooks.SessionStart[0].hooks[0].command;
  expect(cmds).toContain("SessionStart");
});

test("idempotente: correrlo dos veces no duplica", () => {
  const once = mergeHooks({}, PREFIX);
  const twice = mergeHooks(once, PREFIX);
  expect(twice.hooks.PostToolUse.length).toBe(once.hooks.PostToolUse.length);
});

test("conserva hooks ajenos existentes", () => {
  const existing = { hooks: { SessionStart: [{ matcher: "", hooks: [{ type: "command", command: "echo mio" }] }] } };
  const out = mergeHooks(existing, PREFIX);
  const cmds = out.hooks.SessionStart.flatMap((g: any) => g.hooks.map((h: any) => h.command));
  expect(cmds.some((c: string) => c.includes("echo mio"))).toBe(true);
  expect(cmds.some((c: string) => c.includes("agora"))).toBe(true);
});
