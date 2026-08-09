# V10 — Iteración en curso

> Tablero derivado: `V10_MASTER_STATE.json`. Aquí NO se repiten cifras (regla
> de la reconciliación del 8-ago: un dato, un sitio).

## `V10-TRUTH-001` — auditoría de verdad visual · ABIERTA (parcial)

### Lo que este turno HIZO (9-ago-2026)

1. **Primera inspección de V10 en navegador real.** `next dev` local con
   Firebase de mentira + Chromium por CDP. Siete pantallas públicas, escritorio
   1440 y iPhone 14, capturas en `agent-state/v10-screenshots/`.
2. **El flujo de la demo interactiva recorrido de punta a punta** (Agenda →
   Dictado → Nota → Receta) — funcionó entero, capturado por pasos.
3. **Primer defecto de V10 encontrado y cerrado**: discrepancia de hidratación
   `data-theme` en todas las pantallas (el script anti-parpadeo muta `<html>`
   antes de hidratar). Una línea + guardián probado al revés.
4. **Scorecard inicial** con la regla de honestidad: sólo se puntúa lo visto.
   Promedio público 8.33 — por debajo del objetivo 9.3, y las críticas siguen
   sin ver.
5. Bloqueo B-1 (auth para la superficie médico) documentado con su salida.
6. OD-1 (modelos con nombre en precios vs REG-292) elevado al dueño.

### Qué NO se hizo, a propósito

- No se puntuó ninguna pantalla médico desde el código (§33 lo prohíbe).
- No se tocó `planes-ia.ts` (comercial, espera al dueño).
- No se tocaron archivos de V9 (POSTVISIT-001 le pertenece a ese bucle).
- No se crearon los 20 documentos de §4 de golpe: se crean cuando su contenido
  existe de verdad, no como esqueletos vacíos («el sistema reduce decisiones,
  no crea burocracia», §8.34).

### Siguiente acción exacta

`V10-INFRA-EMULADOR` — cablear emuladores de Auth/Firestore detrás de
`NEXT_PUBLIC_FIREBASE_EMULATOR=1` + siembra sintética, para que la próxima
corrida pueda abrir `/citas` y `/consulta/[patientId]` de verdad y cerrar
V10-TRUTH-001 con las pantallas que importan.
