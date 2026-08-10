# Registro de decisiones V10

## D-1 · 10-ago-2026 — Rama de trabajo
La spec §3 propone `claude/nexus-visual-excellence-v10`, pero la sesión
programada trae rama configurada `claude/kind-brahmagupta-bttia7` y la propia
spec dice que una rama explícitamente configurada gana. Se usa la configurada.
Reversible: renombrar/migrar cuando el dueño lo pida.

## D-2 · 10-ago-2026 — No duplicar la verdad de V9
V10-TRUTH-001 **absorbe** las auditorías de V9 (`SCREEN_INVENTORY.md`,
`GENERIC_AI_AESTHETIC_AUDIT.md`, `NAVIGATION_STATE_AUDIT.md`,
`NEXUS_DESIGN_SYSTEM.md`) en lugar de regenerarlas. Lo que V9 no hizo y V10
exige — **mirar el producto corriendo en un navegador** — es el trabajo nuevo.
Los archivos que la spec §4 pide con otro nombre se mapean en
`V10_MASTER_STATE.json`, no se crean duplicados (regla de CLAUDE.md: una sola
fuente de verdad).

## D-3 · 10-ago-2026 — Evidencia de pantalla en el repositorio
Las capturas de la auditoría se guardan comprimidas (JPEG) bajo
`docs/design/screenshots/v10/` con nombre `<ruta>__<ancho>.jpg`. Son la
evidencia que la spec exige para toda puntuación. Cuando exista
`tests/visual/` (V10-VISUAL-REGRESSION-001), las líneas base vivirán allí.

## D-4 · 10-ago-2026 — Alcance del navegador en este entorno
Sin credenciales de Firebase y sin cableado de emulador en el cliente, la
inspección en navegador cubre la superficie pública + `/demo/interactivo`
(clínica, offline, ficticia). Las pantallas `medico` se puntúan **sólo** cuando
puedan verse corriendo (B-1). No se puntúa desde el código: la spec lo prohíbe.
