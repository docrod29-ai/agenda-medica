# Catálogo maestro de plausibilidad para resultados de laboratorio

**Fuente citable de los límites de plausibilidad de `src/lib/expediente/laboratorio/analitos.ts`.**

- **Autor:** Dr. David Alonso Rodríguez Luna (dueño del producto, internista e infectólogo).
- **Entregado:** 2-sep-2026, en respuesta a la petición de REG-449.
- **Registrado como:** D-032.

Este documento existe porque la regla 1 de seguridad clínica prohíbe inventar una
cifra clínica. Los `min` y `max` del catálogo de analitos **no se inventaron**:
salen de aquí, y aquí queda quién los fijó y cuándo.

> **La regla central del documento:**
> `Plausibility ≠ normalidad ≠ valor crítico ≠ decisión clínica.`

Lo que sigue es el documento del dueño, íntegro y sin resumir.

---

## 1. Principio general

Los límites de este documento son límites de plausibilidad de captura
(*plausibility limits*).

**No son:**

- intervalos de referencia;
- límites de decisión clínica;
- valores críticos;
- intervalos analíticos universales del instrumento;
- sustitutos del rango reportado por el laboratorio.

### Comportamiento recomendado

- Dentro de rango → aceptar.
- Fuera de rango → **aceptar provisionalmente + `VERIFY_VALUE_OR_UNIT`**.
- Nunca truncar.
- Nunca sustituir automáticamente.
- Conservar siempre valor y unidad originales.
- Normalizar además a unidad canónica.
- Permitir comparadores: `<`, `<=`, `>`, `>=`, `=`.
- Permitir resultados textuales: no detectable, hemolizado, muestra insuficiente, etc.
- Los límites de referencia deben provenir del laboratorio, método, sexo, edad,
  embarazo y población cuando aplique.
- Los resultados críticos deben manejarse en una capa diferente.

## 2. Biometría hemática

| Analito | Unidad canónica | Mínimo creíble | Máximo creíble |
|---|---|---|---|
| Eritrocitos | 10^6/µL | 0.1 | 12 |
| Hemoglobina | g/dL | 1 | 30 |
| Hematocrito | % | 3 | 85 |
| VCM | fL | 30 | 200 |
| HCM | pg | 8 | 60 |
| CHCM | g/dL | 15 | 50 |
| RDW | % | 5 | 50 |
| RDW-SD | fL | 15 | 150 |
| Leucocitos | 10^3/µL | 0 | 1000 |
| Neutrófilos absolutos | 10^3/µL | 0 | 500 |
| Neutrófilos | % | 0 | 100 |
| Linfocitos absolutos | 10^3/µL | 0 | 500 |
| Linfocitos | % | 0 | 100 |
| Monocitos absolutos | 10^3/µL | 0 | 100 |
| Monocitos | % | 0 | 100 |
| Eosinófilos absolutos | 10^3/µL | 0 | 100 |
| Eosinófilos | % | 0 | 100 |
| Basófilos absolutos | 10^3/µL | 0 | 100 |
| Basófilos | % | 0 | 100 |
| Granulocitos inmaduros | % | 0 | 100 |
| Bandas | % | 0 | 100 |
| Blastos | % | 0 | 100 |
| Plaquetas | 10^3/µL | 0 | 5000 |
| VPM | fL | 2 | 30 |
| PDW | fL | 2 | 50 |
| Plaquetocrito | % | 0 | 5 |
| Reticulocitos | % | 0 | 50 |
| Reticulocitos absolutos | 10^3/µL | 0 | 2000 |
| Eritroblastos / NRBC | /100 WBC | 0 | 1000 |

## 3. Electrolitos, renal y química básica

| Analito | Unidad canónica | Mínimo creíble | Máximo creíble |
|---|---|---|---|
| Sodio | mmol/L | 70 | 210 |
| Potasio | mmol/L | 0.5 | 15 |
| Cloro | mmol/L | 40 | 170 |
| Bicarbonato / CO2 total | mmol/L | 1 | 80 |
| Brecha aniónica | mmol/L | -20 | 80 |
| Calcio total | mg/dL | 2 | 25 |
| Calcio ionizado | mmol/L | 0.2 | 3 |
| Fósforo | mg/dL | 0.1 | 30 |
| Magnesio | mg/dL | 0.1 | 15 |
| Glucosa | mg/dL | 1 | 3000 |
| Osmolalidad sérica | mOsm/kg | 180 | 500 |
| Ácido úrico | mg/dL | 0.1 | 40 |
| Urea | mg/dL | 1 | 1200 |
| BUN | mg/dL | 0.5 | 500 |
| Creatinina | mg/dL | 0.05 | 50 |
| Cistatina C | mg/L | 0.1 | 20 |
| TFGe / eGFR | mL/min/1.73 m² | 0 | 250 |

