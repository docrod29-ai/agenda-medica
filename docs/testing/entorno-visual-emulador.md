# Entorno visual con emuladores — abrir NexusMED en un navegador sin credenciales

Nació el 9-ago-2026 (V10-TRUTH-001). Antes, ver el producto exigía
credenciales de Firebase que este contenedor no tiene, y la verificación
visual llevaba TODO V9 declarada pendiente (`NAV-NAVEGADOR-001`).

## Los candados

- El SDK cliente sólo se conecta a los emuladores con
  `NEXT_PUBLIC_FIREBASE_EMULATORS=1` **y** `NODE_ENV !== 'production'`
  (`src/lib/firebase.ts`). La variable no existe en Vercel; aunque existiera,
  la segunda condición la anula.
- El `projectId` empieza por `demo-` → el SDK y firebase-tools se **niegan**
  a contactar un proyecto real. Ninguna corrida puede tocar datos de pacientes.
- La semilla es 100 % sintética (regla «cero pacientes reales»).

## Receta (4 pasos)

```bash
# 1 · Config sintética (gitignored). Escribir .env.local con:
#     NEXT_PUBLIC_FIREBASE_API_KEY=fake-api-key
#     NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=127.0.0.1
#     NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-nexusmed-dev
#     NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=demo-nexusmed-dev.appspot.com
#     NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=000000000000
#     NEXT_PUBLIC_FIREBASE_APP_ID=1:000000000000:web:demo
#     NEXT_PUBLIC_FIREBASE_EMULATORS=1

# 2 · Emuladores (Auth 9099 + Firestore 8080, reglas reales del repo)
npx firebase emulators:start --only firestore,auth --project demo-nexusmed-dev &

# 3 · Semilla sintética (médico + consultorio + pacientes + citas de hoy)
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/emulador/sembrar-consultorio-sintetico.mjs

# 4 · App
npm run dev
# → http://localhost:3000/login · medico@demo.nexusmed.test / demo-visual-2026
```

## Lo que este entorno NO cubre todavía

Las rutas de `src/app/api/**` validan sesión con `firebase-admin`, que aún no
apunta al emulador → responden **401**. El flujo visual llega hasta la
pantalla de consulta; transcripción, nota IA y todo lo que pase por API
queda para cuando el proceso `next dev` arranque con
`FIREBASE_AUTH_EMULATOR_HOST` y `FIRESTORE_EMULATOR_HOST` (pendiente en
`agent-state/V10_BLOCKERS.md`).

## Guardián

`src/__tests__/emuladores-solo-en-desarrollo.test.ts` — comprueba que la
conexión a emuladores queda detrás de la doble condición y que la semilla
aborta sin `FIRESTORE_EMULATOR_HOST` y con `projectId` que no sea `demo-`.
