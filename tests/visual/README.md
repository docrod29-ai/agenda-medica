# tests/visual — V10

## Arnés de capturas del golden flow (B-V10-2, cerrado 9-ago-2026)

Captura las pantallas críticas de Practice **autenticadas y con datos
sintéticos**, en los cuatro anchos de V10 §39. Nada de esto toca producción:
la siembra **aborta** si no hay emuladores.

```bash
# 1. Emuladores (Auth 9099 + Firestore 8080, proyecto demo)
npx firebase emulators:start --only auth,firestore --project demo-nexusmed-test

# 2. Siembra sintética (médico, clínica, pacientes, citas de HOY)
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
node tests/visual/sembrar-sintetico.mjs

# 3. Build + servidor con los NEXT_PUBLIC_* del arnés (se incrustan en build)
NEXT_PUBLIC_FIREBASE_API_KEY=demo-api-key \
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=localhost \
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-nexusmed-test \
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=demo-nexusmed-test.appspot.com \
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=000000000000 \
NEXT_PUBLIC_FIREBASE_APP_ID=1:000000000000:web:demo \
NEXT_PUBLIC_FIREBASE_EMULATORS=1 \
npm run build && FIREBASE_ADMIN_PROJECT_ID=demo-nexusmed-test \
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
npx next start

# 4. Capturas (9 pantallas × 4 viewports)
node tests/visual/capturar-golden-flow.mjs docs/design/capturas/golden-flow
```

- La conexión de la app a los emuladores vive en `src/lib/firebase.ts`, detrás
  de `NEXT_PUBLIC_FIREBASE_EMULATORS=1` — la variable no existe en Vercel.
- `reducedMotion: 'reduce'` en todos los contextos: capturas deterministas.
- Las pruebas de regresión visual (comparación contra baseline) se añaden con
  `V10-VISUAL-REGRESSION-001`; una prueba que no puede fallar no se admite
  (`.claude/rules/testing-gates.md`).
