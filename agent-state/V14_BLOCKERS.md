# V14 — Bloqueadores

Ninguno detiene el programa. Se listan los que condicionan corridas concretas.

## B-V14-1 · Credenciales de navegador en corridas cloud — MITIGADO

El arnés de capturas autenticado corre con **emuladores demo** (heredado de
V10, `scripts/design/`); no necesita credenciales reales. Si una corrida no
puede levantar Chromium/emuladores, lo declara y no puntúa a ciegas.

## B-V14-2 · Fuentes tipográficas del Identity Lock

Bricolage Grotesque / Instrument Sans / Spline Sans Mono no están hoy en el
proyecto. Cargarlas es trabajo de `V14-IDENTITY-001` (self-host, sin CDN en
runtime por la CSP del producto). No requiere al dueño.

## B-V14-3 · PARITY+ requiere evidencia externa fechada

Las filas de la matriz exigen fuente pública + fecha + verified_at. Una corrida
sin acceso web a los sitios de competidores deja la fila en
`UNKNOWN — EVIDENCE INSUFFICIENT`; nunca se rellena de memoria.

## B-V14-4 · Ramas de sesión fragmentan la historia (estructural)

Igual que en V10: cada corrida programada nace en su rama de sesión. Protocolo
anti-fragmentación en `V14_CURRENT_ITERATION.md`. La recomendación al dueño
(PR de la punta reconciliada a main) sigue pendiente — véase
`V14_OWNER_DECISIONS_REQUIRED.md`.
