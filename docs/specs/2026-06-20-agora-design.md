# agora — Diseño (spec)

- **Fecha:** 2026-06-20
- **Autor:** Jose (Vorluno / Oruslabs) + Claude Code
- **Estado:** Aprobado para implementación (MVP)
- **Repo:** `C:\agora-mcp` → `github.com/vorluno/agora-mcp` (standalone, patrón de batuta-mcp)

---

## 1. Contexto y motivación

Cuando varias sesiones de Claude Code trabajan sobre el mismo repositorio (en paralelo o a lo
largo del tiempo), no se ven entre sí: ninguna sabe qué tocó la otra, se pisan archivos en
silencio y se pierde el contexto entre sesiones. El Batuta original resolvía parte de esto con un
daemon + dashboard web, pero esa pieza quedó jubilada por su complejidad operativa.

`agora` reencarna ese valor como un **espacio compartido y persistente por repositorio**, accesible
desde cualquier sesión de Claude Code vía **hooks + un MCP server**, sin daemon ni web. El nombre
evoca el ágora: la plaza donde los agentes conviven, dejan rastro y se coordinan.

## 2. Objetivo (MVP)

Que cualquier sesión de Claude Code, al trabajar en un repo, pueda:

1. **Entrar al espacio / retomar** (`resume_project`): ver de un vistazo qué hicieron y qué están
   haciendo las demás sesiones.
2. **Convivir con captura automática**: cada sesión registra sola, vía hooks, qué archivo/rama toca.
3. **Evitar pisarse**: aviso de colisión cuando va a editar un archivo (o trabajar una rama) que
   otra sesión activa ya tiene en mano.
4. **Dejarse notas** entre sesiones/agentes (mensajería asíncrona).
5. **Persistir**: todo sobrevive cierres y se retoma en cualquier momento.

## 3. No-objetivos (fuera del MVP)

- **No bloquear** ediciones por colisión (en v1 solo avisa; bloqueo proactivo = fase 2).
- **No daemon, no web, no dashboard.**
- **No spawning** de sesiones ni descomposición de planes (eso es `batuta-mcp`, un MCP aparte).
- **No** mensajería en tiempo real con push (las notas son un buzón asíncrono; se leen al consultar
  o al iniciar sesión).
- **No** integrar con la memoria de Claude Code (`~/.claude/.../memory`): `agora` guarda estado
  operativo vivo (quién hace qué), no hechos del usuario/proyecto.

## 4. Decisiones técnicas (validadas contra fuente)

| Decisión | Veredicto | Validado contra |
|---|---|---|
| Hooks `SessionStart` / `PreToolUse` / `PostToolUse` / `Stop` / `SessionEnd` existen y reciben `session_id`, `cwd`, `tool_name`, `tool_input.file_path` por stdin | ✅ | doc oficial Claude Code hooks (code.claude.com/docs/en/hooks) + uso real en el Batuta original |
| `SessionStart` puede inyectar contexto (stdout en exit 0, o `hookSpecificOutput.additionalContext`) | ✅ | hooks reference |
| `PreToolUse`/`PostToolUse` pueden inyectar `additionalContext` (aviso sin bloquear); `permissionDecision:"deny"`/exit 2 bloquea (reservado fase 2) | ✅ | hooks reference |
| Hooks best-effort: exit 0 nunca bloquea; exit 2 bloquea (no se usa en MVP) | ✅ | hooks reference |
| Config de hooks en `~/.claude/settings.json` (`hooks`→evento→`matcher`→`hooks[].command`), corren con el `cwd` del proyecto | ✅ | hooks reference |
| `bun:sqlite` con WAL soporta múltiples procesos (varias sesiones + MCP) | ✅ | uso real en el Batuta original (mismo stack) |
| SDK `@modelcontextprotocol/sdk` v1.29.0: `registerTool` con `inputSchema`/`outputSchema` raw shape; stdio; logs a stderr | ✅ | validado en batuta-mcp (ya implementado y conectado) |

**A confirmar en el plan (no asumir):** el formato exacto de `additionalContext` para `PreToolUse`
en la versión instalada de Claude Code; si difiere, el aviso usa `PostToolUse.additionalContext`
como mecanismo principal (avisa justo después de tocar, igual evita seguir pisando).

