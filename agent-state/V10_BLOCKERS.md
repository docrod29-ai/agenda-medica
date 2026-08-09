# V10 — bloqueos

## B-1 · Sin sesión no hay pantallas clínicas que mirar (activo)

**Qué bloquea**: las 33 pantallas `medico`, las 9 de `paciente` con token y todo
el flujo dorado real. El §33 prohíbe aprobarlas desde el código.

**Causa**: este contenedor no tiene credenciales de Firebase (ni debe tenerlas:
regla de datos — cero pacientes reales). Sin `NEXT_PUBLIC_FIREBASE_*` reales no
hay login; sin login no hay superficie clínica.

**Lo que YA se resolvió de este bloqueo (9-ago-2026)**: la parte «ninguna página
renderiza» era `getAuth(app)` al evaluar el módulo; con `.env.local` sintético
(no versionado) la superficie pública entera renderiza y se auditó.

**Plan A (elegido, no requiere al dueño)**: `V10-ENV-001` — emuladores de
Firebase detrás de `NEXT_PUBLIC_USE_EMULATORS=1` + semilla sintética. El repo ya
usa emuladores en `npm run test:emulador`, así que `firebase-tools` ya es
dependencia conocida del flujo.

**Plan B (si la red del contenedor no deja bajar los binarios del emulador)**:
proyecto Firebase de prueba dedicado (decisión del dueño: crear un proyecto
`nexusmed-visual-qa` sin datos reales) — anotado en
`V10_OWNER_DECISIONS_REQUIRED.md` como *opcional*, sólo si el Plan A fracasa.

**Mientras tanto**: nada parado — la superficie pública ya se auditó y hay
trabajo P1 implementable sin sesión.
