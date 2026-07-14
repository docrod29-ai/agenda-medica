# Iteración 5 — INTERACTIVE_DEMO · Reporte final

- **ID:** nexusmed-interactivedemo-005 · **Modo:** INTERACTIVE_DEMO · **Entorno:** staging / rama de features (`feat/inmunocomprometido-valoracion`) · **Producción:** no alterada (main en v372, sin cherry-pick, sin bump de SW).
- **Estado:** **DONE** (sandbox navegable extremo a extremo, datos ficticios, sin red/IA/PHI, verificado en navegador).

## Auditoría / línea basal
`/demo` ya existía (v348) pero es un **folleto estático**: seis flujos con maquetas + un `<video>`. Es honesto pero **no interactivo** — el visitante no conduce nada. El propio comentario del archivo reconocía el hueco: "el sandbox 100% navegable se integra en las siguientes iteraciones". Ese es exactamente el objetivo del loop en este modo: convertir la confianza en algo que el visitante **toca**.

## Diseño
Sandbox conducido por el visitante, con un contrato duro: **cero red, cero IA real, cero Firestore, cero PHI**. Todo el contenido clínico es ficticio y determinista (pre-escrito), solo se **revela por pasos** para reproducir el flujo real sin ejecutar backend. Banda permanente de "Demostración · datos ficticios". Pacientes identificados solo por iniciales (`M. F.`, `J. R.`), nunca un nombre real. Máquina de 4 pasos: **Agenda → Dictado → Nota → Receta**.

## Implementación
| Pieza | Resultado |
|---|---|
| Motor puro | ✅ `src/lib/demo-sandbox.ts` — escenarios ficticios (2 casos: HTA y faringoamigdalitis), guion de dictado por fragmentos, nota S/O/A/P pre-escrita, medicamentos, folio `RX-DEMO-*`. Sin React/DOM → testeable. |
| Sandbox interactivo | ✅ `src/app/demo/interactivo/page.tsx` — client, **standalone** (no usa providers del dashboard). El visitante elige cita → "graba" (revelado progresivo con reloj y cursor) → ve armarse la nota → genera receta → "simula escaneo del QR" y aparece la tarjeta *Integridad verificada*. Botones Reiniciar / Probar otro caso. |
| Accesibilidad | ✅ `prefers-reduced-motion`: si está activo, el dictado se llena de golpe y se desactivan animaciones. Foco/hover con estado. |
| Enlace desde `/demo` | ✅ CTA primario en el hero: "Probar el sandbox interactivo" + "Sin registro · datos ficticios · lo conduces tú". |
| Protección | ✅ No hay token ni PHI, así que no requiere headers especiales; no llama a ningún endpoint. |
| Tests | ✅ `src/__tests__/demo-sandbox.test.ts` (6 casos): escenarios ficticios (regex de iniciales, folio `RX-DEMO`), nota S/O/A/P completa, avance/tope de pasos, revelado incremental, `dictadoCompleto`. |

**Archivos nuevos:** `src/lib/demo-sandbox.ts`, `src/app/demo/interactivo/page.tsx`, `src/__tests__/demo-sandbox.test.ts`, este reporte.
**Modificados:** `src/app/demo/page.tsx` (CTA + comentario de roadmap).
**Migraciones/deps nuevas:** 0.

## Pruebas
- `tsc --noEmit` → exit 0.
- `vitest run` → **399/399** (393 previos + 6 nuevos; sin regresión).
- `next build` → OK; ruta `/demo/interactivo` presente (○ estática).
- **Verificación E2E en navegador (localhost:3001), recorrido completo:**
  1. Agenda con 2 citas ficticias → clic en "Paciente M. F." avanza a Dictado.
  2. "Grabar dictado" → la transcripción se revela por fragmentos con reloj → "Dictado completo".
  3. "Generar nota" → nota S/O/A/P renderizada.
  4. "Generar receta" → receta con membrete + "Simular escaneo del QR" → **Integridad verificada · Generado por NexusMED · Folio RX-DEMO-A1 · Vigente** + disclaimer.
  - **Responsive móvil (375×812):** receta+verificación colapsan a 1 columna, sin scroll horizontal, indicador de pasos envuelve limpio (captura tomada).

## Resultados (antes/después)
| | Antes (`/demo`) | Después (`/demo/interactivo`) |
|---|---|---|
| Interactividad | folleto estático (scroll) | sandbox conducido por el visitante |
| Flujo mostrado | maquetas separadas | Agenda→Dictado→Nota→Receta encadenado |
| Verificación de receta | caja "QR" estática | tarjeta *Integridad verificada* al "escanear" |
| Datos | genéricos | ficticios, etiquetados, solo iniciales |
| Red / IA / PHI | ninguna | **ninguna** (100% cliente, determinista) |
| Accesibilidad de la animación | — | respeta `prefers-reduced-motion` |
| Producción alterada | — | **No** |

## Riesgos residuales
- El realismo es intencionadamente limitado (2 casos, guion fijo) para no prometer más de lo que la demo es. Ampliar a más especialidades es incremental.
- El único error de consola es el hydration-mismatch global en `data-theme` del `<html>` (script anti-flicker de tema de toda la app, dev-only) — no proviene de esta página.

## Quality Gate
```
QUALITY GATE: PASS — sandbox navegable extremo a extremo; SIN red/IA/Firestore/PHI
(100% cliente y determinista, verificado); datos ficticios y etiquetados (solo
iniciales); accesible (prefers-reduced-motion); responsive sin overflow; tsc 0,
399/399 tests, build OK, recorrido E2E completo en navegador. Producción NO
alterada. production_deployment_allowed:false.
```

## Rollback
Commits en la rama de features; `git revert`. Producción intacta. El cambio es puramente aditivo (ruta nueva + un CTA); nada existente cambia de comportamiento.

## Siguiente iteración recomendada (no implementada)
`ITERACIÓN 6 — CLINICAL_AI_DEMO` (demostración honesta del apoyo clínico: cómo el código calcula de forma determinista y el modelo explica, con "indeterminado" cuando faltan datos y sin afirmaciones diagnósticas — reutilizando el trabajo del Clinical Intelligence System sin exponerlo como producto médico).