## 5. Arquitectura

**El espacio = `<main-repo-root>/.agora/space.db`** (SQLite, modo WAL). Sin daemon. Dos clientes lo
tocan directamente:

1. **hooks** (`type: command` → binario Bun `agora-hook`): escriben actividad automáticamente.
2. **MCP server** (`agora`, stdio): lee/escribe cuando interactuás en la sesión.

**Ubicación compartida entre worktrees (importante):** el `space.db` vive en el **root del repo
principal**, no en el del worktree, para que todas las sesiones del mismo repo —incluidas las que
corren en worktrees distintos— compartan UN solo ágora. Se resuelve con
`dirname(git rev-parse --path-format=absolute --git-common-dir)`. Queda **fuera de `.git/`** (que
Claude Code protege contra escritura de agentes). Si el `cwd` no es un repo git → no-op silencioso.

## 6. Modelo de datos (`space.db`, uno por repo)

Portado del Batuta original (renombrado para claridad). Schema con `CREATE TABLE IF NOT EXISTS`:

- **`sessions`** — `session_id` (PK), label, branch, worktree_path, status (`active`|`idle`|`stopped`), started_at, last_seen_at
- **`file_claims`** — id, session_id, file_path, mode (`writing`|`reading`), first_touched_at, last_touched_at, released_at
- **`events`** — id, session_id, type, payload (JSON), created_at → **la bitácora**
- **`notes`** — id, from_session, to_session (NULL = a todos), body, kind, read_at, created_at → **mensajería**

El "proyecto" *es* el repo: cada repo tiene su propio `space.db`, sin tabla de proyectos.

## 7. Captura automática (hooks)

`agora init` instala estos hooks en `~/.claude/settings.json` (idempotente, sin pisar los del
usuario). Todos resuelven el `space.db` desde `cwd` y son **best-effort (exit 0 siempre)**:

| Hook | matcher | Qué hace |
|---|---|---|
| `SessionStart` | (todos) | Registra/reactiva la sesión + **inyecta el resumen del ágora** (quién está, bitácora reciente, colisiones abiertas, notas sin leer) → "resume" automático |
| `PreToolUse` | `Edit\|Write` | Consulta colisión sobre `tool_input.file_path`; si la hay, **inyecta aviso** (no bloquea en v1) |
| `PostToolUse` | `Edit\|Write` | Registra `file_claim` + evento `file_touched`; recomputa colisiones; aviso si surge una nueva |
| `Stop` | (todos) | Marca la sesión `idle` |
| `SessionEnd` | (todos) | Marca `stopped` y libera los claims de la sesión |

El `agora-hook` recibe el nombre del evento como `argv` y el JSON por stdin (igual que el reporter
del Batuta original). La rama actual se captura con `git rev-parse --abbrev-ref HEAD` en `SessionStart`.

## 8. MCP tools (interacción en sesión)

Server stdio `agora`. Cada tool resuelve el `space.db` del repo (por `cwd` → main root). Schemas Zod
(raw shape), salida `structuredContent`, errores `isError`:

- **`resume_project`** — `{}` → `{ sessions[], recentActivity[], collisions[], unreadNotes[], summary }`. El "entrar al ágora".
- **`who_is_here`** — `{}` → `{ sessions: [{ session_id, label, branch, status, currentFiles[] }] }`.
- **`activity_log`** — `{ sinceMinutes?, sessionId?, limit? }` → `{ events[] }`. Bitácora filtrable.
- **`check_collision`** — `{ paths: string[], branch? }` → `{ collisions[], ok }`. Consulta explícita.
- **`leave_note`** — `{ to?: string, body: string }` → `{ id }`. Deja una nota (broadcast si `to` es null).
- **`read_notes`** — `{ unreadOnly?: boolean }` → `{ notes[] }`. Lee y marca leídas.

## 9. Colisiones

