# agora

Espacio compartido y persistente por repositorio para sesiones de Claude Code: cada sesión
registra su actividad vía hooks, ves qué hicieron/hacen las demás, te avisa si vas a pisar
trabajo ajeno, y podés dejar notas. Sin daemon. Diseño: `docs/specs/2026-06-20-agora-design.md`.

## Cómo funciona

El espacio es un SQLite (`<repo>/.agora/space.db`, modo WAL) que todas las sesiones del repo
leen y escriben. Los hooks capturan actividad automáticamente; el MCP server te deja consultar
e interactuar.

## Tools (MCP)

- `resume_project` — resumen del ágora (sesiones, actividad, colisiones, notas)
- `who_is_here` — sesiones activas + qué archivos tocan
- `activity_log` — bitácora filtrable
- `check_collision` — ¿alguien más toca estos archivos/rama?
- `leave_note` / `read_notes` — mensajería entre sesiones

## Requisitos

- [Bun](https://bun.sh) 1.3+
- `git` 2.x

## Instalación

```bash
bun install
bun run src/cli.ts init                         # instala los 5 hooks (idempotente)
claude mcp add agora -- bun run C:\agora-mcp\src\index.ts   # registra el MCP (scope user)
```

## Tests

```bash
bun test
bunx tsc --noEmit
```
