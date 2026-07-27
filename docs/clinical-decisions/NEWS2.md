# ADR — NEWS2 (National Early Warning Score 2)

- **Fuente de verdad ÚNICA:** `src/lib/hospital/news2.ts` (`calcularNews2`). La UI NO
  recalcula thresholds; las bandas visuales de las gráficas son **referencia visual**, no
  los cortes de NEWS2 (REG-008).
- **Referencia:** Royal College of Physicians, NEWS2 (2017).
- **Parámetros/unidades:** FR rpm; SpO2 %; O2 suplementario (booleano); TA sistólica mmHg;
  FC lpm; temperatura °C; **conciencia ACVPU**.
- **ACVPU:** se **almacena la letra completa** A/C/V/P/U (además se acepta el legado
  `alerta`/`alterada`). NEWS2: **A = 0; C/V/P/U = 3**. La captura ofrece los 5 botones
  (antes solo `alerta`/`alterada`, que perdía la letra clínica).
- **Missing data:** parámetro ausente ⇒ NO cuenta como 0; el score es **parcial** y lo
  advierte. `missing ≠ normal`.
- **Golden:** `hospital-news2.test.ts`, `hospital-news2-parcial.test.ts`, `l6-acvpu-fhir.test.ts`
  (deriva NEWS2 de ACVPU completo + FHIR no pierde el dato).
- **Fecha / responsable:** 2026-07 · loop de auditoría NexusMED.
