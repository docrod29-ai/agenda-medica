# Iteración 7 — OFFLINE_AND_RESILIENCE · Reporte

- **Iteration ID:** nexusmed-mobile-007 · **Modo:** OFFLINE_AND_RESILIENCE · **Entorno:** staging / rama `feat/mobile-excellence` · **Producción:** no alterada · `production_deployment_allowed: false`.
- **Estado:** **PARTIAL — se cerró el vector SEGURO del P0 de PHy (residuo al cerrar sesión); la ofuscación/cifrado del borrador ACTIVO se difiere por riesgo a la recuperación.**

## Decisión de seguridad (importante)
El P0 crítico [RES-1] es "borrador clínico en `localStorage` plano". La tentación es cifrar/ofuscar el valor — **pero ese respaldo ES el mecanismo de recuperación de borradores**, con **6+ puntos de lectura/escritura** + un respaldo en memoria + UI de recuperación. Reescribir su formato **a ciegas** (no puedo verificar la recuperación en ejecución sin sesión) arriesga lo peor: **perder la nota de un paciente**. Eso viola la regla no negociable "no perder notas".

Por eso esta iteración ataca **solo la parte del riesgo que es segura y no toca el round-trip activo**: eliminar el **residuo de PHI al cerrar sesión** (§7.2 "limpiar al cerrar sesión", §9.2 "limpiar caché sensible al cerrar sesión"). En un **dispositivo compartido**, tras cerrar sesión ya no queda el borrador clínico. La recuperación activa **no se toca** → riesgo cero de pérdida.

## Entregado (verificable)
`src/lib/mobile/local-drafts.ts`:
- `esClaveBorrador` / `clavesABorrar` — funciones **puras** que reconocen SOLO las claves `nx.consulta.bkp.*` (nunca preferencias como el tema).
- `limpiarBorradoresLocales()` — borra esos borradores de localStorage (segura en SSR, no lanza).
- **Cableado antes de CADA `signOut`**: `Sidebar` (manual), `AutoLogout` (inactividad) y el botón del `layout`.

**Archivos:** `local-drafts.ts` + `local-drafts.test.ts` (nuevos); `Sidebar.tsx`, `AutoLogout.tsx`, `layout.tsx` (cada uno llama a la limpieza antes de cerrar sesión). Deps/migraciones: 0.

## Pruebas
- `tsc --noEmit` → 0.
- `vitest run` → **383/383** (4 nuevos; sin regresión). Los tests fijan que **solo** se borran claves `nx.consulta.bkp.*` y **nunca** preferencias/otras.
- `next build` → OK.
- **Seguridad de la recuperación:** el cambio **no toca** ninguno de los ~6 sitios de lectura/escritura del borrador activo → la recuperación funciona igual que antes por construcción (no se reescribió el formato).

## Riesgo cubierto vs. residual
| Parte del riesgo RES-1 | Estado |
|---|---|
| Residuo de PHI en dispositivo compartido tras cerrar sesión | ✅ **Cerrado** (limpieza en los 3 signOut) |
| PHI legible en localStorage **mientras** el borrador está activo (sesión abierta) | ⏳ **Residual** — requiere ofuscar/cifrar el round-trip, que toca la recuperación → **debe verificarse en dispositivo** antes de tocarlo. |
| Expiración de borradores viejos | ⏳ Residual — el payload actual no guarda timestamp; añadirlo toca la escritura. |

## Diferido (con razón, no fingido)
- **Ofuscar/cifrar el borrador activo**: real crypto que sobreviva a un crash necesita clave derivada del usuario (documentado); no se hace a ciegas.
- **Modelo offline completo** (§7.1–7.5): clasificar funciones permitidas/no permitidas offline, cola de sync idempotente con estados `pending/syncing/synced/failed/conflict`, manejo de conflictos entre dispositivos, y pruebas de interrupción (llamada/bloqueo/cambio de app). Todo requiere verificación en dispositivo/sesión.
- **Estado de sincronización visible** (§7.6): diferenciar sin conexión / guardado local / sincronizando / sincronizado / error / conflicto (enlaza con `checklistCierre` de la Iter. 4).

## Quality Gate
```
QUALITY GATE: PARTIAL — cerrado el vector de residuo de PHI al cerrar sesión (los 3
signOut limpian el borrador clínico local), sin tocar la recuperación (riesgo cero
de pérdida), con funciones puras testeadas. tsc 0, 383/383, build OK. La ofuscación
del borrador activo y el modelo offline completo se difieren a verificación en
dispositivo (no se reescribe el round-trip a ciegas). production_deployment_allowed:false.
```

## Nota al Dr.
El endurecimiento del borrador **activo** (que es lo que queda del P0) es donde necesito que **verifiques la recuperación en tu teléfono** tras cualquier cambio, o acceso a staging — porque romperla sería perder una nota. Prefiero dejarlo pendiente y seguro que arreglarlo a ciegas.

## Siguiente iteración recomendada (no implementada)
**Iteración 8 — DEVICE_CAPABILITIES** (cámara/escáner/micrófono/biometría/compartir con consentimiento) — mayormente de dispositivo. O, si prefieres cerrar el P0 por completo, hacer juntos la ofuscación del borrador activo **con tu verificación en el teléfono**.
