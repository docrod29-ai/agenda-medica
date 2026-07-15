# Iteración 6 — MOBILE_PERFORMANCE · Reporte

- **Iteration ID:** nexusmed-mobile-006 · **Modo:** MOBILE_PERFORMANCE · **Entorno:** staging / rama `feat/mobile-excellence` · **Producción:** no alterada · `production_deployment_allowed: false`.
- **Estado:** **PASS (medición habilitada + limpieza) — con hallazgo positivo: la palanca principal ya estaba en gran parte hecha.**

## Hallazgos de la auditoría de rendimiento
- **Las librerías pesadas YA se cargan diferidas (`await import`)**, no en el bundle inicial: `pdfjs-dist`, `html2pdf.js` y `qrcode`. En el chunk mayor (920 KB) esas libs aparecen solo como *stubs* de carga bajo demanda, no como código completo → el code-splitting funciona. Es un buen punto de partida (la regla §6.2 "no cargar editor/PDF/gráficas al abrir la agenda" se cumple en gran medida).
- **`recharts` estaba en `package.json` pero con 0 usos** (las gráficas de la app son SVG propio). Dependencia abandonada (§5.5).
- **No había forma de medir el bundle** (sin analyzer) ni métricas de campo (LCP/INP/CLS) desde este entorno (no puedo correr Lighthouse aquí).

## Cambios
| Cambio | Efecto |
|---|---|
| **Quitar `recharts`** (dep muerta, 0 usos verificados) | Cumple §5.5 (sin dependencias abandonadas); reduce install/superficie. No cambia el bundle (ya estaba tree-shaken). |
| **`@next/bundle-analyzer`** (devDep) envuelto en `next.config` **gated por `ANALYZE`** | Habilita medición real: `ANALYZE=true npm run build` abre el reporte. Passthrough cuando la variable no está → **el build de producción no cambia** (verificado). |

**Archivos:** `next.config.ts` (wrapper analyzer), `package.json`/lock (−recharts, +analyzer). Código de la app: 0 cambios.

## Pruebas
- `tsc --noEmit` → 0.
- `next build` (sin `ANALYZE`) → OK, idéntico (analyzer inactivo).
- `vitest run` → **379/379** (sin regresión).

## Cómo medir de verdad (método honesto — pendiente de ejecutar)
No puedo correr Lighthouse ni ver el HTML del analyzer desde aquí. Para cerrar la medición de campo:
1. **Bundle:** `ANALYZE=true npm run build` → abre el treemap; identificar el mayor contribuyente del chunk inicial (probable: framework + Firebase + app).
2. **Campo (LCP/INP/CLS/TBT):** Lighthouse móvil sobre **producción** (`agenda-medica-one.vercel.app`) con throttling "Slow 4G" + CPU 4×, por ruta clave (`/`, `/dashboard`, `/calendario`, `/consulta/…`). Registrar en `device-matrix.md`.
3. Con esos datos, atacar el mayor contribuyente (candidatos: diferir providers del shell que no se usan al abrir agenda, dividir el vendor chunk).

## Objetivos del programa (§6.1) — a comparar cuando se midan
`local_feedback ≤100ms · INP p75 ≤200ms · agenda cacheada p95 ≤500ms · resumen paciente p95 ≤800ms · editor interactivo p95 ≤1000ms · autosave local ≤100ms · autosave servidor p95 ≤700ms · primer resultado IA p95 ≤2000ms`.

## Quality Gate
```
QUALITY GATE: PASS (con honestidad) — code-splitting de libs pesadas ya presente
(verificado); dep abandonada eliminada (§5.5); analyzer habilitado para medición
real sin afectar producción; tsc 0, 379/379, build OK. Métricas de campo
(LCP/INP/CLS) quedan pendientes de Lighthouse sobre producción — no se inventan.
production_deployment_allowed:false.
```

## Siguiente iteración recomendada (no implementada)
**Iteración 7 — OFFLINE_AND_RESILIENCE**, que incluye el **P0 crítico de PHI en `localStorage`** del borrador. Es lo de mayor severidad del registro de riesgos; conviene hacerlo con cuidado para **no romper la recuperación de borradores** (probar recovery antes de dar por bueno).
