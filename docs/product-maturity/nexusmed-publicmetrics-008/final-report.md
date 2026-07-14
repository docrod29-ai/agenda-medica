# Iteración 8 — PUBLIC_METRICS · Reporte final

- **ID:** nexusmed-publicmetrics-008 · **Modo:** PUBLIC_METRICS · **Entorno:** staging / rama de features (`feat/inmunocomprometido-valoracion`) · **Producción:** no alterada (main en v372, sin cherry-pick, sin bump de SW).
- **Estado:** **DONE** (la única cifra pública queda anclada a evidencia real y verificable; se declara con honestidad qué NO se afirma; verificado en navegador).

## Auditoría / línea basal
Barrido de toda métrica/prueba social pública. Hallazgo tranquilizador: **no había métricas de adopción inventadas, ni testimonios/reseñas fabricados, ni "X médicos confían"**. Las señales existentes eran honestas:
- Stats con "hasta 40% menos inasistencias con recordatorios*" — pero el asterisco remitía genéricamente a "estudios publicados" (no verificable).
- Feature de recordatorios con la misma cifra, ya matizada ("los resultados varían por consultorio").
- Oferta fundador (límite real, no una afirmación de adopción).
- Trust con postura real (cifrado GCP, hecho en México) + enlace a /seguridad.

Hueco de PUBLIC_METRICS: la cifra numérica no era **comprobable**, y no se declaraba explícitamente que no se inflan números.

## Diseño
Regla dura: en público solo cifras reales y verificables. NexusMED aún no tiene métricas propias que publicar, así que (1) se ancla la única cifra a **revisiones sistemáticas reales** con PMID+DOI (verificadas en PubMed, no inventadas), y (2) se declara con honestidad qué no se afirma (fase temprana).

## Implementación
| Pieza | Resultado |
|---|---|
| Fuentes verificadas | ✅ `src/lib/landing-evidencia.ts` — 3 revisiones sistemáticas/metaanálisis (Hasvold 2011, Robotham 2016, Stubbs 2012) con autor, revista, **PMID y DOI reales** y el hallazgo concreto. Fuente: PubMed. Módulo puro, testeable. |
| Página pública de evidencia | ✅ `src/app/evidencia/page.tsx` — lista las fuentes con enlaces a **PubMed y DOI** (comprobables), + bloque "Lo que no verás aquí" (sin usuarios/consultorios inventados, sin testimonios fabricados, sin cifras propias sin método). |
| Nota al pie honesta | ✅ Stats: de "*según estudios publicados" (genérico) a "reducción relativa ~34% en promedio (hasta ~39% con recordatorio telefónico)" + enlace "Ver fuentes →" a /evidencia. |
| Declaración anti-inflado | ✅ Trust: "NexusMED es nuevo: no inflamos cifras de usuarios ni inventamos testimonios. Lo que mostramos está respaldado por evidencia publicada o es una oferta real." + botón "Evidencia y transparencia". |
| Tests | ✅ `src/__tests__/landing-evidencia.test.ts` (3 casos): PMID numérico + DOI con prefijo `10.`, **igualdad exacta** de los PMID/DOI verificados (para que no se alteren por accidente), y helpers de URL canónicas. |

**Archivos nuevos:** `src/lib/landing-evidencia.ts`, `src/app/evidencia/page.tsx`, `src/__tests__/landing-evidencia.test.ts`, este reporte.
**Modificados:** `src/app/page.tsx` (nota al pie + declaración anti-inflado + enlace).
**Migraciones/deps nuevas:** 0.

## Honestidad de la cifra
La afirmación es "hasta 40%" (cota superior). Evidencia (PubMed): reducción relativa media **34%**, hasta **39%** con recordatorio telefónico manual (Hasvold 2011); metaanálisis **25% menos** ausencias (Robotham 2016). "hasta ~40%" redondea el 39% y la nota al pie da las cifras exactas → un lector no queda inducido a error y puede comprobarlas.

## Pruebas
- `tsc --noEmit` → exit 0.
- `vitest run` → **411/411** (408 previos + 3 nuevos; sin regresión).
- `next build` → OK; ruta `/evidencia` presente (○ estática).
- **Verificación E2E en navegador (localhost:3001):**
  - `/evidencia` lista las 3 fuentes con enlaces PubMed/DOI clicables + bloque "Lo que no verás aquí" (captura tomada).
  - Landing: la nota al pie muestra "reducción relativa ~34%… Ver fuentes →" y la declaración "no inflamos cifras" (verificado en el DOM tras recargar).

## Resultados (antes/después)
| | Antes | Después |
|---|---|---|
| Cifra pública verificable | ✗ ("estudios publicados", genérico) | ✅ 3 revisiones con PMID+DOI comprobables |
| Página de evidencia | ✗ | ✅ `/evidencia` con enlaces y método |
| Declaración de no-inflado | implícita | ✅ explícita en Trust y /evidencia |
| Métricas de adopción inventadas | ninguna (ya honesto) | ninguna (reforzado) |
| Producción alterada | — | **No** |

## Riesgos residuales
- El feature de recordatorios repite "hasta 40%" con su propio matiz; queda coherente con la nota al pie y /evidencia (no se tocó para acotar el cambio).
- Único error de consola: hydration-mismatch global de `data-theme` (script de tema, dev-only) — ajeno a este cambio.

## Quality Gate
```
QUALITY GATE: PASS — ninguna cifra inventada; la única métrica pública anclada a
revisiones sistemáticas reales con PMID+DOI verificados en PubMed; página /evidencia
comprobable; declaración explícita de que no se inflan usuarios ni se fabrican
testimonios; test que fija los PMID/DOI exactos; tsc 0, 411/411 tests, build OK,
E2E en navegador. Producción NO alterada. production_deployment_allowed:false.
```

## Rollback
Commits en la rama de features; `git revert`. Producción intacta. Cambio aditivo (módulo + página + texto honesto).

## Siguiente iteración recomendada (no implementada)
`ITERACIÓN 9 — COPY_AND_CLAIMS` (barrido de toda afirmación de la landing/producto: cada claim debe ser cierto, matizado y no inducir a error — especialmente en cumplimiento normativo, IA y seguridad; sin nombrar competidores).