## 4. Proteínas y perfil hepático

| Analito | Unidad canónica | Mínimo creíble | Máximo creíble |
|---|---|---|---|
| Proteínas totales | g/dL | 0.5 | 20 |
| Albúmina | g/dL | 0.1 | 8 |
| Globulinas | g/dL | 0.1 | 15 |
| Relación A/G | ratio | 0 | 10 |
| AST / TGO | U/L | 0 | 100000 |
| ALT / TGP | U/L | 0 | 100000 |
| Fosfatasa alcalina | U/L | 0 | 30000 |
| GGT | U/L | 0 | 20000 |
| LDH / DHL | U/L | 0 | 200000 |
| Bilirrubina total | mg/dL | 0 | 100 |
| Bilirrubina directa | mg/dL | 0 | 100 |
| Bilirrubina indirecta | mg/dL | -1 | 100 |
| Amonio | µmol/L | 0 | 1000 |
| Amilasa | U/L | 0 | 100000 |
| Lipasa | U/L | 0 | 100000 |

## 5. Marcadores inflamatorios e infección

| Analito | Unidad canónica | Mínimo creíble | Máximo creíble |
|---|---|---|---|
| PCR | mg/L | 0 | 1000 |
| PCR ultrasensible | mg/L | 0 | 1000 |
| VSG | mm/h | 0 | 200 |
| Procalcitonina | ng/mL | 0 | 1000 |
| Ferritina | ng/mL | 0.1 | 1000000 |
| SAA | mg/L | 0 | 5000 |
| IL-6 | pg/mL | 0 | 1000000 |

> **Nota:** la ferritina puede alcanzar cifras extraordinariamente altas en
> HLH/MAS, hepatopatía, neoplasias, choque y otros síndromes inflamatorios
> severos. El software **no debe rechazar automáticamente** valores extremos.

## 6. Hierro, vitaminas y nutrición

| Analito | Unidad canónica | Mínimo creíble | Máximo creíble |
|---|---|---|---|
| Hierro sérico | µg/dL | 1 | 1000 |
| TIBC | µg/dL | 10 | 2000 |
| UIBC | µg/dL | 0 | 2000 |
| Transferrina | mg/dL | 10 | 1000 |
| Saturación de transferrina | % | 0 | 100 |
| Vitamina B12 | pg/mL | 10 | 100000 |
| Ácido fólico | ng/mL | 0.1 | 100 |
| Vitamina D 25-OH | ng/mL | 0.1 | 500 |
| Zinc | µg/dL | 1 | 1000 |
| Cobre | µg/dL | 1 | 1000 |
| Ceruloplasmina | mg/dL | 1 | 200 |

**Conversión vitamina D:** 25-OH vitamina D: `ng/mL × 2.496 ≈ nmol/L`

## 7. Hemólisis

| Analito | Unidad canónica | Mínimo creíble | Máximo creíble |
|---|---|---|---|
| Haptoglobina | mg/dL | 0 | 1000 |
| LDH | U/L | 0 | 200000 |
| Bilirrubina indirecta | mg/dL | -1 | 100 |
| Reticulocitos | % | 0 | 50 |
| Hemoglobina libre plasmática | mg/dL | 0 | 5000 |

## 8. Coagulación

| Analito | Unidad canónica | Mínimo creíble | Máximo creíble |
|---|---|---|---|
| TP | s | 5 | 200 |
| INR | ratio | 0.4 | 20 |
| TTPa | s | 10 | 300 |
| Tiempo de trombina | s | 5 | 300 |
| Fibrinógeno | mg/dL | 10 | 2000 |
| Dímero D | ng/mL FEU | 0 | 100000 |
| Anti-Xa | IU/mL | 0 | 5 |
| Factor VIII | % | 0 | 1000 |
| Factor IX | % | 0 | 1000 |
| Factor XI | % | 0 | 1000 |
| Factor XIII | % | 0 | 1000 |
| vWF antígeno | % | 0 | 2000 |
| ADAMTS13 actividad | % | 0 | 250 |

