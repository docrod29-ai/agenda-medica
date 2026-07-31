# ADR — FIB-4 (índice de fibrosis hepática)

- **Fuente de verdad:** `src/lib/expediente/cardiometabolico/masld.ts` (`fib4`)
- **Referencia:** Sterling RK et al. Hepatology 2006.
- **Fórmula:** `(edad × AST) / (plaquetas × √ALT)`.
- **Unidades canónicas:** edad años; AST/ALT U/L; **plaquetas ×10⁹/L**.
- **Normalización de plaquetas:** si el valor llega como conteo absoluto (/µL, p.ej. 135000)
  se divide entre 1000 para llevarlo a ×10⁹/L. Detección por magnitud (`> 2000 ⇒ /µL`).
  *Limitación conocida:* es heurística por magnitud, no unidad tipada; la banda 1000–2000
  no se cubre (no ocurre en fisiología real). Mejora futura: `ClinicalQuantity{value,unit}`.
- **Redondeo:** 2 decimales.
- **Incidente asociado:** REG-001 (daba 3053.54 en vez de 3.05 por doble división /1000).
  Test permanente: `clinical-safety-harness.test.ts` (caso exacto + invariancia de unidad
  property-based).
- **Golden:** `fib4(68,42,135,48) ≈ 3.05`; `fib4(...,135,...) === fib4(...,135000,...)`.
- **Fecha / responsable:** 2026-07 · loop de auditoría NexusMED.
