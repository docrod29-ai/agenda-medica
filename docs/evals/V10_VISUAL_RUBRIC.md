# Rúbrica visual V10

> Nace de la spec V10 §34–§35. Toda puntuación exige **captura de pantalla** y
> justificación; puntuar desde el código está prohibido. Los resultados viven en
> `agent-state/V10_VISUAL_SCORECARD.json`.

## Puntuación visual (0–10 por dimensión, promedio simple)

| Dimensión | Qué se pregunta |
|---|---|
| jerarquía | ¿Se entiende en ~2 s qué manda en la pantalla? ¿Un primario por región? |
| claridad | ¿El siguiente paso seguro es obvio sin entrenamiento? |
| coherencia | ¿Parece de la misma familia que el resto de NexusMED? |
| tipografía | ¿Escala semántica, pesos limitados, texto clínico legible? |
| espaciado | ¿El espacio establece jerarquía antes que los bordes? |
| densidad | ¿Densa donde lo clínico lo pide, sin volcado de información? |
| interacción | ¿Estados visibles, foco, teclado, respuesta inmediata? |
| adaptabilidad | ¿Móvil diseñado, no escritorio encogido? |
| accesibilidad | ¿Contraste, etiquetas, foco visible, objetivos táctiles? |
| rendimiento percibido | ¿Carga sin saltos, esqueletos que conservan el contexto? |
| confianza clínica | ¿Estados firmado/borrador inequívocos, procedencia inspeccionable? |
| originalidad de marca | ¿Se reconoce como NexusMED o como plantilla? |

**Meta**: pantallas críticas de Practice promedio ≥ 9.3, ninguna < 9.0.

## GENERIC_AI_LOOK_SCORE (0–10, menor es mejor)

Probabilidad de que la pantalla parezca generada por IA genérica: rejillas de
tarjetas sin motivo, degradados decorativos, radios excesivos, círculos de
icono, chispas de IA, insignias aleatorias, jerarquía débil, cara de librería
de componentes, estadísticas de tablero genéricas, microcopy inconsistente,
sombras innecesarias, ausencia de interacción distintiva.

**Meta**: ≤ 1.0 en pantallas críticas.

Los recuentos objetivos que alimentan esta nota viven en
`docs/design/GENERIC_AI_AESTHETIC_AUDIT.md` y en el trinquete de diseño
(`scripts/design/trinquete-de-diseno.mjs`).