`detectConflicts` del Batuta original (dos sesiones con claim `writing` activo sobre el mismo
archivo) **+ extensión de rama**: dos sesiones distintas con la misma `branch` y distinto
`worktree_path` (trabajan la misma rama sin aislamiento). El aviso se inyecta vía hook
(`additionalContext`) y también está disponible bajo demanda con `check_collision`.

## 10. Persistencia / resume

El `space.db` **es** la persistencia (archivo en disco, por repo). `resume_project` y el hook
`SessionStart` lo leen para ponerte al día. Se retoma desde cualquier sesión, en cualquier momento,
sin pasos extra. Una sesión se considera "viva" si su `last_seen_at` es reciente; un reaper liviano
marca `idle`/`stopped` las sesiones sin actividad (umbral configurable, default 30 min).

## 11. Reuso del Batuta original y generalización

- **Portado:** `store/db.ts` (apertura + schema + WAL), `store/agents.ts`→`sessions`, `store/claims.ts`,
  `store/events.ts`, `store/messages.ts`→`notes`, `core/conflicts.ts`, y la forma del `hooks/report.ts`
  (pero escribiendo a SQLite directo en vez de HTTP a un daemon).
- **Nuevo:** resolución del `space.db` por repo/worktree (`lib/space-path.ts`), capa de servicio para
  las 6 tools, el `agora-hook` multi-evento, el `agora init` (instalador de hooks), la extensión de
  colisión por rama, y el armado del `summary` de `resume_project`.
- **Descartado:** daemon, dashboard, HTTP/WS, plans/orchestrator/spawn (eso es batuta-mcp).

## 12. Manejo de errores

- **Hooks**: best-effort, exit 0 siempre. Si `space.db` está lockeado → retry corto (p. ej. busy_timeout) y degradar en silencio. Jamás rompen la sesión del usuario.
- **MCP tools**: envuelven su lógica; devuelven `isError` con mensaje accionable; el server nunca crashea.
- **Concurrencia**: WAL (múltiples lectores + un escritor); `PRAGMA busy_timeout` para esperar locks breves.
- **No-repo / sin `.agora`**: las tools devuelven un estado vacío claro ("este repo no tiene ágora todavía"), no error.

## 13. Instalación

- `bun run src/cli.ts init` → instala los 5 hooks en `~/.claude/settings.json` (idempotente) y agrega `.agora/` al `.gitignore` del repo objetivo.
- `claude mcp add agora -- bun run C:\agora-mcp\src\index.ts` (scope user).

## 14. Testing

- **Store** (sessions/claims/events/notes) + **conflicts** (archivo y rama) con `space.db` temporal (`:memory:` o tmp).
- **space-path**: resolución del main root desde un worktree (fixture con `git worktree`).
- **agora-hook**: cada evento con input JSON simulado → asserts sobre el `space.db` resultante; best-effort (exit 0 ante db inexistente).
- **MCP tools**: las 6 sobre un `space.db` temp, vía cliente in-memory (como en batuta-mcp); incluye `resume_project` con varias sesiones y `read_notes` marcando leídas.
- **Concurrencia**: dos escritores simultáneos al mismo `space.db` (WAL) sin corrupción.
- **Gate**: `bun test` + `bunx tsc --noEmit` en verde.

## 15. Criterios de aceptación

- [ ] `agora init` instala los hooks sin pisar los existentes; `agora` aparece en `claude mcp list` como conectado.
- [ ] Al abrir una sesión en un repo con ágora, el `SessionStart` inyecta el resumen (sesiones, bitácora, colisiones, notas).
- [ ] Editar un archivo registra el `file_claim` y el evento en el `space.db` del **main repo root** (compartido entre worktrees).
- [ ] Si dos sesiones tocan el mismo archivo (o la misma rama), `check_collision`/los hooks lo detectan y avisan.
- [ ] `resume_project` / `who_is_here` / `activity_log` reflejan el estado real de todas las sesiones del repo.
- [ ] `leave_note` + `read_notes` permiten que una sesión deje un mensaje y otra lo lea (y quede marcado leído).
- [ ] Hooks best-effort: con el `space.db` ausente o lockeado, la sesión del usuario nunca se bloquea.
- [ ] `bun test` y `bunx tsc --noEmit` en verde.
