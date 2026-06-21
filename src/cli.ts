import { homedir } from "os";
import { mainRepoRoot } from "./lib/git";

// Los 5 hooks de agora. matcher "" = todos; Edit|Write para tool hooks.
const AGORA_HOOKS: { event: string; matcher: string; arg: string }[] = [
  { event: "SessionStart", matcher: "", arg: "SessionStart" },
  { event: "PreToolUse", matcher: "Edit|Write", arg: "PreToolUse" },
  { event: "PostToolUse", matcher: "Edit|Write", arg: "PostToolUse" },
  { event: "Stop", matcher: "", arg: "Stop" },
  { event: "SessionEnd", matcher: "", arg: "SessionEnd" },
];

function isAgoraCommand(cmd: unknown): boolean {
  return typeof cmd === "string" && cmd.includes("agora") && cmd.includes("hook");
}

export function addAgoraToGitignore(existing: string): string {
  const lines = existing.split(/\r?\n/);
  if (lines.some((l) => l.trim() === ".agora/")) return existing;
  const base = existing === "" ? "" : existing.endsWith("\n") ? existing : existing + "\n";
  return base + ".agora/\n";
}

/** PURO: ruta del settings.json — global (home) o por proyecto (cwd) con `--project`. */
export function resolveSettingsPath(project: boolean, home: string, cwd: string): string {
  const base = (project ? cwd : home).replace(/\\/g, "/");
  return `${base}/.claude/settings.json`;
}

/** PURO: agrega los hooks de agora a `settings` sin pisar ni duplicar. */
export function mergeHooks(settings: any, hookCommandPrefix: string): any {
  const out = structuredClone(settings ?? {});
  out.hooks = out.hooks ?? {};
  for (const h of AGORA_HOOKS) {
    const groups: any[] = out.hooks[h.event] ?? (out.hooks[h.event] = []);
    const already = groups.some((g) => (g.hooks ?? []).some((x: any) => isAgoraCommand(x.command)));
    if (already) continue;
    groups.push({
      matcher: h.matcher,
      hooks: [{ type: "command", command: `${hookCommandPrefix} ${h.arg}`, timeout: 5 }],
    });
  }
  return out;
}

async function main(): Promise<void> {
  const project = process.argv.includes("--project");
  const settingsPath = resolveSettingsPath(project, homedir(), process.cwd());
  const file = Bun.file(settingsPath);
  const current = (await file.exists()) ? JSON.parse(await file.text()) : {};
  const prefix = "bun run C:/agora-mcp/src/hook.ts";
  const merged = mergeHooks(current, prefix);
  await Bun.write(settingsPath, JSON.stringify(merged, null, 2));
  console.error(`agora: hooks instalados en ${settingsPath} (scope ${project ? "proyecto" : "global"})`);
  console.error(
    project
      ? "agora: registrá el MCP (scope local) con: claude mcp add -s local agora -- bun run C:/agora-mcp/src/index.ts"
      : "agora: registrá el MCP con: claude mcp add agora -- bun run C:/agora-mcp/src/index.ts",
  );
  const repoRoot = mainRepoRoot(process.cwd());
  if (repoRoot) {
    const giPath = `${repoRoot}/.gitignore`;
    const existing = (await Bun.file(giPath).exists()) ? await Bun.file(giPath).text() : "";
    const updated = addAgoraToGitignore(existing);
    if (updated !== existing) {
      await Bun.write(giPath, updated);
      console.error(`agora: .agora/ agregado a ${giPath}`);
    }
  }
}

if (import.meta.main) void main();
