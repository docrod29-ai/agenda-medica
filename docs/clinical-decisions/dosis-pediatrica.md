# ADR — Dosis pediátrica por peso

- **Fuente de verdad:** `src/lib/expediente/pediatria.ts` (`calcularDosisPediatrica`, `CATALOGO`).
- **Referencia:** referencias por fármaco; **topes validados por el médico responsable**
  (p.ej. amikacina 15 mg/kg/día tope y 1500 mg/día absoluto; gentamicina 7.5 mg/kg/día).
- **Unidad canónica de peso:** **kg**. Si se captura en lb se convierte explícitamente
  (`LB_A_KG = 1/2.20462`) ANTES de calcular. **Prohibida** la heurística "peso>150 ⇒ lb".
- **Seguridad de unidad:** peso implausible (>120 kg) o cambio ≈×2.2046 vs peso previo →
  **hard-stop de confirmación** (bloquea cálculo y "Agregar a nota"); nunca auto-corrige.
- **Pipeline de topes (REG-018):** el cálculo aplica, EN ORDEN, `topeDosis` (por toma),
  `topeDia` (propagado a por-toma **y** por-día), y `topeMgKgDia` (propagado **también a
  la dosis por toma**, no solo a la diaria). Sin esto, un fármaco de 1 toma/día podía
  escribir en la receta una dosis/toma por encima del tope de seguridad diario.
- **Invariante permanente:** `porToma ≤ porDía` para TODO el catálogo, a todo peso
  (`clinical-safety-harness.test.ts`). + `peso-pediatrico-seguridad.test.ts`, `seguridad-dosis.test.ts`.
- **Residual conocido (P2):** en primera visita (sin peso previo) un peso en lb <120
  capturado con el selector en "kg" no dispara guarda → depende de la selección manual
  correcta de unidad. Mitigación futura: default de unidad explícito / confirmación.
- **Fecha / responsable:** 2026-07 · loop de auditoría NexusMED.
