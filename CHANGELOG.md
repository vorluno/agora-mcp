# Changelog

Formato de [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versionado según
[SemVer](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — sin publicar

### Changed

- **La licencia pasa de MIT a Apache-2.0.** Las versiones hasta la 0.1.0 incluida siguen siendo MIT:
  una licencia ya concedida no se retira. Apache-2.0 concede además derechos de patente de forma
  explícita, que es lo que MIT deja sin decir. Ver [NOTICE](./NOTICE).

### Added

- `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `AUTHORS` y plantillas de issue y de pull
  request.
- CI en tres sistemas operativos, análisis de CodeQL, y Dependabot para npm y para las propias
  acciones.
- Publicación con **procedencia** (`npm publish --provenance`): el tarball queda firmado con el
  commit y el workflow del que salió.
- **`agora-init` se expone como binario.** `src/cli.ts` viajaba dentro del paquete publicado pero
  no estaba en `bin`, así que quien instalaba desde npm **no podía instalar los hooks**: el paquete
  servía a medias y nada lo decía.

## [0.1.0] — 2026-06-22

Primera publicación.
