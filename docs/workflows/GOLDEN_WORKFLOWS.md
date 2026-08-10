# Golden Workflows (V14 §22)

Gate: score ≥9.3 promedio, ninguno crítico <9.0. **Ninguno tiene score aún**:
un flujo sin recorrer en navegador no se puntúa
(`agent-state/V14_WORKFLOW_SCORECARD.json`).

| ID | Flujo | Estado |
|---|---|---|
| WF-001 | Paciente nuevo → cita → primera consulta → plan → seguimiento | SIN PUNTUAR |
| WF-002 | Paciente que regresa → resumen previsita → consulta → plan actualizado | SIN PUNTUAR |
| WF-003 | Consulta → grabación → nota → firma | SIN PUNTUAR — base validada: pipeline ASR completo, procedencia por frase (REG-250), rastreo de nota (REG-251) |
| WF-004 | Consulta → receta → entrega al paciente | SIN PUNTUAR |
| WF-005 | Orden → resultado → revisión → acción → comunicación → cierre | SIN PUNTUAR — base: REG-252 (bucle de laboratorio arranca) |
| WF-006 | Resultado anormal → clínico responsable → acción | SIN PUNTUAR — base: REG-291 (normal no marcado crítico) |
| WF-007 | Discrepancia de medicación → reconciliación | SIN PUNTUAR |
| WF-008 | Pregunta de paciente → triage IA → clínico si hace falta → resolución | SIN PUNTUAR — gobernado por la regla patient-facing-ai (5 clases, escalación) |
| WF-009 | Seguimiento necesario → agendar → completar → desenlace | SIN PUNTUAR |
| WF-010 | Reagendar/cancelar/no-show | SIN PUNTUAR |
| WF-011 | Médico interrumpido a media consulta → volver sin perder datos | SIN PUNTUAR — base: REG-283/287/294…297 (audio no se pierde) |
| WF-012 | Consulta rápida móvil | SIN PUNTUAR |
| WF-013 | Liberación de documento → acceso del paciente → revocación | SIN PUNTUAR — base: PatientVisitPackage DRAFT/RELEASED con compuerta en servidor |
| WF-014 | Trial → suscripción → fallo de pago → recuperación | SIN PUNTUAR — base: REG-293 (día de cobro del consultorio) |
| WF-015 | Traspaso secretaria → médico | SIN PUNTUAR |
| WF-016 | Bucle Nexus Course de curso antimicrobiano | SIN PUNTUAR — firma de especialidad, no existe la Course Bar aún |
| WF-017 | Previsita auto-armada con pendientes con dueño | SIN PUNTUAR |
| WF-018 | Encuentro → captura de cobro consultorio privado MX | SIN PUNTUAR |
| WF-019 | Consulta bilingüe ES/EN | SIN PUNTUAR |
| WF-020 | Referencia con bucle cerrado | SIN PUNTUAR |
| WF-021 | Recall de panel | SIN PUNTUAR |
| WF-022 | Bucle de aprendizaje de estilo | SIN PUNTUAR — no existe (V14-STYLE-001); el aprendizaje ASR de una palabra sí existe y NO es esto |
