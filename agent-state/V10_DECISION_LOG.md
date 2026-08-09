# V10 — Bitácora de decisiones

| Fecha | Decisión | Quién | Por qué |
|---|---|---|---|
| 2026-08-09 | La rama V10 es `claude/kind-brahmagupta-397pqw` (la designada de la sesión), no la propuesta genérica de §3 | V10 | §3: «si existe una rama V10 configurada explícitamente, úsala» |
| 2026-08-09 | Las capturas de evidencia viven en `agent-state/v10-screenshots/` y SÍ se commitean | V10 | §3 las declara memoria persistente; sin ellas el scorecard no se puede auditar |
| 2026-08-09 | `suppressHydrationWarning` en `<html>` en vez de mover el tema a cookies/SSR | V10 | Es el patrón documentado de React/next-themes para scripts anti-parpadeo; una línea, reversible, no toca el comportamiento del tema |
| 2026-08-09 | Los documentos de §4 se crean cuando su contenido existe, no como esqueletos | V10 | §8.34; los equivalentes V9 (docs/design/*) ya cubren varios y se referencian en vez de duplicarse |
| 2026-08-09 | La demo interactiva se usa como proxy del flujo clínico, declarándolo | V10 | Único camino sin auth este turno; el scorecard marca las críticas como SIN PUNTUAR |
| 2026-08-09 | El arreglo de hidratación NO acuña número REG en la rama | V10 | V7 sigue acuñando REGs en main y la colisión de numeración V9↔main ya costó una renumeración entera (ver d088c34). No es regresión clínica; su guardián vive en el test y en el backlog V10. Si al fusionar se quiere ledger, se acuña ahí con el número que toque |
| 2026-08-09 | El flake de `ops-timeout-y-punto-ciego` («el error dice cuánto esperó») NO se toca | V10 | Preexistente y del ENTORNO: el proxy de egreso de esta sandbox CONTESTA por 10.255.255.1, así que la conexión a veces gana al timeout de 30 ms. En CI real el IP no rutea y el test es estable. Tocar un guardián sellado por un artefacto del entorno sería esconder un test que falla |
