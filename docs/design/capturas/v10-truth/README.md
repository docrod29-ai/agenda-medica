# Capturas del golden flow — V10-TRUTH-001

Evidencia visual de V10 §33/§34/§35: **ninguna pantalla se aprueba leyendo
JSX/CSS**. Las puntuaciones que citan estas capturas viven en
`agent-state/V10_VISUAL_SCORECARD.json`; la línea base de accesibilidad, en
`axe-baseline.json` (resumen en `docs/design/ACCESSIBILITY.md`).

Todo el contenido es **sintético** (regla `data-privacy.md`): consultorio,
médica y pacientes inventados por `scripts/design/sembrar-capturas.mjs`.

## Cómo se regeneran

```bash
# 1. Emuladores (Auth 9099 + Firestore 8080; requiere JRE)
npx firebase emulators:start --only firestore,auth --project demo-nexusmed-test

# 2. Siembra sintética
node scripts/design/sembrar-capturas.mjs

# 3. App de producción apuntando a los emuladores
#    (.env.local con NEXT_PUBLIC_FIREBASE_EMULATORS=1 y projectId demo-nexusmed-test)
npm run build
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npm start

# 4. Capturas + axe
node scripts/design/capturar-golden-flow.mjs
```

**Ojo** (aprendido el 9-ago-2026): si se re-compila con el servidor de `npm
start` vivo, el servidor viejo sirve chunks borrados y las capturas salen SIN
CSS. Matar el servidor, compilar, arrancar de nuevo, capturar.

## Qué hay

- `<pantalla>--<desktop|tablet|mobile>.png` — 1440×900 · 768×1024 · 390×844.
- `axe-baseline.json` — violaciones WCAG 2.x AA por pantalla (escritorio).
- `consola-errores--*.json` — errores de consola vistos durante la corrida
  (sólo se escribe si hubo alguno).

Las capturas se **reemplazan** en cada corrida: la historia queda en Git.
