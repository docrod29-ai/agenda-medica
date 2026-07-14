# Iteración 7 — PRODUCT_VISUALS · Reporte final

- **ID:** nexusmed-productvisuals-007 · **Modo:** PRODUCT_VISUALS · **Entorno:** staging / rama de features (`feat/inmunocomprometido-valoracion`) · **Producción:** no alterada (main en v372, sin cherry-pick, sin bump de SW).
- **Estado:** **DONE** (hero shot fiel del producto en la landing, construido con el design system real y datos ficticios; verificado en navegador desktop + móvil).

## Auditoría / línea basal
La landing (v329) tenía:
- Fotos de marca atmosféricas (`/brand/hero.jpg`, `workspace.jpg`, `network.jpg`) — evocadoras, **no** muestran la UI real.
- Un mockup de WhatsApp (div) y la OG de texto.
- **Ningún "hero shot" de la interfaz real del producto.** Un prospecto no ve cómo se ve la app antes de registrarse — justo el hueco de PRODUCT_VISUALS.

Riesgo a evitar: capturas falsas o retocadas, o fotos de stock haciéndose pasar por producto.

## Diseño
Un mockup **fiel y honesto**: no es captura (ni real ni falsa), se construye con los **mismos tokens** del design system (colores, superficies, tipografía, iconos lucide) y **datos ficticios** (pacientes por iniciales, reutilizados del sandbox para coherencia). Marco de ventana de app (semáforo + barra `app.nexusmed · Agenda`), sidebar de navegación real (Agenda·Pacientes·Consulta·Recetas·Finanzas) y contenido: agenda del día + tarjeta "Nota por voz · Lista para firmar". Leyenda visible: "Interfaz de ejemplo · datos ficticios".

## Implementación
| Pieza | Resultado |
|---|---|
| Componente de mockup | ✅ `src/components/ProductWindow.tsx` — **puro** (sin hooks, sin red) → sirve en server/client y se renderiza a HTML en pruebas. `role="img"` + `aria-label` honesto. Reutiliza `DEMO_ESCENARIOS`. |
| Colocación en landing | ✅ Hero shot bajo los CTAs del hero (`src/app/page.tsx`), ancho ≤860, con leyenda "Interfaz de ejemplo · datos ficticios". |
| Responsive | ✅ `globals.css`: en ≤640px colapsa el sidebar y pasa a una columna (sin overflow horizontal). |
| Honestidad | ✅ Datos ficticios por iniciales; no capturas; etiquetado explícito; coherente con la identidad técnica (Linear-like). |
| Tests | ✅ `src/__tests__/product-window.test.ts` (3 casos, vía `renderToStaticMarkup`): renderiza sin lanzar, muestra la navegación real, usa iniciales ficticias y contiene la etiqueta "ficticios". |

**Archivos nuevos:** `src/components/ProductWindow.tsx`, `src/__tests__/product-window.test.ts`, este reporte.
**Modificados:** `src/app/page.tsx` (import + hero shot), `src/app/globals.css` (responsive del mockup).
**Migraciones/deps nuevas:** 0.

## Pruebas
- `tsc --noEmit` → exit 0.
- `vitest run` → **408/408** (405 previos + 3 nuevos; sin regresión).
- `next build` → OK; landing `/` estática.
- **Verificación E2E en navegador (localhost:3001):**
  - Desktop: el hero shot aparece bajo los CTAs — marco de app, sidebar (Agenda activa), 3 citas ficticias (M. F., J. R., A. R.), tarjeta "Nota por voz · Lista para firmar", leyenda "datos ficticios" (captura tomada).
  - Móvil (375×812): el sidebar colapsa, agenda + nota en una columna, sin scroll horizontal, leyenda visible (captura tomada).

## Resultados (antes/después)
| | Antes | Después |
|---|---|---|
| Hero shot de la UI real | ✗ (solo fotos atmosféricas) | ✅ mockup fiel con tokens reales |
| Honestidad del visual | fotos evocadoras | UI real + datos ficticios etiquetados |
| Datos mostrados | — | ficticios (iniciales), no reales |
| Responsive | — | colapsa sidebar en móvil, sin overflow |
| Accesibilidad | — | `role="img"` + `aria-label` descriptivo |
| Producción alterada | — | **No** |

## Riesgos residuales
- La OG (`opengraph-image.tsx`) sigue siendo una tarjeta de texto de marca; incorporar un recorte del frame de producto es un incremento posible (Satori/`next/og` tiene CSS limitado) — no se hizo para no arriesgar el render de la OG.
- Único error de consola: el hydration-mismatch global en `data-theme` (script de tema de toda la app, dev-only) — no proviene de este cambio.

## Quality Gate
```
QUALITY GATE: PASS — hero shot fiel construido con el design system real y datos
ficticios etiquetados (no capturas, no stock); accesible; responsive sin overflow;
componente puro con test de render; tsc 0, 408/408 tests, build OK, E2E desktop +
móvil. Producción NO alterada. production_deployment_allowed:false.
```

## Rollback
Commits en la rama de features; `git revert`. Producción intacta. Cambio aditivo (componente nuevo + un bloque en el hero + regla CSS responsive).

## Siguiente iteración recomendada (no implementada)
`ITERACIÓN 8 — PUBLIC_METRICS` (métricas/pruebas sociales en público SOLO si son reales y verificables; nunca inventar cifras. Si aún no hay datos reales, redacción honesta de "en fase temprana" y citas a estudios publicados con su matización, como ya hace la sección Stats).
