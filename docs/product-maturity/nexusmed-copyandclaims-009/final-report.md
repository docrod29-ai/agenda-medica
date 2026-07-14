# Iteración 9 — COPY_AND_CLAIMS · Reporte final

- **ID:** nexusmed-copyandclaims-009 · **Modo:** COPY_AND_CLAIMS · **Entorno:** staging / rama de features (`feat/inmunocomprometido-valoracion`) · **Producción:** no alterada (main en v372, sin cherry-pick, sin bump de SW).
- **Estado:** **DONE** (3 afirmaciones corregidas para ser ciertas/matizadas; guardián de regresión añadido; verificado en navegador).

## Auditoría / línea basal
Barrido de todo el copy público (landing, precios, demo, seguridad, planes) buscando afirmaciones engañosas: cumplimiento como certificación, seguridad absoluta, adopción implícita, nombres de competidores, promesas de IA. Hallazgos:

| # | Afirmación | Problema | Fuente de verdad |
|---|---|---|---|
| 1 | FAQ "¿Mis datos están seguros?" → "…y respaldos con **recuperación a un punto en el tiempo**." | Presenta PITR como entregado. | `security-controls.ts`: `backups-pitr` = **`in-progress`**, restore drill BLOCKED. |
| 2 | FinalCTA: "Únete a **médicos que ya automatizaron** su consultorio." | Implica adopción existente; el producto es nuevo. | Iteración 8: "no inflamos cifras ni testimonios". |
| 3 | Plan Clínica: "Nota clínica con IA (voz → nota, **NOM-004**)" | "NOM-004" a secas puede leerse como certificación. | NOM-004 = alineación, no certificación. |

Lo demás resultó **limpio**: sin competidores nombrados, sin "el mejor/líder/único", sin absolutos de seguridad. El demo ya decía "alineada a los requisitos aplicables de la NOM-004" (correcto).

## Implementación
| Fix | Antes → Después |
|---|---|
| 1 · Respaldos honestos | "…y respaldos con recuperación a un punto en el tiempo." → "…aislamiento por consultorio (todo verificado). **Estamos activando** respaldos con recuperación a un punto en el tiempo; **no lo declaramos como listo hasta probar una restauración**. …el estado de cada control… en /seguridad." |
| 2 · Sin adopción implícita | "Únete a médicos que ya automatizaron su consultorio." → "**Reúne agenda, expediente, recetas y cobros en una sola herramienta.**" |
| 3 · NOM-004 como alineación | "(voz → nota, NOM-004)" → "(voz → nota, **orientada a los requisitos de la NOM-004**)" |

**Archivos nuevos:** `src/__tests__/claims-guard.test.ts`, este reporte.
**Modificados:** `src/app/page.tsx` (FAQ + FinalCTA), `src/lib/planes-ia.ts` (feature NOM-004).
**Migraciones/deps nuevas:** 0.

## Guardián de regresión (test)
`claims-guard.test.ts` escanea el copy **visible** (excluye comentarios de código) de landing/planes/demo/precios y falla si reaparece:
- un competidor por nombre (doctoralia, nimbo, huli, medesk, saludtools, agendapro),
- adopción implícita ("médicos que ya…", "únete a miles/cientos…"),
- NOM-004 como certificación ("cumple/certificado … NOM-004"),
- PITR declarado listo (la frase antigua exacta),
- absolutos de seguridad ("100% seguro", "totalmente seguro", "infalible", "inviolable").

## Pruebas
- `tsc --noEmit` → exit 0.
- `vitest run` → **416/416** (411 previos + 5 nuevos del guardián; sin regresión).
- `next build` → OK.
- **Verificación E2E en navegador (localhost:3001):**
  - FinalCTA: muestra "Reúne agenda, expediente…"; la frase de adopción desapareció (verificado en el DOM).
  - FAQ de seguridad (abierta): muestra "(todo verificado)", "Estamos activando respaldos" y "no lo declaramos como listo hasta probar una restauración"; la frase que declaraba PITR listo desapareció.

## Resultados (antes/después)
| | Antes | Después |
|---|---|---|
| PITR en la FAQ | declarado listo | "en activación", coherente con /seguridad |
| CTA final | implica adopción | describe el valor, sin implicar usuarios |
| NOM-004 en planes | ambiguo (¿certificación?) | "orientada a los requisitos" |
| Competidores / absolutos | ninguno | ninguno (con guardián que lo fija) |
| Producción alterada | — | **No** |

## Riesgos residuales
- El guardián cubre patrones conocidos; copy nuevo con una redacción engañosa distinta no lo detectaría automáticamente — el barrido humano sigue siendo necesario en cambios grandes de copy.
- Único error de consola: hydration-mismatch global de `data-theme` (dev-only), ajeno a este cambio.

## Quality Gate
```
QUALITY GATE: PASS — 3 afirmaciones corregidas para ser ciertas y matizadas
(respaldos/PITR alineados con el estado real, sin adopción implícita, NOM-004 como
alineación no certificación); sin competidores ni absolutos; guardián de regresión
que fija los patrones prohibidos; tsc 0, 416/416 tests, build OK, E2E en navegador.
Producción NO alterada. production_deployment_allowed:false.
```

## Rollback
Commits en la rama de features; `git revert`. Producción intacta. Cambios de copy + un test; sin efectos de comportamiento.

## Siguiente iteración recomendada (no implementada)
`ITERACIÓN 10 — AI_CREDITS` (última: transparencia total del sistema de créditos de IA — qué cuesta cada nivel, qué pasa al agotarlos, sin sorpresas de cobro; que el copy de precios coincida exactamente con el comportamiento real del gate de créditos).
