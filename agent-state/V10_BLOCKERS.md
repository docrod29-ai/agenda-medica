# V10 — Bloqueos

## B-1 · La superficie médico no se puede INSPECCIONAR sin autenticación

**Qué bloquea**: la especificación §33 prohíbe aprobar una pantalla leyendo el
código; las pantallas críticas de Practice (`/citas`, `/consulta/[patientId]`,
`/receta/…`, `/nota/…`, `/pacientes`, `/dashboard`) viven detrás de Firebase
Auth. Este entorno no tiene credenciales (`NEXT_PUBLIC_FIREBASE_*` ausentes) y
el cliente (`src/lib/firebase.ts`) **no tiene cableado de emuladores**: sólo
`test:emulador` (vitest + Firestore) los usa, no la app.

**No es un bloqueo de dueño**: hay un camino seguro y reversible.

**Camino recomendado (siguiente tarea V10)**: cablear
`connectAuthEmulator`/`connectFirestoreEmulator` en `src/lib/firebase.ts`
detrás de una variable explícita (`NEXT_PUBLIC_FIREBASE_EMULATOR=1`) que jamás
se activa en producción, + un guion de siembra con pacientes sintéticos de
`synthetic-data/`. Con eso, cualquier corrida futura de V10 puede levantar el
producto completo con datos ficticios y verlo de verdad.

**Alternativa del dueño** (más rápida, no necesaria): una cuenta de prueba en
un proyecto Firebase de staging + sus variables de entorno para el entorno de
las corridas programadas.

**Mientras tanto**: la demo interactiva (`/demo/interactivo`) sirvió de proxy
del flujo clínico este turno, pero NO sustituye a las pantallas reales — la
consulta real tiene 5 872 líneas; la demo es una maqueta.
