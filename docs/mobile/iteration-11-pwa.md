# Iteración 11 — PWA_AND_INSTALLATION · Reporte

- **Iteration ID:** nexusmed-mobile-011 · **Modo:** PWA_AND_INSTALLATION · **Entorno:** staging / rama `feat/mobile-excellence` · **Producción:** no alterada · `production_deployment_allowed: false`.
- **Estado:** **PASS (verificable) — manifest con shortcuts + SW endurecido contra caché clínica; actualización sin perder borrador documentada.**

## Auditoría (positivos + huecos)
- **§11.2 SW ya era seguro:** Firestore y externos pasan directo (`url.origin !== self.location.origin`), `/api/*` y `/__/auth/*` no se interceptan → **los datos clínicos NO se cachean**. Navegación network-first, estáticos stale-while-revalidate, y `activate` **borra las cachés viejas** (versionado + limpieza). ✅
- **Hueco 1 (§11.5):** el manifest **no tenía shortcuts**.
- **Hueco 2 (§11.2):** las navegaciones a rutas **clínicas** SÍ se cacheaban como HTML. Hoy ese HTML es un *shell* (los datos cargan luego desde Firestore), pero por defensa en profundidad conviene no cachearlo.

## Cambios
| Cambio | Efecto |
|---|---|
| **`shortcuts` en `manifest.ts`** (§11.5) | Mantén pulsado el ícono → "Agenda de hoy" (`/calendario`), "Nueva cita" (`/asistente`), "Pacientes" (`/pacientes`). Todas bajo el layout autenticado → validan sesión; no exponen datos por sí mismas. |
| **SW: no cachear HTML de rutas clínicas** | `esRutaClinica` (expediente/consulta/nota/receta/orden/referencia/hospitalizacion/valoracion) → la navegación se sirve de red pero **no** se guarda en caché. Ningún dato clínico puede quedar en la caché del navegador. |
| **SW bump v374 → v375** | Refleja los cambios (iter 8-11). |

**Archivos:** `manifest.ts` (shortcuts), `public/sw.js` (exclusión clínica + versión), `pwa-manifest.test.ts` (nuevo). Deps/migraciones: 0.

## Pruebas
- `tsc --noEmit` → 0.
- `vitest run` → **392/392** (4 nuevos; sin regresión). Fijan: manifest instalable + shortcuts a rutas internas; SW excluye rutas clínicas y no intercepta api/Firestore/auth.
- `next build` → OK; `/manifest.webmanifest` generado.

## §11.3 Actualización sin destruir borradores (documentado)
El SW usa `skipWaiting()` para no dejar a nadie pegado en una versión vieja. **Riesgo de recargar durante una nota** → mitigado hoy por: autoguardado cada 30 s + respaldo local + recuperación tras recarga (la nota se restaura). **Endurecimiento futuro (con verificación en dispositivo):** posponer la recarga hasta que no haya una nota activa sin guardar, y mostrar "actualización disponible" en lugar de recargar solo. No se cambia el comportamiento de recarga a ciegas (podría afectar el flujo clínico).

## Diferido (dispositivo)
- **§11.1** screenshots del manifest (mejoran la UI de instalación) — requiere capturas reales.
- **§11.4** guía contextual de instalación iOS/Android — mejor con verificación en dispositivo.
- Verificar la instalación real y los shortcuts en iPhone/Android.

## Quality Gate
```
QUALITY GATE: PASS — instalable, shortcuts a rutas autenticadas, SW no cachea datos
clínicos (api/Firestore fuera + HTML de rutas clínicas excluido), versionado con
limpieza de cachés viejas, actualización con mitigación de pérdida de borrador
(autosave+recovery). tsc 0, 392/392, build OK. Screenshots/guía de instalación y
verificación real de instalación se difieren a dispositivo. production_deployment_allowed:false.
```

## Siguiente iteración recomendada (no implementada)
**Iteración 12 — MOBILE_VALIDATION** — es **casi toda de dispositivo/sesión** (recorrido E2E completo con MFA, offline, sincronización, en teléfono real con perfiles de prueba). Lo verificable por código (suite de tests, guards) ya se ha ido acumulando. Recomiendo cerrar el loop con una **corrida de validación en tu teléfono** guiada por `docs/mobile/workflow-baseline.md`, o desplegar lo acumulado (iter 8-11) a producción.
