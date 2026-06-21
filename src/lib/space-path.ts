import { mainRepoRoot } from "./git";

export type RootResolver = (cwd: string) => string | null;

export function agoraDbPath(cwd: string, resolveRoot: RootResolver = mainRepoRoot): string | null {
  const root = resolveRoot(cwd);
  if (!root) return null;
  const base = root.replace(/\\/g, "/").replace(/\/$/, "");
  return `${base}/.agora/space.db`;
}
