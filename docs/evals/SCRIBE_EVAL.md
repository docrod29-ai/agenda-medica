# Scribe-Eval (V14 §26)

**Estado: NO corrido** (`evals/scribe/` no existe; V14-SCRIBE-BRONZE-001).

| Métrica | Gate |
|---|---|
| tasa de alucinación | 0 tolerada en el benchmark con gate |
| recall de hechos críticos | ≥ 98% |
| recall de hechos total | ≥ 92% |
| exactitud de atribución | ≥ 98% |
| fidelidad de estructura | 100% campos requeridos |
| aserciones sin sustento | 0 consecuentes |
| omisiones críticas | 0 sobre hechos críticos predefinidos |
| contradicciones | 0 consecuentes |
| carga de edición | tendencia a la baja |

Cada caso contiene: verdad de terreno · hechos críticos · hechos ausentes ·
hechos no-mencionados · meds/dosis/vías/frecuencias/duraciones · órdenes ·
compromisos de seguimiento · incertidumbre · hablantes/fuentes · anclas
temporales · **trampas de alucinación**.

Regla de calidad (R-6): todo caso se prueba AL REVÉS — una nota defectuosa
sembrada debe hacerlo fallar. Un eval que no puede fallar no es un eval.
Datos: sintéticos o actuados, jamás pacientes reales (regla data-privacy).
