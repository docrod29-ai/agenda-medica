# Rúbrica de interacción clínica (factores humanos) — V10 (§37)

Para toda pantalla de alto riesgo (receta, órdenes, firma, resultados,
grabación, MAR), responder con evidencia:

1. ¿Puede ocurrir contexto de paciente equivocado?
2. ¿Borrador vs final es inconfundible?
3. ¿Las unidades están ligadas a los números?
4. ¿Las advertencias críticas son visibles?
5. ¿Se abusa de las advertencias (fatiga de alerta)?
6. ¿El usuario puede recuperarse del error?
7. ¿La salida de la IA puede confundirse con acción del médico?
8. ¿La procedencia es inspeccionable?
9. ¿La responsabilidad es clara?
10. ¿El cierre es claro?

**Los factores humanos ganan a la preferencia decorativa** (V10 §37). Un «no»
sin mitigación en las preguntas 1–4 es P0 y bloquea la unidad.

Estas preguntas se apoyan en reglas ya vigentes del repo: seguridad clínica
(`.claude/rules/clinical-safety.md` — nada cambia en silencio, ausencia de
dato no es dato de ausencia) y procedencia/reversibilidad
(`.claude/rules/design-system.md`).
