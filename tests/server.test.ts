import { test, expect } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server";
import { openDb } from "../src/store/db";

async function connect() {
  const db = openDb(":memory:");
  const deps = { resolveDbPath: () => "x", openDb: () => db, cwd: "/r" };
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const server = createServer(deps);
  await server.connect(st);
  const client = new Client({ name: "t", version: "0" });
  await client.connect(ct);
  return { client, db };
}

test("expone exactamente las 6 tools", async () => {
  const { client } = await connect();
  const names = (await client.listTools()).tools.map((t) => t.name).sort();
  expect(names).toEqual([
    "activity_log", "check_collision", "leave_note", "read_notes", "resume_project", "who_is_here",
  ]);
});

test("leave_note + read_notes round-trip", async () => {
  const { client } = await connect();
  await client.callTool({ name: "leave_note", arguments: { fromSession: "s1", to: "s2", body: "hola" } });
  const res = await client.callTool({ name: "read_notes", arguments: { forSession: "s2", unreadOnly: true } });
  expect((res.structuredContent as { notes: unknown[] }).notes.length).toBe(1);
});

test("resume_project sin repo → estado vacío, no error", async () => {
  const db = openDb(":memory:");
  const deps = { resolveDbPath: () => null, openDb: () => db, cwd: "/r" };
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const server = createServer(deps);
  await server.connect(st);
  const client = new Client({ name: "t", version: "0" });
  await client.connect(ct);
  const res = await client.callTool({ name: "resume_project", arguments: {} });
  expect(res.isError).toBeUndefined();
  expect((res.structuredContent as { summary: string }).summary).toContain("sin ágora");
});
