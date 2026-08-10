# Known Limitations — honestas, con mitigación

A 10-ago-2026:

1. **Sin validación externa de ningún tipo.** Ni estudio, ni revisión ciega,
   ni head-to-head. Mitigación: escalera Bronze→Silver→Gold→Real-world (V14
   §27) y política de claims que prohíbe afirmar lo no medido.
2. **Evals de IA clínica no corridos.** Conversation-Eval y Scribe-Eval no
   existen como harness. Mitigación: son unidades tempranas de la secuencia V14.
3. **WER crudo 25,55 %** en la única medición real; el pipeline corrige encima
   pero la tasa base es alta. Mitigación: sesgo de vocabulario por paciente,
   corrector vigilado, compuerta de ambigüedad; re-medición pendiente de un
   dictado nuevo del médico.
4. **Identidad visual en transición.** La piel actual (cobalto) queda superada
   por el Identity Lock (Cantera+Instrumento); hasta cerrar V14-IDENTITY-001 el
   producto no refleja su identidad declarada.
5. **El shell es un almacén de funciones** (~22 destinos por módulo) — la falla
   de convergencia que V14 §11 declara P0. Mitigación: V14-SHELL-001.
6. **Scores visuales/de flujo sin medir bajo criterios V14.** Los scores V10
   existen pero se midieron contra otra identidad. Mitigación: re-score con
   evidencia por pantalla.
7. **Verdad del programa fragmentada en ramas de sesión** (no en main).
   Mitigación: protocolo anti-fragmentación + OD-1 (PR a main).
8. **Un solo médico ha usado el producto** (el dueño). Todo lo aprendido de uso
   real tiene N=1 y sesgo de fundador.
9. **Hospital/UCI en ALPHA**: se usan, no se venden; no auditados al nivel de
   Practice.
10. **Decisiones clínicas bloqueadas en el dueño** (política de correcciones,
    retención de audio, requisitos legales de receta impresa) — listadas en
    `agent-state/OWNER_DECISIONS_REQUIRED.md` y V9/V14 equivalentes.
