# DECISIONES — ICU Voice / Infusion / Observation Engine

**Autor: Dr. David Alonso Rodríguez Luna · 29-jul-2026**
**Documento canónico. El software lo implementa, no lo reinterpreta.**

Responde las cuatro preguntas abiertas de `ICU-001`. La respuesta a **ICU-Q3
cierra además E0-09/Q1**, que llevaba abierta desde el 28-jul.

---

## Q1 · Benchmark de voz — 5 000 utterances

**NO** exigir 5 000 grabaciones clínicas reales como condición inicial.
**NI** fabricar 5 000 historias ficticias a mano.

Benchmark **híbrido en 3 capas**:

### Capa A — Synthetic Linguistic Benchmark (2 500–3 500)

Generadas **programáticamente** desde plantillas validadas. **NO representan
pacientes reales**: son fixtures de reconocimiento y extracción.

```
Plantilla:  "PEEP {value}, PIP {value}, plateau {value}"
Variantes:  "PEEP ocho, pico veintiséis, plateau veintidós"
            "Peep de ocho y PIP veintiséis"
            "PEEP 8, PIP 26, Pplat 22"
            "Tiene ocho de PEEP"
            "Peep eight"
            "PEEP en ocho"
```

Variación sistemática de: pronunciación · abreviaturas · inglés · español ·
Spanglish · orden de variables · muletillas · correcciones · repeticiones ·
números · ruido textual · negaciones.

Los valores salen de **rangos de prueba declarados explícitamente**.
⚠️ **No** declararlos como distribución epidemiológica ni clínica real.

### Capa B — Adversarial Critical-Term Benchmark (~1 000)

Enfocado en las confusiones **peligrosas**, con **pares mínimos fonéticamente
similares**:

| | |
|---|---|
| PEEP / PIP | VT / VTI |
| RASS −4 / RASS +4 | mg / mcg |
| min / h | VV / VA |
| pre / post | FiO₂ 0.4 / 40 % |
| 0.03 / 0.3 / 3 | CVVH / CVVHD / CVVHDF |
| sweep / flow | Pplat / Ppeak |
| ScvO₂ / SvO₂ | PaO₂ / SpO₂ |

Objetivo: medir **específicamente los errores que cambian la interpretación
clínica**.

### Capa C — Real-World Speech Validation (200–500, DESPUÉS)

Grabaciones reales o semirreales de voluntarios, con frases estandarizadas y
pacientes ficticios.

Si más adelante se usan dictados reales: consentimiento · minimización ·
desidentificación · gobernanza · autorización institucional cuando corresponda ·
**no entrenamiento automático** · política de retención · seguridad del audio.

> **Nunca usar audio clínico real como condición para iniciar el desarrollo.**

### Métricas

**NO** optimizar Word Error Rate. Medir:

`Critical Concept Accuracy` · `Numeric Accuracy` · `Unit Accuracy` ·
`Sign Accuracy` · `Negation Accuracy` · `Temporal Accuracy` ·
`Context Accuracy` · **`Concept-Value Binding Accuracy`**

```
"PEEP 8, PIP 26"  →  PEEP = 8 cmH₂O   ·   PIP = 26 cmH₂O
```

**No basta con que las palabras estén presentes.** El binding concepto↔valor es
lo que se mide.

---

## Q2 · Preparaciones de infusión

**NO** asumir concentraciones locales. **Tres capas separadas**, con jerarquía
estricta:

```
1. PATIENT ACTIVE PREPARATION     ← lo que de verdad está conectado
2. HOSPITAL STANDARD              ← lo que ese hospital configuró
3. REFERENCE LIBRARY              ← referencia externa (ASHP Standardize 4 Safety)
```

**Nunca al revés.**

- La **Reference Library** se marca `REFERENCE`. **Jamás** `HOSPITAL STANDARD`.
- La **Hospital Library** la configura o importa cada hospital: medicamento ·
  cantidad de fármaco · volumen final · concentración · unidad de dosificación ·
  vía · restricciones · población · ubicación · vigencia.
- NexusMED **no** debe asumir que la norepinefrina del Hospital A y la del
  Hospital B son iguales.
- La **infusión activa del paciente** guarda la preparación **usada**.

**Si el hospital no configuró biblioteca**, el médico ingresa cantidad total ·
volumen final · velocidad · peso cuando corresponda, **antes** de calcular dosis.
**No** usar automáticamente el catálogo de referencia.

---

## ICU-Q3 · Observación corregida y cálculos  — *cierra E0-09/Q1*

### La decisión

**SÍ.** Una observación corregida **entra al cálculo** si es la versión clínica
vigente. **Pero NO se modifica ni se borra la original.**

### Versionado de observaciones