> El dímero D debe conservar la unidad original. **FEU y DDU no son
> intercambiables** sin conversión explícita.

## 9. Gasometría y metabolismo crítico

| Analito | Unidad canónica | Mínimo creíble | Máximo creíble |
|---|---|---|---|
| pH arterial | pH | 6.3 | 8.1 |
| pH venoso | pH | 6.3 | 8.1 |
| PaCO2 | mmHg | 5 | 250 |
| PvCO2 | mmHg | 5 | 250 |
| PaO2 | mmHg | 1 | 800 |
| PvO2 | mmHg | 1 | 200 |
| HCO3 | mmol/L | 1 | 80 |
| Exceso de base | mmol/L | -50 | 50 |
| Lactato | mmol/L | 0.1 | 40 |
| SaO2 | % | 0 | 100 |
| SvO2 | % | 0 | 100 |
| Carboxihemoglobina | % | 0 | 100 |
| Metahemoglobina | % | 0 | 100 |

## 10. Perfil lipídico

| Analito | Unidad canónica | Mínimo creíble | Máximo creíble |
|---|---|---|---|
| Colesterol total | mg/dL | 20 | 1500 |
| Triglicéridos | mg/dL | 5 | 15000 |
| HDL | mg/dL | 1 | 250 |
| LDL | mg/dL | 1 | 1200 |
| VLDL | mg/dL | 0 | 1000 |
| ApoA1 | mg/dL | 1 | 500 |
| ApoB | mg/dL | 1 | 500 |
| Lp(a) | mg/dL | 0 | 500 |

## 11. Diabetes y metabolismo

| Analito | Unidad canónica | Mínimo creíble | Máximo creíble |
|---|---|---|---|
| HbA1c | % | 2 | 25 |
| Insulina | µIU/mL | 0.1 | 10000 |
| Péptido C | ng/mL | 0.01 | 100 |
| Beta-hidroxibutirato | mmol/L | 0 | 20 |
| Fructosamina | µmol/L | 50 | 2000 |

## 12. Tiroides

| Analito | Unidad canónica | Mínimo creíble | Máximo creíble |
|---|---|---|---|
| TSH | mIU/L | 0.001 | 1000 |
| T4 libre | ng/dL | 0.01 | 20 |
| T3 libre | pg/mL | 0.1 | 50 |
| T4 total | µg/dL | 0.1 | 50 |
| T3 total | ng/dL | 5 | 2000 |
| Anti-TPO | IU/mL | 0 | 100000 |
| Anti-tiroglobulina | IU/mL | 0 | 100000 |
| Tiroglobulina | ng/mL | 0 | 100000 |

## 13. Endocrinología

| Analito | Unidad canónica | Mínimo creíble | Máximo creíble |
|---|---|---|---|
| Cortisol | µg/dL | 0.1 | 200 |
| ACTH | pg/mL | 0 | 10000 |
| PTH intacta | pg/mL | 0 | 10000 |
| Prolactina | ng/mL | 0.1 | 100000 |
| Testosterona total | ng/dL | 1 | 5000 |
| Testosterona libre | pg/mL | 0.1 | 1000 |
| Estradiol | pg/mL | 1 | 10000 |
| Progesterona | ng/mL | 0.1 | 1000 |
| FSH | IU/L | 0 | 1000 |
| LH | IU/L | 0 | 1000 |
| Beta-hCG | mIU/mL | 0 | 10000000 |

## 14. Cardiología

| Analito | Unidad canónica | Mínimo creíble | Máximo creíble |
|---|---|---|---|
| Troponina I hs | ng/L | 0 | 1000000 |
| Troponina T hs | ng/L | 0 | 1000000 |
| BNP | pg/mL | 0 | 100000 |
| NT-proBNP | pg/mL | 0 | 500000 |
| CK total | U/L | 0 | 1000000 |
| CK-MB masa | ng/mL | 0 | 10000 |
| Mioglobina | ng/mL | 0 | 100000 |

> La troponina **no debe tener un único punto de corte clínico universal**. El
> percentil 99 depende del ensayo, fabricante y plataforma.

## 15. Inmunología

| Analito | Unidad canónica | Mínimo creíble | Máximo creíble |
|---|---|---|---|
| IgG | mg/dL | 10 | 10000 |
| IgA | mg/dL | 0 | 5000 |
| IgM | mg/dL | 0 | 5000 |
| IgE total | IU/mL | 0 | 100000 |
| C3 | mg/dL | 1 | 500 |
| C4 | mg/dL | 1 | 250 |
| CH50 | U/mL | 0 | 500 |
| Factor reumatoide | IU/mL | 0 | 10000 |
| Anti-CCP | U/mL | 0 | 10000 |

