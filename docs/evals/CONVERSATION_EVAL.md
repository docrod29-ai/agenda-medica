# Conversation-Eval (V14 §25)

**Estado: harness NO construido** (`evals/conversation/` no existe;
V14-CONVERSATION-EVAL-001).

Se evalúa ANTES de la nota final. Métricas requeridas: WER · exactitud de
términos críticos · nombre de medicamento · dosis · unidad · números · signo ·
atribución de hablante · negación · temporalidad · experienciador · intención ·
ligado concepto-valor · code-switching · fidelidad al segmento fuente.

Atribución por capa de fallo:

```text
AUDIO → ASR → DIARIZATION → EXTRACTION → NORMALIZATION → NOTE GENERATION
```

Errores silenciosos de alto riesgo (medicación, alergia, número crítico,
unidad, negación, hablante, intención) son **P0**.

Verdad previa que este eval hereda (no re-descubrir): WER crudo 25,55 % medido
con dictado real (bloqueado en re-medición por el Dr.); el corpus actuado con
verdad por turno existe (commit 86b4bbe); las defensas de negación/siglas/
unidades tienen sus REG y guardianes.
