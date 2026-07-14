# Iteración 10 — AI_CREDITS · Reporte final (cierre del loop)

- **ID:** nexusmed-aicredits-010 · **Modo:** AI_CREDITS · **Entorno:** staging / rama de features (`feat/inmunocomprometido-valoracion`) · **Producción:** no alterada (main en v372, sin cherry-pick, sin bump de SW).
- **Estado:** **DONE** (el copy de precios ahora coincide EXACTAMENTE con el gate real de créditos; verificado contra el código del endpoint y en navegador).

## Auditoría / línea basal
Contraste del copy público de créditos contra el comportamiento real del gate (`src/app/api/expediente/procesar/route.ts`).
- **Matemática de notas:** correcta (160÷3≈50 Estándar; 450÷10=45 Máxima). ✓
- **Recarga:** el precio real (100 créditos / $399) ya se mostraba. ✓
- **Hueco crítico:** el copy prometía **"nunca te quedas sin IA"** / "sigue en ⚡ Rápida gratis" (en 3 lugares) **omitiendo** que el modo gratis está **acotado**: tras agotar créditos, ⚡ Rápida es gratis solo hasta `TOPE_ECONOMICO` (120 notas/mes en Clínica, 300 en Pro); superado el tope, el endpoint devuelve **HTTP 402** ("Se acabó tu IA del mes… compra más o sube de plan") y **pausa** la IA. El copy contradecía el gate → posible sorpresa para el médico.

## Diseño
Hacer que el copy diga LO QUE EL GATE HACE, con los números tomados de la fuente de verdad (`TOPE_ECONOMICO`), no números mágicos. Eliminar el absoluto "nunca te quedas sin IA".

## Implementación
| Pieza | Antes → Después |
|---|---|
| Bullet Clínica (`planes-ia.ts`) | "Al agotarlos NO se detiene: sigue en ⚡ Rápida gratis o compra más" → "…sigue en ⚡ Rápida sin costo **hasta 120 notas más/mes; luego se pausa** y recargas o subes de plan" |
| Bullet Pro | "…sigue en ⚡ Rápida gratis — **nunca te quedas sin IA**" → "…**hasta 300 notas más/mes; luego se pausa** y recargas o subes de plan" |
| Bullet Hospital | "…**nunca se detiene**" → "…**hasta 300 notas más/mes; luego se pausa**…" |
| Precios · caja de recarga | "…o sigue con ⚡ Rápida sin costo. **Nunca te quedas sin IA.**" → "…hasta un tope mensual (**{TOPE_ECONOMICO.pro} notas** en Clínica, **{TOPE_ECONOMICO.premium}** en Pro). Pasado ese punto la IA **se pausa** y recargas o subes de plan." |
| Precios · nota al pie | "…sigues con ⚡ Rápida sin costo o recargas." → "…hasta un tope mensual; pasado ese punto la IA **se pausa**… **Nunca hay cobros de sorpresa.**" |

Los números de la página de precios se leen de `TOPE_ECONOMICO` (import), así el copy no puede desincronizarse del gate.

**Archivos nuevos:** `src/__tests__/creditos-transparencia.test.ts`, este reporte.
**Modificados:** `src/lib/planes-ia.ts` (3 bullets), `src/app/precios/page.tsx` (import + 2 textos).
**Migraciones/deps nuevas:** 0.

## Coincidencia copy ↔ gate (verificada en el código)
`procesar/route.ts`: al agotar créditos → `modoEconomico = true` (⚡ Rápida gratis); si `economicasDelMes >= topeEconomicoDe(nivel)` → **HTTP 402** "Se acabó tu IA del mes… compra más o sube de plan". El copy nuevo describe exactamente esto.

## Pruebas
- `tsc --noEmit` → exit 0.
- `vitest run` → **422/422** (416 previos + 6 nuevos; sin regresión).
- `next build` → OK.
- Nuevo test `creditos-transparencia.test.ts`: la matemática de notas, que los bullets declaran el `TOPE_ECONOMICO` real y "se pausa", que **ningún** plan promete IA ilimitada gratis, que la página de precios usa las constantes (no números mágicos) y no contiene "nunca te quedas sin IA", y la lógica de `estadoCreditos`.
- **Verificación E2E en navegador (localhost:3001/precios):** DOM confirma "120 notas", "300", "se pausa", recarga "$399", el bullet "hasta 120 notas más/mes", y ausencia de "nunca te quedas sin IA".

## Resultados (antes/después)
| | Antes | Después |
|---|---|---|
| Modo gratis descrito | "ilimitado / nunca sin IA" | acotado a 120/300 notas, luego se pausa |
| Coincidencia con el gate (HTTP 402) | contradictoria | exacta |
| Números | prosa | leídos de `TOPE_ECONOMICO` (sin desincronizar) |
| Recarga y tope visibles | recarga sí, tope no | ambos |
| Producción alterada | — | **No** |

## Quality Gate
```
QUALITY GATE: PASS — el copy de créditos coincide exactamente con el gate real
(modo económico acotado + pausa HTTP 402); sin "nunca te quedas sin IA"; números
leídos de TOPE_ECONOMICO; test que fija la coincidencia copy↔gate; tsc 0, 422/422
tests, build OK, E2E en navegador. Producción NO alterada. production_deployment_allowed:false.
```

## Rollback
Commits en la rama de features; `git revert`. Producción intacta.

---

## Cierre del PRODUCT MATURITY LOOP (iteraciones 1–10)
| # | Modo | Entrega principal |
|---|---|---|
| 1 | SECURITY_HARDENING | `security-controls.ts` con estados verificables + /seguridad honesta |
| 2 | PRIVACY_AND_LEGAL | Inventario de datos + arquitectura documental (RFC/domicilio privados) |
| 3 | PATIENT_MAGIC_LINK | Protección técnica del token (noindex/no-referrer) + diseño revocable |
| 4 | PRESCRIPTION_QR | QR con firma HMAC + página pública /verificar (sin PHI) |
| 5 | INTERACTIVE_DEMO | Sandbox navegable /demo/interactivo (sin red/IA/PHI) |
| 6 | CLINICAL_AI_DEMO | /demo/clinico: motor determinista real, "indeterminado" si faltan datos |
| 7 | PRODUCT_VISUALS | Hero shot fiel del producto (ProductWindow, datos ficticios) |
| 8 | PUBLIC_METRICS | /evidencia con PMID+DOI verificables; "no inflamos cifras" |
| 9 | COPY_AND_CLAIMS | 3 claims corregidos (PITR, adopción, NOM-004) + guardián |
| 10 | AI_CREDITS | Copy de créditos alineado al gate real + tope explícito |

**Todo en la rama `feat/inmunocomprometido-valoracion`; producción (main) intacta en v372.** `production_deployment_allowed: false` respetado en las 10 iteraciones. Suite total: **422 tests**. Ninguna afirmación inventada; toda cifra pública es verificable o una oferta real.