> ANA, ANCA, ENA y otros autoanticuerpos pueden reportarse como títulos,
> índices, ratios, AU/mL o resultados cualitativos y **no deben forzarse a un
> único modelo numérico**.

## 16. VIH e inmunología celular

| Analito | Unidad canónica | Mínimo creíble | Máximo creíble |
|---|---|---|---|
| CD4 absoluto | células/µL | 0 | 10000 |
| CD4 | % | 0 | 100 |
| CD8 absoluto | células/µL | 0 | 20000 |
| CD8 | % | 0 | 100 |
| CD4/CD8 | ratio | 0 | 20 |
| Carga viral VIH | copias/mL | 0 | 1000000000 |
| Carga viral VIH log10 | log10 copias/mL | 0 | 10 |

## 17. Virología cuantitativa

| Analito | Unidad canónica | Mínimo creíble | Máximo creíble |
|---|---|---|---|
| HBV DNA | IU/mL | 0 | 100000000000 |
| HCV RNA | IU/mL | 0 | 10000000000 |
| CMV DNA | IU/mL | 0 | 10000000000 |
| EBV DNA | IU/mL | 0 | 10000000000 |
| BK virus DNA | copias/mL | 0 | 100000000000 |

### Regla para límites de cuantificación

**No convertir automáticamente:**

- `<35 IU/mL` → 35
- `<LLOQ` → valor numérico
- `>ULOQ` → valor truncado

Debe conservarse el comparador y el texto original.

## 18. Micología

| Analito | Unidad canónica | Mínimo creíble | Máximo creíble |
|---|---|---|---|
| Galactomanano sérico | índice ODI | 0 | 50 |
| Galactomanano BAL | índice ODI | 0 | 50 |
| Beta-D-glucano | pg/mL | 0 | 10000 |

> La positividad depende de muestra, ensayo, contexto y estrategia diagnóstica;
> no debe codificarse como un punto de corte universal dentro del analito.

## 19. Marcadores tumorales

| Analito | Unidad canónica | Mínimo creíble | Máximo creíble |
|---|---|---|---|
| AFP | ng/mL | 0 | 10000000 |
| CEA | ng/mL | 0 | 100000 |
| CA 19-9 | U/mL | 0 | 10000000 |
| CA-125 | U/mL | 0 | 1000000 |
| CA 15-3 | U/mL | 0 | 1000000 |
| PSA total | ng/mL | 0 | 100000 |
| PSA libre | ng/mL | 0 | 100000 |

## 20. Examen general de orina y cuantificación urinaria

| Analito | Unidad canónica | Mínimo creíble | Máximo creíble |
|---|---|---|---|
| Densidad urinaria | ratio | 1.000 | 1.060 |
| pH urinario | pH | 4 | 9.5 |
| Proteína urinaria | mg/dL | 0 | 5000 |
| Glucosa urinaria | mg/dL | 0 | 10000 |
| Creatinina urinaria | mg/dL | 0.1 | 1000 |
| Sodio urinario | mmol/L | 0 | 400 |
| Potasio urinario | mmol/L | 0 | 300 |
| Cloro urinario | mmol/L | 0 | 400 |
| Osmolalidad urinaria | mOsm/kg | 20 | 1500 |
| Albuminuria | mg/L | 0 | 50000 |
| Relación albúmina/creatinina | mg/g | 0 | 100000 |
| Relación proteína/creatinina | mg/g | 0 | 100000 |
| Proteinuria 24 h | mg/24 h | 0 | 100000 |

## 21. Líquido cefalorraquídeo

| Analito | Unidad canónica | Mínimo creíble | Máximo creíble |
|---|---|---|---|
| LCR leucocitos | células/µL | 0 | 100000 |
| LCR eritrocitos | células/µL | 0 | 10000000 |
| LCR proteínas | mg/dL | 0 | 5000 |
| LCR glucosa | mg/dL | 0 | 1000 |
| LCR lactato | mmol/L | 0 | 30 |
| Presión de apertura | cm H2O | 0 | 100 |

## 22. Otros líquidos corporales

