# ADR — CKD-EPI 2021 (TFG estimada, sin raza)

- **Fuente de verdad ÚNICA:** `src/lib/expediente/funcion-renal.ts` (`ckdEpi2021`).
  `calculadoras.ts` **re-exporta** — prohibido reimplementar la fórmula (REG-007).
- **Referencia:** Inker LA et al. NEJM 2021 (CKD-EPI creatinine 2021, race-free).
- **Fórmula:** `142 × min(Scr/κ,1)^α × max(Scr/κ,1)^−1.200 × 0.9938^edad × (1.012 si mujer)`
  con κ=0.7 (mujer)/0.9 (hombre), α=−0.241 (mujer)/−0.302 (hombre).
- **Unidades canónicas:** creatinina mg/dL; edad años; sexo (acepta `Sexo` o booleano `esMujer`).
- **Redondeo:** **ninguno en el motor** (devuelve precisión completa). El display decide
  entero/1/2 decimales. Decisión del Dr (L6).
- **Guarda de plausibilidad:** creatinina fuera de [0.1, 25] mg/dL → `datoImplausible`
  (techo de UNIDAD, no clínico); no produce TFG falsa ni alertas inventadas.
- **Incidente asociado:** REG-007 (implementación duplicada con redondeo distinto).
  Golden + property-based (monotonía decreciente en creatinina) en
  `clinical-safety-harness.test.ts`; unitarios en `funcion-renal*.test.ts`.
- **Fecha / responsable:** 2026-07 · loop de auditoría NexusMED.
