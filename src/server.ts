import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Database } from "bun:sqlite";
import { buildResume, collisionsFor } from "./service";
import { listActiveSessions } from "./store/sessions";
import { listActiveClaims } from "./store/claims";
import { listEventsSince } from "./store/events";
import { addNote, listNotes, markRead } from "./store/notes";

const ACTIVE_WINDOW_MS = 30 * 60_000;

export interface ServerDeps {
  resolveDbPath: (cwd: string) => string | null;
  openDb: (path: string) => Database;
  cwd: string;
}

function ok(structured: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(structured) }],
    structuredContent: structured as Record<string, unknown>,
  };
}
function fail(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true as const };
}

export function createServer(deps: ServerDeps): McpServer {
  const server = new McpServer({ name: "agora", version: "0.1.0" });

  // Devuelve el db abierto, o null si este repo no tiene ágora.
  const open = (): Database | null => {
    const path = deps.resolveDbPath(deps.cwd);
    if (!path) return null;
    return deps.openDb(path);
  };

  server.registerTool(
    "resume_project",
    {
      title: "Resume project",
      description: "Resumen del ágora del repo: sesiones activas, actividad reciente, colisiones y notas sin leer.",
      inputSchema: {},
      outputSchema: {
        sessions: z.array(z.any()), recentActivity: z.array(z.any()),
        fileConflicts: z.array(z.any()), branchCollisions: z.array(z.any()), summary: z.string(),
      },
    },
    async () => {
      const db = open();
      if (!db) return ok({ sessions: [], recentActivity: [], fileConflicts: [], branchCollisions: [], summary: "📋 Este repo no tiene ágora (sin ágora registrado)." });
      return ok(buildResume(db, ACTIVE_WINDOW_MS));
    },
  );

  server.registerTool(
    "who_is_here",
    {
      title: "Who is here",
      description: "Sesiones activas y qué archivos toca cada una.",
      inputSchema: {},
      outputSchema: { sessions: z.array(z.any()) },
    },
    async () => {
      const db = open();
      if (!db) return ok({ sessions: [] });
      const claims = listActiveClaims(db);
      const sessions = listActiveSessions(db, ACTIVE_WINDOW_MS).map((s) => ({
        ...s, currentFiles: claims.filter((c) => c.sessionId === s.sessionId).map((c) => c.filePath),
      }));
      return ok({ sessions });
    },
  );

  server.registerTool(
    "activity_log",
    {
      title: "Activity log",
      description: "Bitácora de eventos del repo (filtrable por minutos/sesión).",
      inputSchema: { sinceMinutes: z.number().optional(), sessionId: z.string().optional(), limit: z.number().optional() },
      outputSchema: { events: z.array(z.any()) },
    },
    async ({ sinceMinutes, sessionId, limit }) => {
      const db = open();
      if (!db) return ok({ events: [] });
      const since = (sinceMinutes ?? 24 * 60) * 60_000;
      return ok({ events: listEventsSince(db, since, { sessionId, limit }) });
    },
  );

  server.registerTool(
    "check_collision",
    {
      title: "Check collision",
      description: "¿Otra sesión activa está tocando estos archivos o esta rama?",
      inputSchema: { sessionId: z.string(), paths: z.array(z.string()), branch: z.string().optional() },
      outputSchema: { fileConflicts: z.array(z.any()), branchCollisions: z.array(z.any()), ok: z.boolean() },
    },
    async ({ sessionId, paths, branch }) => {
      const db = open();
      if (!db) return ok({ fileConflicts: [], branchCollisions: [], ok: true });
      const r = collisionsFor(db, { sessionId, paths, branch }, ACTIVE_WINDOW_MS);
      return ok({ ...r, ok: r.fileConflicts.length === 0 && r.branchCollisions.length === 0 });
    },
  );

  server.registerTool(
    "leave_note",
    {
      title: "Leave note",
      description: "Deja una nota para otra sesión (to) o para todas (broadcast si se omite to).",
      inputSchema: { fromSession: z.string(), to: z.string().optional(), body: z.string().min(1) },
      outputSchema: { id: z.string() },
    },
    async ({ fromSession, to, body }) => {
      const db = open();
      if (!db) return fail("Este repo no tiene ágora (no es repo git o sin actividad).");
      const n = addNote(db, { fromSession, toSession: to ?? null, body });
      return ok({ id: n.id });
    },
  );

  server.registerTool(
    "read_notes",
    {
      title: "Read notes",
      description: "Lee notas dirigidas a una sesión (o broadcast) y las marca leídas.",
      inputSchema: { forSession: z.string(), unreadOnly: z.boolean().optional() },
      outputSchema: { notes: z.array(z.any()) },
    },
    async ({ forSession, unreadOnly }) => {
      const db = open();
      if (!db) return ok({ notes: [] });
      const notes = listNotes(db, { forSession, unreadOnly });
      markRead(db, notes.map((n) => n.id));
      return ok({ notes });
    },
  );

  return server;
}