| Analito | Unidad canónica | Mínimo creíble | Máximo creíble |
|---|---|---|---|
| Leucocitos en líquido | células/µL | 0 | 1000000 |
| Eritrocitos en líquido | células/µL | 0 | 10000000 |
| Proteínas en líquido | g/dL | 0 | 20 |
| Glucosa en líquido | mg/dL | 0 | 2000 |
| LDH en líquido | U/L | 0 | 200000 |
| Amilasa en líquido | U/L | 0 | 100000 |
| Triglicéridos en líquido | mg/dL | 0 | 10000 |

## 23. Metabolismo mineral / nefrología

| Analito | Unidad canónica | Mínimo creíble | Máximo creíble |
|---|---|---|---|
| PTH | pg/mL | 0 | 10000 |
| 25-OH vitamina D | ng/mL | 0.1 | 500 |
| 1,25-(OH)2 vitamina D | pg/mL | 0.1 | 1000 |
| Calcio | mg/dL | 2 | 25 |
| Fósforo | mg/dL | 0.1 | 30 |
| Magnesio | mg/dL | 0.1 | 15 |

## 24. Toxicología y niveles farmacológicos

| Analito | Unidad canónica | Mínimo creíble | Máximo creíble |
|---|---|---|---|
| Vancomicina | µg/mL | 0 | 200 |
| Amikacina | µg/mL | 0 | 500 |
| Gentamicina | µg/mL | 0 | 200 |
| Tobramicina | µg/mL | 0 | 200 |
| Litio | mmol/L | 0 | 10 |
| Digoxina | ng/mL | 0 | 20 |
| Valproato | µg/mL | 0 | 500 |
| Carbamazepina | µg/mL | 0 | 100 |
| Fenitoína | µg/mL | 0 | 100 |
| Paracetamol | µg/mL | 0 | 1000 |
| Salicilato | mg/dL | 0 | 200 |
| Etanol | mg/dL | 0 | 1000 |

## 25. Reglas de modelado obligatorias

### 25.1 No almacenar únicamente name/value/unit

```
analyte_name:
loinc_code:
specimen:
value_numeric:
comparator:        # <, <=, >, >=, =
value_text:
original_value:
original_unit:
canonical_value:
canonical_unit:
ucum_code:
reference_low:
reference_high:
reference_text:
interpretation:    # H, L, HH, LL, N...
critical_flag:
plausibility_min:
plausibility_max:
assay_method:
manufacturer:
laboratory:
collection_datetime:
result_datetime:
verification_status:
```

### 25.2 Diferenciales leucocitarios

**No deben existir como una sola entidad.**

```
neutrophils_percent      lymphocytes_percent
neutrophils_absolute     lymphocytes_absolute
monocytes_percent        eosinophils_percent
monocytes_absolute       eosinophils_absolute
basophils_percent        basophils_absolute
```

Ejemplo: «Neutrófilos 75 %» y «Neutrófilos 7.5 ×10^3/µL» son resultados
**diferentes** y deben mapearse a variables diferentes.

## 26. Separación entre cuatro conceptos

Ausculta debe mantener separados:

**A. Plausibility limits** — identifican decimal desplazado, error OCR, unidad
equivocada, captura manual incorrecta, valor extraordinario que requiere
verificación.

**B. Reference interval** — proviene del laboratorio; varía por edad, sexo,
embarazo, método, población, instrumento.

**C. Clinical decision limits** — HbA1c para diabetes; troponina y percentil 99;
LDL según riesgo; procalcitonina según algoritmo; galactomanano según
muestra/contexto.

**D. Critical values** — resultados que requieren comunicación inmediata según
política institucional.

**No deben mezclarse estas cuatro capas.**

## 27. Reglas de unidades

### 27.1 Conservar unidad original

```
original_value: 140
original_unit: µmol/L
canonical_value: 1.58
canonical_unit: mg/dL
```

Nunca eliminar la unidad original después de normalizar.

### 27.2 Usar UCUM para unidades canónicas

`mg/dL` · `g/dL` · `mmol/L` · `umol/L` · `10*3/uL` · `10*6/uL` · `ng/mL` ·
`pg/mL` · `IU/mL` · `U/L` · `mL/min/{1.73_m2}`

### 27.3 Identificación del analito

`display_name` · `canonical_name` · `LOINC` · `specimen` · `method`

**No mapear un analito únicamente por el nombre escrito en el PDF.**

## 28. Política de validación propuesta

