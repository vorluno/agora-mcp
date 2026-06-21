import { test, expect } from "bun:test";
import { openDb } from "../src/store/db";
import { addNote, listNotes, markRead } from "../src/store/notes";

test("addNote y listNotes para una sesión (dirigidas + broadcast)", () => {
  const db = openDb(":memory:");
  addNote(db, { fromSession: "s1", toSession: "s2", body: "para s2" });
  addNote(db, { fromSession: "s1", toSession: null, body: "para todos" });
  addNote(db, { fromSession: "s1", toSession: "s3", body: "para s3" });
  const forS2 = listNotes(db, { forSession: "s2" });
  expect(forS2.map((n) => n.body).sort()).toEqual(["para s2", "para todos"]);
});

test("markRead marca leídas y unreadOnly las excluye", () => {
  const db = openDb(":memory:");
  const n = addNote(db, { fromSession: "s1", toSession: "s2", body: "hola" });
  markRead(db, [n.id]);
  expect(listNotes(db, { forSession: "s2", unreadOnly: true }).length).toBe(0);
});