```
ObservationVersion, con estados:
  PRELIMINARY · CONFIRMED · CORRECTED · AMENDED · SUPERSEDED · ENTERED_IN_ERROR
```

Ejemplo:

```
08:00  SpO₂ = 82 %                          ← original conservado
08:03  CORRECTION → SpO₂ = 92 %             ← error de captura
       original.status = entered-in-error / superseded
       reason · author · timestamp · audit trail
```

**NEWS2 actual usa 92 %.** El 82 % **sigue visible** en el expediente.

### Regla de cálculo

> El motor usa la **latest clinically valid observation** dentro de la ventana
> temporal aplicable.
> **Nunca** «latest database row» sin validar estado.

### La distinción esencial: CORRECTION ≠ NEW OBSERVATION

| | Ejemplo A — CORRECCIÓN | Ejemplo B — OBSERVACIÓN NUEVA |
|---|---|---|
| 08:00 | SpO₂ 82 % | SpO₂ 82 % |
| Después | 08:03 «me equivoqué, era 92» | 08:10 SpO₂ 92 % **tras intervención** |
| Qué es | Un solo hecho, mal capturado | **Dos hechos válidos** |
| NEWS2 | El **retrospectivo de las 08:00 usa 92** | 08:00 → 82 · 08:10 → 92 |

> El NEWS2 **en cada momento** debe corresponder al valor disponible **en ese
> momento**.

### Notas ya firmadas

Si una observación corregida afecta un score incluido en una nota **ya firmada**:

- **NO** reescribir la nota en silencio.
- Crear un **amendment / correction event**.
- Recalcular el score **actual**.
- **Conservar el valor originalmente firmado.**

### NEWS2

Función **determinista y temporal**. Entradas: observaciones válidas + timestamp +
escala de SpO₂ apropiada + oxígeno suplementario.

**No** mezclar variables tomadas en horas diferentes sin política explícita.

> La documentación oficial del RCP define NEWS2 a partir de seis parámetros
> fisiológicos más el uso de oxígeno suplementario, con reglas específicas para
> **Scale 1** y **Scale 2**. **No modificar esas reglas por heurística del LLM.**

---

## Q4 · Umbral de confirmación — Risk-Based Confirmation

**NO** usar un threshold universal (`confidence < 0.90 → preguntar`): produce
**fatiga**.

Cada concepto lleva: `clinicalCriticality` · `ambiguity` · `confidence` ·
`contextConsistency` · `physiologicPlausibility` · `calculationImpact`.

### Nivel 1 — ALWAYS CONFIRM

Aunque la confianza sea alta: todo lo que venga **solo de voz** y vaya a
convertirse en **acción u orden**.

Medicamento · concentración · **cambio** de concentración · dosis · velocidad de
infusión · cambio de vasopresor · insulina · anticoagulante · electrolito
concentrado · cambio de configuración de ECMO · cambio de prescripción de CKRT.

**Se extraen durante el dictado sin interrumpir.** La confirmación ocurre **antes
de** `SAVE AS ACTIVE ORDER` o `CHANGE ACTIVE THERAPY`.

### Nivel 2 — CONFIRM IF AMBIGUOUS

Observaciones críticas: PEEP · PIP · Pplat · FiO₂ · RASS · GCS · ECMO flow ·
sweep · UF · Qb · lactato · K · Na · pH …

**NO interrumpir** si: confianza alta **y** contexto consistente **y** valor
plausible **y** sin candidato fonético cercano.

```
"RASS menos cuatro"  ·  confidence 0.98  ·  context = neuro/sedación  ·  −4
→ se registra provisionalmente SIN preguntar
→ se muestra:  RASS −4 ✓
```

**Preguntar** si: confianza baja · dos candidatos clínicamente relevantes
próximos · unidad ambigua · signo ambiguo · valor discordante con el cálculo ·
valor fisiológicamente improbable.

```
"PEEP ocho"  →  PEEP 0.73 / PIP 0.68
→ "¿PEEP 8 o PIP 8?"
```

### Nivel 3 — PASSIVE CONFIRMATION

Riesgo moderado: chip breve `PEEP 8 cmH₂O ✓` **sin detener el dictado**. El
médico lo toca y corrige.

### Nivel 4 — NO CONFIRMATION

Narrativa no crítica (secreciones escasas, abdomen blando, herida limpia).
Editable en la nota.

### Confirmation Score

**No** usar solo la confianza del ASR:

```
confirmationRequired = f(
  speechConfidence, conceptCriticality, candidateAmbiguity,
  unitAmbiguity, plausibility, contextMatch, downstreamImpact
)
```

> **El LLM no toma la decisión final de seguridad. La clasificación es
> DETERMINISTA.**

