# Iteración 5 — TOUCH_AND_INPUT · Reporte

- **Iteration ID:** nexusmed-mobile-005 · **Modo:** TOUCH_AND_INPUT · **Entorno:** staging / rama `feat/mobile-excellence` · **Producción:** no alterada · `production_deployment_allowed: false`.
- **Estado:** **PARTIAL — P0 de entrada (diálogos nativos) cerrado y verificado; el resto de 5.x documentado como pendiente de dispositivo.**

## Entregado (verificable sin sesión)
**P0 [TCH-1] — 10 `alert()` nativos → toast in-app.** Los avisos nativos (`alert`) se **ignoran en silencio en apps instaladas / algunos WebViews** (misma causa raíz que el `window.confirm` ya corregido y en despliegue): el usuario no ve el mensaje. Migrados a `toast()` del `ToastContext`.

| Archivo | Alertas migradas |
|---|---|
| `orden/[…]` · `receta/[…]` · `nota/[…]` · `referencia/[…]` | error de PDF → `toast(…, 'error')` (se añadió `useToast` a los 4) |
| `nota/[…]` | error de adenda → `toast(…, 'error')` |
| `expediente/[…]` | "no se pudo abrir la nota" / "sin ID" → `toast(…, 'error')` |
| `consulta/[…]` (×2) | "no se encontró audio" → `toast(…, 'info')` |
| `farmacia` (ModalItem) | "nombre requerido" → `toast(…, 'error')` (se añadió `useToast`) |

**Resultado:** **0 `alert()` nativos** en todo el dashboard/componentes.

**Guard de regresión:** `src/__tests__/native-dialogs-guard.test.ts` recorre `src/app/(dashboard)` y `src/components` y **falla si reaparece** `window.confirm(` o `alert(` nativo. Cierra de raíz esta clase de bug (confirm + alert).

**Archivos:** 6 modificados (`orden`, `receta`, `nota`, `referencia`, `expediente`, `consulta`, `farmacia`) + `native-dialogs-guard.test.ts` (nuevo). Deps/migraciones: 0.

## Pruebas
- `tsc --noEmit` → 0.
- `vitest run` → **379/379** (2 nuevos del guard; sin regresión).
- `next build` → OK.
- Verificación: build (compila con los 6 archivos migrados) + guard test (0 diálogos nativos). El render en dispositivo real del dashboard sigue sin poder probarse aquí; el cambio es 1:1 y del mismo patrón ya aceptado (confirm) que está en despliegue a producción.

## Pendiente de esta iteración (documentado, no fingido — requiere dispositivo)
- **5.1 Objetivos táctiles:** auditar iconos pequeños sin padding, botones pegados (medición en dispositivo).
- **5.2 Formularios clínicos:** teclado numérico/decimal por campo, autocompletado, unidades visibles, secciones colapsables (revisión por-pantalla).
- **5.3 Teclado móvil:** que el campo activo quede visible y el botón guardar no se tape (solo verificable en teléfono).
- **5.4 Dictado:** estados claros (escuchando/procesando/estructurando/listo) — parcialmente existen; auditar en dispositivo.
- **5.5 Selector de medicamentos:** prevención mg/mL, duplicados, dosis incompleta (revisión clínica en dispositivo).
- **5.6 Gestos:** que todo swipe tenga botón visible equivalente.

## Quality Gate
```
QUALITY GATE: PARTIAL — P0 de entrada cerrado: 0 diálogos nativos (alert+confirm),
todo por toast/confirm in-app, con guard de regresión. tsc 0, 379/379, build OK.
El resto de 5.x (targets táctiles, teclado, dictado, medicamentos) requiere
verificación en dispositivo y queda documentado. production_deployment_allowed:false.
```

## Nota de despliegue
Este P0 (alert→toast) es del mismo tipo que el fix de `window.confirm` que ya está en `main`/producción. Cuando quieras, puedo cherry-pickearlo a producción junto con lo que decidas (no lo hago sin tu visto bueno).

## Siguiente iteración recomendada (no implementada)
**Iteración 6 — MOBILE_PERFORMANCE** (medir LCP/INP/CLS con Lighthouse sobre producción y reducir el JS inicial ~5.3 MB / chunk 920 KB). Es medible de forma objetiva y no requiere sesión. Alternativa: el **P0 de PHI en `localStorage`** (crítico), que conviene hacer con cuidado para no romper la recuperación de borradores.
