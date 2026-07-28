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
- **Invariantes PROPERTY-BASED (Nexus OS E0-02):** `src/__tests__/dosis-invariantes-property.test.ts`
  sobre `FARMACOS_PED` × malla de pesos 0.5–120 kg × malla de edades (incluye "sin edad
  capturada"). Arnés determinista propio en `src/__tests__/_harness/property.ts` — **sin
  `fast-check`**: una suite clínica que dependa de `Math.random` produce fallos no
  reproducibles. Cubre: forma del catálogo (P1), aceptación `dosis/toma ≤ tope` (P2),
  monotonía en peso (P3), dominio de la contraindicación por edad (P4), unidad obligatoria y
  fail-closed del verificador adulto (P5) y coherencia entre los dos motores (P6). Dos casos
  con motores MUTANTES demuestran que P2 detecta la regresión REG-018 y un tope no aplicado
  (un invariante verde contra un motor sano no prueba nada por sí solo).
- **Fail-closed a propósito:** un fármaco nuevo con una **unidad** fuera de `['mg','mg de TMP']`,
  **sin ningún tope declarado**, o que **contradiga** el catálogo adulto, **tumba el CI**. Es el
  efecto buscado: obliga a una revisión clínica explícita antes de entrar, en vez de un
  silencio. No es un fallo del arnés.
- **Tolerancia de redondeo DECLARADA (`TOL_REDONDEO = 0.05`):** el motor redondea a 1 decimal
  **al más cercano**, no hacia abajo, así que el total diario puede quedar hasta
  `0.05 × tomas` por ENCIMA del tope (máximo medido: Metronidazol @66.7 kg → 666.7 × 3 =
  2000.1 contra `topeDia` 2000; Gentamicina neonatal @51.3 kg → 256.6 contra 256.5). La
  constante es **derivada** (medio paso de redondeo), no elegida. **NEEDS_CLINICAL_REVIEW:**
  aceptar esa tolerancia o exigir redondeo SIEMPRE hacia abajo al tocar un tope es decisión
  del médico responsable; la segunda opción cambia el comportamiento del motor.
- **NEEDS_CLINICAL_REVIEW abierto — Amoxicilina (y Amoxicilina-clavulanato):** `FARMACOS_PED`
  emite `45 × peso` mg/toma (cruza 1000 mg desde ≈22.3 kg; 1500 mg/toma desde 33.4 kg) mientras
  el `CATALOGO` adulto de `seguridad/dosis.ts` declara `maxTomaMg: 1000` ⇒ `revisarDosis` marca
  como crítica la receta que el motor pediátrico acaba de emitir. **No se elige techo aquí**;
  el hallazgo queda versionado en `INCOHERENCIAS_CONOCIDAS` (P6) y una contradicción NUEVA
  rompe el CI.
- **NEEDS_CLINICAL_REVIEW abierto — cobertura del catálogo adulto:** 20 de los 25 fármacos
  pediátricos no existen en `CATALOGO` ⇒ `revisarDosis` devuelve `sin_referencia` y no impone
  techo al prescribirlos a un adulto. Ampliarlo exige `maxTomaMg`/`maxDiaMg` aportados por el
  médico: **no se derivan** de las cifras pediátricas.
- **Residual conocido (P2):** en primera visita (sin peso previo) un peso en lb <120
  capturado con el selector en "kg" no dispara guarda → depende de la selección manual
  correcta de unidad. Mitigación futura: default de unidad explícito / confirmación.
- **Fecha / responsable:** 2026-07 · loop de auditoría NexusMED.
