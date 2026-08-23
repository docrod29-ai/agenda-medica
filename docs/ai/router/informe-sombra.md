# Informe de sombra — router de costo/calidad (#313)

Generado: 2026-08-23T12:00:00.000Z. **Sin llamadas a proveedores.** Todos los casos son sintéticos.

## VEREDICTO: la propuesta no viola el piso de calidad ni pierde candidatos.

## Medidas

| Métrica | Actual | Propuesta |
|---|---|---|
| Casos | 100 | 100 |
| **Violaciones del piso** | 0 | 0 |
| Costo estimado (USD) | 0 | 3.85 |
| Costo por caso (USD) | — | 0.0385 |
| Casos sin tarifa | 0 | 0 |
| Tasa sin candidato | 1 | 0 |
| Tasa de segunda revisión | 0 | 0 |
| 2ª revisión pedida SIN candidato independiente | 0 | 5 |
| Con respaldo disponible | 0 | 0 |
| Latencia interactiva | 0 | 25 |
| Latencia normal | 0 | 75 |
| Latencia diferida | 0 | 0 |
| Δ costo (USD) | — | 3.85 |

## Modelos elegidos

| Configuración | Modelo | Veces |
|---|---|---|
| propuesta | openai/gpt-5 | 50 |
| propuesta | anthropic/claude-haiku-4-5 | 25 |
| propuesta | anthropic/claude-sonnet-5 | 25 |

## Por qué no hubo candidato

| Configuración | Código | Veces |
|---|---|---|
| actual | QUALITY_NOT_PROVEN | 100 |

## Divergencias — 100 casos, 3 patrones

| Actual | Propuesta | Casos | Ejemplos |
|---|---|---|---|
| SIN_CANDIDATO:QUALITY_NOT_PROVEN | openai/gpt-5 | 50 | c001-extraccion, c001-revision, c002-extraccion |
| SIN_CANDIDATO:QUALITY_NOT_PROVEN | anthropic/claude-haiku-4-5 | 25 | c001-limpieza, c002-limpieza, c003-limpieza |
| SIN_CANDIDATO:QUALITY_NOT_PROVEN | anthropic/claude-sonnet-5 | 25 | c001-nota, c002-nota, c003-nota |

---

Las cifras de costo son ESTIMACIONES del catálogo sobre tarifas con fuente y fecha (`precios-modelo.ts`). No son facturación: el costo real lo escribe el libro de costos al volver de cada llamada.