### Regla antifatiga

Nunca preguntar por cinco valores seguidos. Confirmación pasiva **en línea**
durante el dictado:

```
RASS −3 ✓
PEEP 8 ✓
PIP 26 ✓
NE 12 mL/h ⚠ concentración faltante
```

Al terminar la sección: **«1 elemento requiere revisión.»**

Interrumpir en tiempo real **solo** cuando: (1) no puede continuar un cálculo
crítico · (2) hay ambigüedad peligrosa · (3) se solicita una acción terapéutica ·
(4) la discrepancia es potencialmente grave.

### Corrección por voz

«Corrige RASS a menos cuatro» · «PEEP era diez» · «No, PIP veintiocho».
**Crea una nueva versión. No borra la anterior.**

### Quality Gate de ICU Voice

**100 %** de los pares adversariales críticos deben superar el benchmark
acordado. **CERO** errores conocidos de signo RASS · mg/mcg · PEEP/PIP · VV/VA ·
pre/post · 0.1/1 · min/h **que lleguen en silencio a un cálculo o a una orden
activa**.

Ante incertidumbre relevante: **`REVIEW_REQUIRED`. No adivinar.**

---

# CONSECUENCIAS TÉCNICAS — medidas sobre el código, no supuestas

La respuesta a ICU-Q3 **cierra E0-09/Q1**, pero exige **más de lo que el modelo
actual soporta**. Dos hallazgos concretos:

## C1 · La política actual es BINARIA; la decisión pide una máquina de estados

```ts
// src/lib/hospital/eventos.ts:234 — lo que hay hoy
export type PoliticaSignoCorregido = 'incluye_corregidos' | 'excluye_corregidos'
```

Un booleano disfrazado no puede expresar «**latest clinically valid observation**,
nunca latest database row». Hacen falta los **6 estados** de `ObservationVersion`.

**Consecuencia:** E0-09 ya no se cierra poniéndole un valor a
`POLITICA_SIGNOS_EN_CALCULO`. Ese tipo **se sustituye**.

## C2 · La corrección NO conserva la hora efectiva del original 🔴

`RegistroSignos.fecha` es la hora de **captura**. Una corrección hecha a las 08:03
de una observación de las 08:00 se guarda con `fecha: 08:03`.

**Por lo tanto, el Ejemplo A de la decisión NO ES COMPUTABLE hoy:**

> «El NEWS2 retrospectivo de las 08:00 debe usar 92.»

Hoy el 92 vive a las 08:03. Un NEWS2 recalculado para las 08:00 **no lo
encuentra**. Y `excluye_corregidos` descarta el 82 sin poner nada en su lugar:
**el resultado sería un hueco, no una corrección.**

Y es exactamente lo que distingue los dos ejemplos de la decisión:

| | Hora efectiva | Hora de registro |
|---|---|---|
| **A · corrección** | **08:00** (la del hecho) | 08:03 |
| **B · observación nueva** | 08:10 | 08:10 |

**Arreglo propuesto:** separar `fechaEfectiva` (cuándo ocurrió el hecho) de
`fechaRegistro` (cuándo se capturó). Una corrección **hereda la `fechaEfectiva`
del original**; una observación nueva trae la suya. Es la distinción
`effectiveDateTime` vs `issued` de FHIR, así que además alinea con el export que
ya existe.

**Sin C2, la decisión de ICU-Q3 no se puede implementar con fidelidad.** No es una
mejora opcional: es el requisito que hace computable el Ejemplo A.

## C3 · Lo que YA cumple la decisión

- La distinción estructural corrección↔observación nueva **ya existe**: una
  corrección lleva `corrigeA`, una observación nueva no.
- `proyectarSignos` **ya conserva el original** y lo marca sin borrarlo, con
  cadenas, ciclos y huérfanas probadas (E0-09 + REG-060).
- El principio «el LLM no decide hechos deterministas de seguridad» ya es
  transversal (§4 de `DECISIONES-2026-07-28.md`).
- PEEP y PIP **ya están separados** en `extraccion.ts`; falta el diálogo de
  candidatos del Nivel 2.

---

## Estado de las preguntas

| Pregunta | Estado |
|---|---|
| Q1 · benchmark de voz | ✅ **RESUELTA** — 3 capas, métricas definidas |
| Q2 · preparaciones de infusión | ✅ **RESUELTA** — jerarquía de 3 niveles |
| ICU-Q3 · corregida en cálculos | ✅ **RESUELTA** — y cierra E0-09/Q1 |
| Q4 · umbral de confirmación | ✅ **RESUELTA** — 4 niveles + antifatiga |
| **C2 · hora efectiva** | 🔴 **NUEVO** — requisito descubierto al implementar Q3 |
