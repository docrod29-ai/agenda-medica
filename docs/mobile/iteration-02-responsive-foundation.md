# Iteración 2 — RESPONSIVE_FOUNDATION · Reporte

- **Iteration ID:** nexusmed-mobile-002 · **Modo:** RESPONSIVE_FOUNDATION · **Entorno:** staging / rama `feat/mobile-excellence` · **Producción:** no alterada · `production_deployment_allowed: false`.
- **Estado:** **PASS** (foundation entregada y verificada; aplicación por-pantalla de tablas/calendario queda para iteraciones siguientes, documentado con honestidad).

## Alcance y decisión de diseño
Iteración de **cimientos**: primitivos reutilizables + sistema de breakpoints, **no** rediseño pantalla por pantalla (eso es Iter. 3–4). Regla de oro cumplida: **todos los overrides móviles viven dentro de `max-width`** → el escritorio queda intacto por construcción. No se pudo probar el dashboard autenticado en tiempo de ejecución (sin sesión); esos puntos se marcan como pendientes de verificación en dispositivo, sin inventar resultados.

## Cambios
| Cambio | Archivo | Efecto |
|---|---|---|
| **`100vh` → `100dvh`** (con fallback) en el shell de la app y `max-height` del modal | `globals.css` | Corrige el salto de altura por la barra del navegador móvil. Verificado: el `min-height` resuelve a la altura real del viewport. |
| **Sistema de breakpoints documentado** (Compact ≤640 · Medium 641–1024 · Expanded ≥1025) | `globals.css` | Referencia canónica para no usar anchos arbitrarios en iteraciones futuras. |
| **`.nx-stat-grid`** utilidad (3 col en escritorio → 2 → 1 en móvil) | `globals.css` | Lista para colapsar los grids `repeat(3,1fr)` (finanzas/corte-caja/farmacia/config) sin tocar el escritorio. **No cableada aún** (se hará donde se pueda verificar). |
| **`.table-wrap.rwd`** modo tarjeta móvil (celdas "Encabezado: valor" vía `data-label`) | `globals.css` | Tablas legibles en teléfono, solo ≤640px. |
| **`ui/Table` responsive** (`data-label` + clase `rwd`, prop `mobileCards` default true) | `components/ui/Table.tsx` | La tabla compartida se vuelve tarjetas en móvil automáticamente cuando se use. |
| **Modal** `max-height: 90dvh` en Compact | `globals.css` | El modal ya era bottom-sheet en móvil (líneas 720-721); solo se afinó la altura. |

**Nuevos:** `src/__tests__/table-responsive.test.ts`. **Migraciones/deps:** 0.

## Hallazgo honesto
- La **`ui/Table` compartida no se usa hoy en ninguna pantalla** (las tablas reales son `<table>` crudas en `nota` y `hospitalizacion`). Por eso la mejora de `ui/Table` queda **lista para uso**, pero su valor actual es cero; el arreglo de las tablas crudas es trabajo por-pantalla (LAY-4) para Iter. 3–4, donde pueda verificarse en dispositivo/sesión.
- El **Modal ya era bottom-sheet** en móvil → menos trabajo del previsto.

## Pruebas
- `tsc --noEmit` → 0.
- `vitest run` → **364/364** (3 nuevos de `table-responsive`; sin regresión).
- `next build` → OK.
- **Navegador (móvil 375):** `scrollWidth == innerWidth` → **sin overflow horizontal**; `min-height` del body = altura del viewport (dvh aplicado); `CSS.supports('height','100dvh')` = true. Escritorio sin cambios (dvh ≡ vh sin barra dinámica).

## Quality Gate
```
QUALITY GATE: PASS — sin overflow horizontal (verificado), dvh aplicado, breakpoints
documentados, primitivos de tabla/grid responsive listos y con test, modal usable
(bottom-sheet), escritorio sin regresión por construcción (overrides solo bajo
max-width). Aplicación por-pantalla (tablas crudas, calendario, grids) diferida a
iteraciones con verificación en dispositivo. production_deployment_allowed:false.
```

## Riesgos residuales
- Verificación en **dispositivo real** del dashboard (teclado, notch, tablas crudas) sigue pendiente — es intrínseco a no tener sesión aquí; se cubre con el Dr. probando en su teléfono o con acceso de staging.

## Siguiente iteración recomendada (no implementada)
**Iteración 3 — MOBILE_NAVIGATION** (acción principal contextual en BottomNav, arreglar etiqueta "Consulta"→/pacientes, preservación de contexto al volver, búsqueda global). Alternativa: adelantar el P0 de PHI en `localStorage` del borrador (riesgo crítico confirmado).
