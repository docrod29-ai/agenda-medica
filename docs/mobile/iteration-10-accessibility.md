# Iteración 10 — ACCESSIBILITY · Reporte

- **Iteration ID:** nexusmed-mobile-010 · **Modo:** ACCESSIBILITY · **Entorno:** staging / rama `feat/mobile-excellence` · **Producción:** no alterada · `production_deployment_allowed: false`.
- **Estado:** **PASS (verificación + blindaje) — los cimientos ya estaban bien; se añade un guard y se documenta lo que necesita dispositivo.**

## Auditoría (mayoría positivos)
- **§10.3 Movimiento:** existe un **reset global** `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation/transition mínima } }` en `globals.css`. Cubre toda la app. ✅
- **§10.1 Texto/zoom:** el viewport **permite zoom** (`maximumScale: 5`, sin `user-scalable=no`). Quien necesita agrandar el texto puede. ✅
- **§10.4 No solo color:** `ui/Badge` **siempre** renderiza texto junto al color/punto → el estado no depende solo del color. ✅
- **Etiquetas en controles clave:** menú móvil (`aria-label="Abrir menú"`), cierre de modal (`aria-label="Cerrar"`), FAB de ayuda (aria-label), BottomNav con **texto** bajo cada ícono. ✅
- **Botones de solo-ícono sin etiqueta:** **0** encontrados con el patrón de una línea → el design system ya etiqueta. ✅
- **§10.5 Errores comprensibles:** los avisos ahora son toasts in-app con texto claro (Iter. 5); ya no hay diálogos nativos mudos. ✅

## Cambio
| Cambio | Efecto |
|---|---|
| **Guard `a11y-zoom-guard.test.ts`** | Falla si alguien reintroduce `user-scalable=no` / `userScalable:false` / `maximumScale<5`. Blinda una accesibilidad real (agrandar texto) contra regresiones. |

**Archivos:** `a11y-zoom-guard.test.ts` (nuevo). Deps/migraciones: 0.

## Pruebas
- `tsc --noEmit` → 0.
- `vitest run` → **388/388** (1 nuevo guard; sin regresión).

## Diferido (requiere dispositivo / lector de pantalla real)
- **§10.2 Lector de pantalla:** probar con **VoiceOver (iOS)** y **TalkBack (Android)** el recorrido completo: orden de lectura, etiquetas de tabs/campos/errores/resultados de IA, foco lógico. Solo se comprueba en dispositivo.
- **§10.1 Contraste y texto aumentado:** medir contraste (ratios) y verificar que con Dynamic Type / tamaño de fuente grande **no se rompe** el layout (alturas fijas). Necesita medición/dispositivo.
- **Orden de foco** con teclado externo: verificación manual.

## Quality Gate
```
QUALITY GATE: PASS — cimientos de accesibilidad verificados y buenos (reduced-motion
global, zoom permitido, estado no solo por color, controles etiquetados, errores en
texto claro), + guard que blinda el zoom contra regresiones. tsc 0, 388/388. La
verificación con VoiceOver/TalkBack, contraste y texto aumentado se difiere a
dispositivo (no se puede simular aquí). production_deployment_allowed:false.
```

## Siguiente iteración recomendada (no implementada)
**Iteración 11 — PWA_AND_INSTALLATION** (manifest completo: shortcuts/screenshots; estrategia de Service Worker segura; **actualización sin destruir borradores**). Buena parte es verificable por código (revisar `manifest.ts` y `sw.js`). La 12 (VALIDACIÓN E2E) es casi toda de dispositivo.