```
IF value cannot be parsed:
    status = UNPARSED
ELSE IF unit is unknown:
    status = VERIFY_UNIT
ELSE:
    normalize value to canonical unit
    IF normalized_value < plausibility_min
       OR normalized_value > plausibility_max:
        status = VERIFY_VALUE_OR_UNIT
    ELSE:
        status = ACCEPTED
```

**Nunca:** `reject()` · `truncate()` · `replace_with_limit()` · `silently_correct()`

## 29. Detección de decimal desplazado

Antes de marcar un valor como imposible, evaluar candidatos: `×10` `÷10` `×100`
`÷100` `×1000` `÷1000`.

Ejemplo: `Na = 1400 mmol/L` podría ser `140 mmol/L`. Pero el sistema debe
**sugerir revisión, no corregir automáticamente**.

## 30. Manejo de resultados extremos

**Un resultado clínicamente extraordinario no equivale a error.** Ejemplos:
ferritina >100 000 ng/mL; leucocitos >300 ×10³/µL; LDH >50 000 U/L; CK >100 000
U/L; triglicéridos >10 000 mg/dL; creatinina >20 mg/dL; glucosa >1 000 mg/dL;
NT-proBNP >100 000 pg/mL.

Por ello los límites de plausibilidad deben ser **mucho más amplios** que los
intervalos fisiológicos.

## 31. Valores solicitados inicialmente

| Analito | Unidad | Mínimo creíble | Máximo creíble |
|---|---|---|---|
| Ácido úrico | mg/dL | 0.1 | 40 |
| Ferritina | ng/mL | 0.1 | 1 000 000 |
| Vitamina D 25-OH | ng/mL | 0.1 | 500 |
| VCM | fL | 30 | 200 |
| Neutrófilos absolutos | 10^3/µL | 0 | 500 |
| Linfocitos absolutos | 10^3/µL | 0 | 500 |
| Neutrófilos | % | 0 | 100 |
| Linfocitos | % | 0 | 100 |

## 32. Recomendación de arquitectura para Ausculta

Cada resultado debería poder conservar simultáneamente: dato original · unidad
original · dato normalizado · unidad canónica · LOINC · UCUM · muestra · método ·
laboratorio · rango de referencia reportado · bandera H/L/HH/LL · plausibility
flag · critical flag · comparador `<` o `>` · fecha de toma · fecha de liberación ·
procedencia · fuente del dato · grado de confianza de extracción · correcciones
posteriores sin destruir el dato original.

## 33. Estados recomendados

`ACCEPTED` · `VERIFY_VALUE` · `VERIFY_UNIT` · `VERIFY_VALUE_OR_UNIT` ·
`OUTSIDE_REFERENCE_RANGE` · `CRITICAL_RESULT` · `UNPARSED` ·
`QUALITATIVE_RESULT` · `BELOW_LOQ` · `ABOVE_ULOQ` · `MISSING_UNIT` ·
`MISSING_REFERENCE_RANGE`

## 34. Principios de seguridad

- Nunca usar plausibility limits para diagnosticar.
- Nunca convertir automáticamente un resultado extremo en error.
- Nunca asumir que un rango de referencia es universal.
- Nunca asumir equivalencia entre distintas unidades sin conversión explícita.
- Nunca perder el valor original.
- Nunca sobrescribir un dato corregido sin auditoría.
- Todo cambio debe dejar trazabilidad.
- **El médico conserva autoridad final** sobre interpretación y validación clínica.

## 35. Estándares de referencia recomendados

- **CLSI EP28** — establecimiento/verificación de intervalos de referencia.
- **CLSI GP47** — manejo de resultados de riesgo/*critical-risk results*.
- **LOINC** — identificación estandarizada de observaciones.
- **UCUM** — unidades canónicas interoperables.
- **HL7 FHIR Observation** — estructura interoperable de resultados de laboratorio.
- Intervalos analíticos/reportables específicos deben provenir del fabricante o
  del laboratorio que ejecuta el ensayo.

## 36. Conclusión

La capa de laboratorio de Ausculta debe separar claramente:

```
RAW RESULT
  ↓
UNIT NORMALIZATION
  ↓
PLAUSIBILITY VALIDATION
  ↓
REFERENCE RANGE INTERPRETATION
  ↓
CRITICAL VALUE LOGIC
  ↓
CLINICAL INTERPRETATION
```

El sistema debe estar diseñado para **detectar errores sin destruir datos
clínicamente extremos pero verdaderos**.

La regla central es:

> **Plausibility ≠ normalidad ≠ valor crítico ≠ decisión clínica.**
