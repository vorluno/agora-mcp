import { test, expect } from "bun:test";
import { agoraDbPath } from "../src/lib/space-path";

test("compone <root>/.agora/space.db con separadores normalizados", () => {
  const path = agoraDbPath("/whatever", () => "C:\\proj");
  expect(path).toBe("C:/proj/.agora/space.db");
});

test("devuelve null si no hay repo (resolver null)", () => {
  expect(agoraDbPath("/x", () => null)).toBeNull();
});
