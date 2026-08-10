# V14 — Registro de riesgos

| ID | Riesgo | Severidad | Control | Residual |
|---|---|---|---|---|
| R-1 | La migración de identidad (cobalto→Cantera) rompa contraste WCAG en pantallas ya aprobadas | Alta | Trinquete de diseño + axe en el arnés existente; re-puntuar cada pantalla migrada; los pares del Lock se validan con el validador de contraste antes de aplicar | Media hasta cerrar V14-IDENTITY-001 |
| R-2 | V14-SHELL-001 (matar el sidebar) desoriente al médico en producción | Alta | V14 no despliega; el shell nuevo se valida con Three-Second test y golden flow E2E antes de cualquier PR | Baja |
| R-3 | Rediseñar tape una señal clínica (danger usado decorativamente o quitado) | Crítica | Regla dura del Lock: `danger` sólo riesgo clínico; «never hide clinical risk for aesthetics» (§7); revisión red-team por pantalla | Baja |
| R-4 | Evidencia PARITY+/benchmarks se rellene de memoria | Alta | Política de claims (docs/evals/CLAIM_POLICY.md); vocabulario cerrado §32; toda fila exige fuente+fecha | Baja |
| R-5 | Fragmentación de ramas repita el 9-ago (8 corridas ciegas) | Media | Protocolo anti-fragmentación en V14_CURRENT_ITERATION.md; OD-1 al dueño | Media hasta fusionar a main |
| R-6 | Scribe-eval Bronze con casos débiles certifique en verde lo que no debe | Alta | Cada caso lleva trampas de alucinación y hechos ausentes obligatorios (§26); prueba al revés: un caso debe FALLAR con una nota defectuosa sembrada | Media hasta V14-SCRIBE-BRONZE-001 |
