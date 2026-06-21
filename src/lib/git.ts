export function runGit(args: string[], cwd: string): { code: number; stdout: string } {
  try {
    const proc = Bun.spawnSync(["git", "-C", cwd, ...args], { stdout: "pipe", stderr: "pipe" });
    return { code: proc.exitCode, stdout: proc.stdout.toString().trim() };
  } catch {
    return { code: 1, stdout: "" };
  }
}

/** Root del repo PRINCIPAL (compartido entre worktrees), o null si no es repo git. */
export function mainRepoRoot(cwd: string): string | null {
  const r = runGit(["rev-parse", "--path-format=absolute", "--git-common-dir"], cwd);
  if (r.code !== 0 || r.stdout === "") return null;
  const common = r.stdout.replace(/\\/g, "/").replace(/\/$/, ""); // .../.git
  const idx = common.lastIndexOf("/");
  return idx === -1 ? null : common.slice(0, idx);
}

export function currentBranch(cwd: string): string {
  const r = runGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  return r.code === 0 ? r.stdout : "";
}
