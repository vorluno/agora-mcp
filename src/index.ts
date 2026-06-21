#!/usr/bin/env bun
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server";
import { openDb } from "./store/db";
import { agoraDbPath } from "./lib/space-path";
import { logger, setVerbose } from "./lib/logger";

async function main(): Promise<void> {
  if (process.argv.includes("--verbose")) setVerbose(true);
  const server = createServer({
    resolveDbPath: (cwd) => agoraDbPath(cwd),
    openDb,
    cwd: process.cwd(),
  });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("agora MCP running on stdio");
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("Fatal error in agora:", err);
    process.exit(1);
  });
}
