import { Database } from "bun:sqlite";
import { SCHEMA_SQL } from "./schema";

export function openDb(path: string): Database {
  const db = new Database(path);
  db.run("PRAGMA journal_mode = WAL;");
  db.run("PRAGMA busy_timeout = 2000;");
  db.run("PRAGMA foreign_keys = ON;");
  db.run(SCHEMA_SQL);
  return db;
}
