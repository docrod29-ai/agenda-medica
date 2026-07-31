# DECISIONES CLÍNICAS NEXUS OS / NexusMED

**Versión de decisión:** 28 de julio de 2026
**Decide:** Dr. David Alonso Rodríguez Luna — medicina interna e infectología, médico dueño
**Alcance:** responde las 25 preguntas de `PREGUNTAS-PENDIENTES.md`
**Estatus:** DOCUMENTO CANÓNICO. El software implementa esto; no lo reinterpreta.

> Este archivo es la fuente de verdad clínica del programa Nexus OS. Ninguna
> implementación puede contradecirlo, y cualquier cambio a estos criterios exige una
> nueva decisión firmada del médico responsable, no una decisión de ingeniería.

---

## PRINCIPIOS TRANSVERSALES OBLIGATORIOS

Cinco reglas arquitectónicas que aplican a TODO el sistema, no a un módulo:

1. **Dato original ≠ interpretación derivada.**
   El dato original nunca se modifica. Se conserva `rawValue/rawAST`, y cualquier
   corrección, inferencia o regla experta genera un `effectiveValue/effectiveAST` con
   fuente, versión, fecha y explicación.

2. **No existe un `hardMaxDose` universal para todos los medicamentos.**
   El máximo puede depender de:
   `indication + route + formulation + renalFunction + hepaticFunction + age + weight +
   dosingStrategy + organism/MIC + sourceVersion`.

3. **UNKNOWN no equivale a NORMAL, SUSCEPTIBLE ni SAFE.**
   Toda regla clínica debe poder devolver:
   `PASS | WARN | BLOCK | UNKNOWN | NOT_APPLICABLE`.

4. **El LLM no decide hechos deterministas de seguridad.**
   Dosis máximas, alergias, ajuste renal, embarazo, interacciones críticas, breakpoints,
   interpretación de CMI y reglas AST se ejecutan en motores deterministas versionados.
   El LLM explica, contextualiza y razona alrededor de ellos.

5. **Toda recomendación clínica debe poder reconstruirse.**
   Se registran: datos utilizados, datos faltantes, fuentes, versión de guía, versión del
   modelo, reglas activadas, resultado del Safety Kernel y edición final del médico.

---

# BLOQUE 1 — DECISIONES QUE BLOQUEAN HOY

## 1.1 · Catálogo de dosis del adulto — REG-043

**Sí ampliarlo, pero se RECHAZA un único `maxDose` por fármaco.** Estructura correcta:

```text
MedicationDoseRule
- drugId
- population
- indication
- route
- formulation
- dosingStrategy
- usualDosePerAdministration
- usualMaxPerDose
- usualMaxPerDay
- hardMaxPerDose
- hardMaxPerDay
- renalAdjustment
- hepaticAdjustment
- weightBased
- requiresTDM
- infusionConstraints
- source
- sourceVersion
- effectiveDate
- evidenceLevel
```

**`hardMax* = null` es una respuesta VÁLIDA** cuando no existe un máximo clínico
universal. Es mucho más seguro que inventar uno.

### Catálogo inicial

| Fármaco | Uso/máximo habitual | Hard stop | Reglas obligatorias |
|---|---|---|---|
| **Cefalexina VO** | hasta 1 g/dosis; 4 g/día | 4 g/día (esquema VO convencional) | Ajuste renal |
| **Ceftriaxona IV/IM** | habitual 1–2 g/día | **4 g/día**; modelar por indicación | Límite más conservador en disfunción renal + hepática grave |
| **Cefotaxima IV/IM** | 1–2 g c/6–8 h según gravedad | **12 g/día** | Ajuste renal; indicación específica |
| **Clindamicina VO** | 300–450 mg c/6–8 h | no compartir máximo con IV | Separar VO/IV |
| **Clindamicina IV** | habitual hasta 2.7 g/día | **4.8 g/día** si se justifica | IM: no >600 mg por inyección |
| **Azitromicina** | frecuente 500 mg/día | **sin hardMax global** | Dosis única 1 g y regímenes de 2 g existen; separar por indicación |
| **TMP/SMX** | 160/800 mg c/12 h | **sin hardMax global** | PCP se calcula por TMP: 15–20 mg/kg/día; ajuste renal, K⁺, citopenias |
| **Nitrofurantoína** | 100 mg c/12 h | 100 mg/dosis · 200 mg/día (esa formulación) | Solo ITU baja; NO pielonefritis/bacteriemia |
| **Metronidazol** | 500 mg c/6–12 h | **4 g/día** | Child-Pugh C requiere reducción; separar dosis única |
| **Vancomicina IV** | por peso + AUC | **sin hardMax universal** | TDM; función renal; AUC/MIC |
| **Gentamicina** | por peso y estrategia | **sin hardMax universal** | TDM; convencional vs dosis extendida |
| **Amikacina** | convencional hasta 15 mg/kg/día | 1.5 g/día **solo** como regla del esquema convencional | TDM, función renal |
| **Meropenem** | hasta 1 g c/8 h | **sin hardMax global** | 2 g c/8 h en alta exposición/SNC; ajuste renal |
| **Prednisona** | 5–60 mg/día habitual | **null** | No existe máximo terapéutico universal |
| **Ondansetrón** | por vía/indicación | IV: **16 mg máx por dosis** | VO 24 mg dosis única en QT altamente emetógena; hepatopatía = regla aparte |
| **Difenhidramina iny.** | 10–50 mg IV/IM | **400 mg/día**; IM hasta 100 mg/dosis | IV no >25 mg/min |
| **Aciclovir** | por vía, indicación, peso, renal | **null global** | Ajuste renal obligatorio; IV requiere control renal/hidratación |
| **Hierro elemental** | por formulación e indicación | **null terapéutico global** | No usar umbral toxicológico como máximo de prescripción |
| **Salbutamol** | MDI 1–2 inh c/4–6 h; NEB 2.5 mg 3–4×/día | **null global** | Exacerbación grave/continuo = otra regla |
| **Loratadina** | 10 mg c/24 h | **10 mg/día** (uso estándar) | Modificar intervalo en disfunción renal/hepática |
| **Ranitidina pediátrica** | **entrada separada** | por formulación vigente | No reutilizar reglas históricas sin verificar producto/mercado; versionar por mercado |
| **Omeprazol pediátrico** | por edad/peso e indicación | **no un máximo pediátrico universal** | Separar ERGE, esofagitis, H. pylori, hipersecreción, formulación |

**Vancomicina:** la regla moderna es **AUC-guided**, no «máximo X mg». Para MRSA grave el
consenso ASHP/IDSA/PIDS/SIDP recomienda **AUC/MIC 400–600 mg·h/L**, asumiendo MIC 1 mg/L
por microdilución. El trough aislado no es el objetivo primario.

**Aminoglucósidos:** `weightBased=true` y `requiresTDM=true`. En amikacina, 15 mg/kg/día y
1.5 g/día son del esquema convencional de etiquetado; **no** deben convertirse en regla
universal que invalide protocolos de dosis extendida.

**Priorización de implementación:** `riesgo de daño × frecuencia de uso × complejidad de
dosificación` — no solo número de recetas.

---

## 1.2 · Motor de antibiograma — E0-15

### a) Propagación EUCAST S→R — **SÍ, OBLIGATORIAMENTE EN TODAS LAS SALIDAS**

Si una regla experta válida modifica la interpretación AST, esa pasa a ser la
**interpretación clínica canónica** para: UI, nota clínica, prompt al LLM, validador,
PK/PD, recomendaciones, exportación, alertas y auditoría.

**Pero no se destruye el resultado original:**

```text
rawAST:
  interpretation: S
  source: laboratorio
effectiveAST:
  interpretation: R
  reason: EUCAST_EXPERT_RULE_x
  sourceVersion: EUCAST_x.x
```

En pantalla:
> Resultado de laboratorio: S
> Interpretación Nexus: R por regla experta EUCAST [regla/versión].

> **Nunca debe existir una pantalla donde Nexus muestre R y el LLM siga razonando con S.
> Eso es un defecto de seguridad P0.**

### b) «Dato ausente ≠ resistente» — **SÍ, CAE A INDETERMINADO, NO A MBL**

Un antimicrobiano no probado no puede convertirse artificialmente en R. Una *E. coli*
ertapenem-R / meropenem-S con imipenem no informado **no demuestra una MBL**.

Debe expresarse:
> Fenotipo de resistencia a carbapenémicos que requiere caracterización. Mecanismo de
> carbapenemasa indeterminado; confirmar mediante pruebas fenotípicas y/o moleculares
> según disponibilidad.

```text
MISSING != R
MISSING != S
MISSING -> UNKNOWN

carbapenemResistanceSuspected = true
carbapenemaseConfirmed = false
carbapenemaseClass = UNKNOWN
```

Nexus **no debe generar aislamiento, NOM-045 ni clasificación MBL exclusivamente a partir
de un dato faltante.** Las medidas de control derivan del microorganismo/mecanismo
realmente identificado y de la política institucional.

### c) CMI censurada — **SÍ, CONFIRMADO**

Una CMI es un **intervalo**, no un número:

```text
operator: ">"
value: 2
unit: mg/L
```

`>2 mg/L` significa que el valor real pertenece a `(2, +∞)`. Por tanto, si
`2 >= susceptibleUpperBreakpoint`, **S es matemáticamente imposible**.

Nunca `parse(">2") -> 2`. Debe ser `parse(">2") -> {operator: GT, value: 2}`.
Igual para `<`, `≤`, `≥`.

> **Esta regla vive en el parser AST, ANTES del motor CLSI/EUCAST.**

### d) Carbapenémicos y alergia a penicilina — **PRECAUCIÓN, no crítica por defecto**

Con historia de alergia a penicilina aislada, el carbapenémico **no se bloquea
automáticamente**. La evidencia moderna encuentra reactividad cruzada **<1%**; el
parámetro de práctica AAAAI/ACAAI 2022 reporta ~0.87% en metaanálisis y admite
carbapenémicos sin testing previo en la mayoría de historias de alergia a
penicilina/cefalosporina.

**WARN:** urticaria/anafilaxia remota a penicilina sin alergia conocida al carbapenémico ·
historia poco caracterizada · múltiples alergias medicamentosas.

**BLOCK / valoración especializada:** alergia documentada al propio carbapenémico ·
SJS/TEN · DRESS · AGEP grave · nefritis/hepatitis u otra reacción inmunológica grave
atribuida a β-lactámicos.

---

## 1.3 · REG-014, REG-015, REG-017

### REG-014 — firma médica: **SÍ, SEPÁRALA**

Fichero de firma privado · acceso solo desde servicio de firmado/impresión autorizado ·
permisos por rol · URL no permanente · auditoría de cada acceso · **jamás enviarla al SDK
general** · el documento firmado guarda `signerId`, fecha/hora, hash del contenido y
versión. **Idealmente el frontend nunca recibe el archivo original de firma.**

### REG-015 — cobros: **SÍ, ENDURECER INMEDIATAMENTE**

```text
createdBy = UID autenticado del servidor
amount >= 0
currency = MXN/etc explícita
paymentType
idempotencyKey
createdAt servidor
authorizedBy
```

No mezclar email y UID como identidad. Devolución/nota de crédito/ajuste:
**no usar cantidades negativas para simularlas** — crear tipos transaccionales separados
`PAYMENT | REFUND | CREDIT | ADJUSTMENT` con trazabilidad a la operación original.

### REG-017 — nota que nace firmada: **SÍ, TODA NOTA NACE EN DRAFT**

```text
DRAFT -> SIGNED -> ADDENDUM
```

La firma es una acción explícita autenticada. Tras `SIGNED`: contenido original inmutable,
corrección por addendum, guardar hash + firma + identidad + timestamp + versión.
Única excepción: importación/migración histórica, marcada como tal, que **nunca** debe
parecer una firma creada nativamente en Nexus.

---

# BLOQUE 2 — DATOS DE REFERENCIA

## 2.1 · Vocabulario — E1-02: **PROPIO CANÓNICO + MAPEOS ESTÁNDAR**

El ID interno **no** debe ser directamente ICD-10 ni LOINC.

```text
NexusConceptID · canonicalName · semanticType · aliases[] · externalMappings[]
unitDimension · specimen · method · locale · version · reviewedBy
```

Mapeos: **LOINC** (laboratorios/observaciones) · **UCUM** (unidades) · **SNOMED CT**
(conceptos clínicos, donde la licencia lo permita) · **ICD-10** (clasificación
administrativa, **no** ontología clínica primaria) · **RxNorm/ATC** (fármacos, según
mercado y licencia).

```text
NEXUS_LAB_SERUM_CREATININE
aliases: creatinina · Cr · creat · creatinina sérica · Cr sérica · SCr
```

**No fusionar automáticamente** creatinina sérica, creatinina urinaria y aclaramiento de
creatinina: no son el mismo concepto. Los sinónimos reales se enriquecen con dictados de
uso real, tras desidentificación y **revisión humana antes de entrar a producción**.

## 2.2 · BASAL — E1-06: **NO HAY DEFINICIÓN UNIVERSAL. `BaselinePolicy` por variable**

### Creatinina — jerarquía

1. Valor marcado por el médico como basal estable.
2. Si no existe: valores ambulatorios estables previos, idealmente **7–365 días** antes,
   excluyendo AKI, hospitalización aguda y diálisis; medida robusta (mediana).
3. En enfermedad renal progresiva o contexto perioperatorio, el **último valor estable
   reciente** puede representar mejor al paciente que una mediana anual.
4. Sin información previa fiable → **basal desconocido**.

No inventar una creatinina basal mediante eGFR supuesto sin señalar explícitamente que es
una estimación. Para AKI, mantener las **ventanas temporales KDIGO**, no solo el basal anual.

### Hemoglobina
Valores clínicamente estables, excluyendo sangrado activo, transfusión reciente,
hospitalización aguda, hemólisis o intervención que altere el valor artificialmente.

### Peso seco
Concepto clínico (peso euvolémico establecido clínicamente), **no** una mediana matemática.

### Todo basal guarda
```text
value · date · method · confidence · valuesUsed[] · excludedValues[] · clinicianConfirmed
```

## 2.3 · Safety Kernel — E4-02: **TODOS LOS VERIFICADORES CORREN SIEMPRE**

Lo que cambia es si devuelven `PASS | WARN | BLOCK | UNKNOWN | N/A`.

| Verificador | BLOCK | WARN / UNKNOWN |
|---|---|---|
| **Alergia** | alergia confirmada al fármaco; reacción grave relevante | reacción incierta, intolerancia, cross-reactivity baja |
| **Función renal** | falta dato indispensable en fármaco renal de alto riesgo; dosis excede regla renal | función renal antigua/incierta |
| **Función hepática** | contraindicación o dosis imposible según hepatopatía | ajuste posible / estado incompleto |
| **Edad** | contraindicado para la edad; falta edad si la dosificación depende de ella | precaución geriátrica/pediátrica |
| **Peso** | falta peso en dosis obligatoriamente ponderal | peso antiguo o unidad dudosa |
| **Embarazo** | fármaco contraindicado/alto riesgo con estado gestacional no resuelto | riesgo dependiente de trimestre o evidencia incierta |
| **Interacción** | combinación contraindicada o daño grave predecible | interacción manejable/monitorizable |
| **Duplicidad** | duplicación peligrosa sin justificación | duplicidad de clase potencialmente intencional |
| **Máximo de dosis** | > `hardMax` contextual | > `usualMax` pero ≤ `hardMax` |
| **PK/PD** (antimicrobianos) | régimen incapaz de alcanzar objetivo, o microorganismo R sin justificación validada | I / «susceptible increased exposure», MIC faltante |
| **Formulario** | puede bloquear **la orden**, nunca convertir la evidencia en «contraindicado» | no disponible / no preferido |

> **Regla fundamental:** la ausencia de un dato crítico debe impedir una AFIRMACIÓN DE
> SEGURIDAD, no necesariamente impedir toda recomendación.
> Ejemplo: vancomicina sin creatinina actual → Nexus puede decir que es una opción
> conceptual, pero **no puede validar como segura una dosis definitiva**.

## 2.4 · Medication Intelligence — E4-04: **RIESGO × FRECUENCIA, ~30 fármacos**

vancomicina · gentamicina · amikacina · ceftriaxona · cefepime · ceftazidima ·
piperacilina/tazobactam · meropenem · ertapenem · TMP/SMX · linezolid · daptomicina ·
fluoroquinolonas · azitromicina · metronidazol · clindamicina · aciclovir · fluconazol ·
voriconazol · anfotericina B · anticoagulantes · insulina · opioides · potasio · magnesio ·
corticosteroides · antiarrítmicos seleccionados · diuréticos · IECA/ARA-II/ARNI · fármacos
de estrecho margen terapéutico.

> **30 extraordinariamente bien modelados** valen más que 5000 superficiales.

---

# BLOQUE 3 — JERARQUÍA DE EVIDENCIA

## 3.1 · Qué fuente pesa más — E2-03

«guía > meta-análisis > RCT > cohorte» es **demasiado simple**. Nexus evalúa
**autoridad + calidad metodológica + aplicabilidad + actualidad**.

- **Nivel 0 — Reglas normativas/deterministas específicas de la pregunta:** regulación
  sanitaria, alertas regulatorias, ficha técnica vigente, CLSI/EUCAST para AST, normas
  técnicas. *(No significa que la ficha técnica sea el tratamiento óptimo; es la fuente de
  verdad para aquello que regula.)*
- **Nivel 1 —** Guías clínicas contemporáneas de alta calidad (GRADE, población aplicable).
- **Nivel 2 —** Revisiones sistemáticas/meta-análisis de buena calidad.
- **Nivel 3 —** RCTs bien diseñados, sobre todo posteriores a la guía.
- **Nivel 4 —** Observacionales, cohortes, casos-control.
- **Nivel 5 —** Series/reportes de casos.
- **Nivel 6 —** Opinión experta.

**El formulario NO supera a la evidencia científica**; define qué puede ejecutarse
localmente. En cambio, una guía local/PROA bien hecha y un antibiograma institucional
reciente **sí** pueden cambiar la terapia empírica preferida, porque incorporan
epidemiología local. Tres conceptos distintos:

```text
evidenceIdealChoice · localEpidemiologyAdjustment · localFormularyExecutableChoice
```

## 3.2 · Guías discordantes — E2-04: **MOSTRAR Y ADJUDICAR EXPLÍCITAMENTE**

No escoger silenciosamente «la más nueva».

Orden para adjudicar: aplicabilidad a este paciente → calidad metodológica/certidumbre →
especialidad y ámbito → outcome que busca mejorar → actualidad → epidemiología local →
disponibilidad.

Si persiste discrepancia clínicamente relevante: **«No existe consenso entre guías»**, y
la confianza **no puede ser alta**.

## 3.3 · Fuera de población — E2-08: **DECLARAR TODA DESVIACIÓN QUE MODIFIQUE BENEFICIO, RIESGO O DOSIS**

Edad fuera de rango · embarazo/lactancia · TFG fuera del rango estudiado · diálisis/CRRT ·
hepatopatía grave · neutropenia · trasplante · inmunosupresión · microorganismo/resistencia
diferente · sitio de infección diferente · ausencia de control de foco · prótesis/dispositivo ·
gravedad distinta · UCI/choque · tratamiento previo relevante.

> Evidencia indirecta: el RCT excluyó pacientes con TFG <30 mL/min/1.73 m²; este paciente
> tiene 18. La recomendación representa extrapolación.

No interrumpir por diferencias demográficas sin plausibilidad de modificar la intervención.

## 3.4 · Evidence Watch — E2-09

**Interrumpe solo si:** guía nueva que cambia conducta en un problema activo · alerta
regulatoria grave sobre un tratamiento activo · cambio CLSI/EUCAST que modifica la
interpretación de un aislamiento activo · RCT fase III practice-changing y aplicable ·
recall/desabasto que haga inseguro o imposible el tratamiento actual.

**Meta-análisis:** solo si cambia sustancialmente la certeza, resuelve una controversia
importante o contradice una práctica activa con evidencia fuerte.

Todo lo demás → **digest semanal**.
**Regla de UX: máximo una alerta no crítica por problema clínico en 24 h.** Las de
seguridad crítica quedan excluidas de ese límite.

---

# BLOQUE 4 — INCERTIDUMBRE Y EVALUACIÓN

## 4.1 · «Confianza alta» — E3-05

**No usar «el modelo está 94% seguro»** — no tiene significado clínico validado.
**Clinical Confidence Score** interno, solo para clasificación, nunca presentado como
probabilidad de verdad.

| Dominio | Peso |
|---|---:|
| Calidad/certidumbre y aplicabilidad de evidencia | 25% |
| Calidad de los datos del paciente | 20% |
| Completitud de datos críticos | 20% |
| Acuerdo entre fuentes independientes | 15% |
| Actualidad de evidencia/datos | 10% |
| Concordancia entre agentes/motores | 10% |

**Clasificación:** 85–100 alta · 70–84 moderada · 50–69 baja · <50 insuficiente.

### Veto gates
Aunque el puntaje sea 95, **no puede ser «alta»** si falta un dato crítico para la
afirmación concreta: identidad del medicamento o unidad ambigua · peso ausente en dosis
ponderal · función renal ausente cuando la seguridad depende de ella · embarazo desconocido
ante fármaco de riesgo · antecedente alérgico grave sin caracterizar · CMI/AST ausente
cuando se afirma susceptibilidad · hemodinámica ausente al clasificar choque.

### Sepsis sin cultivo
**No bajar automáticamente toda recomendación de sepsis a «insuficiente».** El tratamiento
empírico existe precisamente antes de conocer el microorganismo:
- confianza en **patógeno específico** = insuficiente;
- confianza en la **necesidad de terapia empírica** según síndrome/riesgo = puede ser alta;
- indicar obtención de cultivos cuando no retrase intervenciones urgentes.

### Concordancia entre agentes
> Diez agentes repitiendo el mismo error **no son diez fuentes independientes.**

El 10% de *agent agreement* nunca compensa evidencia baja, dato crítico ausente o conflicto
con el Safety Kernel.

## 4.2 · NexusBench — E7-02 / E7-03

**Fase 0:** 15 casos (detectar fallas obvias de arquitectura) · **Fase 1:** 50 casos ·
**Fase 2:** 100–200+ antes de usarlo como argumento serio de desempeño.

```text
caseId · clinicalFacts · criticalInputs · distractors · goldAnswer
acceptableAlternatives[] · dangerousAnswers[] · mustNotMiss[] · mustAskFor[]
abstentionExpected · references[] · sourceVersions[] · specialty · difficulty · riskClass
```

**Variantes adversariales por caso:** dato ausente · unidad equivocada · alergia · embarazo ·
TFG baja · peso en libras vs kg · laboratorio incompatible · información contradictoria ·
resultado microbiológico censurado · medicamento no disponible.

**Dos evaluaciones separadas:** (A) motor determinista → se espera **100%** de corrección
de la regla; (B) LLM → razonamiento, interpretación, grounding y abstención.

## 4.3 · Panel ciego — E7-06

**5–7 evaluadores**, ≥3 evaluaciones independientes por caso. Panel base: infectología ·
medicina interna/hospitalaria · medicina crítica/anestesiología · urgencias · farmacia
clínica/PROA · especialista de la unidad evaluada · seguridad/calidad clínica.

Para pediatría, gineco-obstetricia o cirugía: incorporar al especialista correspondiente —
**no** permitir que un panel exclusivamente internista valide esas ramas.

**Por release candidate:** 30–50 casos ciegos + benchmark automático completo. Los casos de
seguridad P0/P1 se corren **en cada release**. El evaluador no sabe modelo, proveedor,
versión, ni si la respuesta es humana o IA.

---

# BLOQUE 5 — HOSPITAL Y UCI

## 5.1 · Priorización Nexus Rounds — E8-04

> **NO una simple suma de NEWS2 + SOFA + lactato.** Puede ser matemáticamente elegante y
> clínicamente falsa.

**NIVEL 0 — OVERRIDES (van primero, sin importar el score):** paro/deterioro vital
inmediato · compromiso de vía aérea · deterioro neurológico agudo grave · inicio o
escalamiento significativo de vasopresores · hipotensión refractaria · nueva ventilación
invasiva o deterioro respiratorio rápido · hipoperfusión/lactato muy elevado o en ascenso ·
hemorragia mayor activa · emergencia neurológica/cardiovascular/quirúrgica · **cualquier
llamada del equipo asistencial por deterioro no explicado**.

**NIVEL 1 — Deterioro fisiológico (tendencias):** NEWS2 alto o en aumento · delta SOFA ·
nueva disfunción orgánica · más requerimiento de O₂ · oliguria · deterioro del estado
mental · tendencia de lactato · nueva necesidad de soporte de órgano.
*NEWS2 es herramienta de escalamiento, no sustituto del juicio clínico.*

**NIVEL 2 — Eventos nocturnos:** fiebre/hipotensión · arritmia · caída · transfusión ·
cultivo crítico · nueva imagen · rapid response · nuevo antimicrobiano · procedimiento
pendiente.

**NIVEL 3 — Desempate** (solo para ordenar dentro de la misma prioridad; piloto):
30% cambio/soporte de órganos · 25% deterioro fisiológico · 20% perfusión/lactato ·
15% delta SOFA · 10% eventos críticos recientes.

> Esos pesos son **un modelo de ingeniería a validar prospectivamente**, no una escala
> clínica validada.

Nexus debe mostrar: *«Prioridad 1 porque inició norepinefrina hace 40 min y el lactato
subió de 2.1 a 4.0 mmol/L»* — no *«prioridad 1 porque la IA lo decidió»*.

## 5.2 · Antibiograma institucional — E8-05

**≥30 aislamientos por especie/estrato** como umbral estándar (CLSI M39). Reglas: primer
aislamiento relevante por paciente en el periodo · aislamientos diagnósticos, no duplicados
sin criterio · resultados finales verificados · producción al menos anual · **mostrar `n`
siempre**.

**Estratificar** (hospital general · UCI · piso · urgencias · ± población · ± sitio) **solo
con n suficiente**. UCI con n=8 no puede mostrar «62.5% susceptible» con el mismo peso
visual que n=240. Si `n < 30`: etiquetar baja precisión · mostrar IC cuando sea posible ·
considerar agregar 2–3 años si la epidemiología es comparable · o usar estrato más amplio.

**Ventana:** 12 meses por defecto, actualización al menos anual. Organismos raros pueden
usar periodo mayor con indicación explícita del intervalo.

## 5.3 · Memoria institucional — E5-04: **EL FORMULARIO LIMITA LA EJECUCIÓN, NO REESCRIBE LA CIENCIA**

> Tratamiento preferido según evidencia: X. X no está disponible en este hospital.
> Mejor alternativa disponible: Y. Motivo: …

En emergencia, la acción primaria es **la mejor opción realmente ejecutable**, sin retrasar
terapia porque el fármaco ideal no exista. Si la diferencia clínica es importante: sugerir
mecanismo de adquisición/uso excepcional/interconsulta con PROA.

**Nunca:** «X no está en el formulario, por lo tanto Y es equivalente».

---

# BLOQUE 6 — APRENDIZAJE Y REGULACIÓN

## 6.1 · Resultado ≠ causalidad — E6-02

**Outcomes a registrar según síndrome:** cultivo posterior · susceptibilidad · tiempo a
tratamiento activo · tiempo a desescalamiento · control de foco · creatinina/AKI · niveles
farmacológicos/AUC · efectos adversos · *C. difficile* · transferencia a UCI · estancia ·
reingreso 7/30 días · mortalidad · recurrencia · cambios de tratamiento.

```text
recommendation -> outcome   NO significa   recommendation CAUSED outcome
```

Uso inicial: vigilancia de seguridad · calibración · análisis de errores · revisión clínica ·
generación de hipótesis · evaluación de procesos. **Nunca aprendizaje online autónomo.**

Un outcome entra al dataset de entrenamiento solo tras adjudicación, validación,
contextualización, control de confusores y aprobación clínica.

## 6.2 · Quién aprueba — E6-04: **CLINICAL CHANGE CONTROL BOARD**

> **Ningún cambio clínico de producción depende de una sola persona.**

Composición según el cambio: Clinical Product Owner · especialista del dominio ·
farmacéutico clínico (medicamentos) · microbiólogo (AST) · ingeniería/ML · seguridad/calidad ·
regulación/QA (funciones reguladas).

**Mínimo: dos aprobaciones clínicas independientes** para reglas de impacto clínico.
Cambios P0/P1 o regulados → comité formal.

**Evidencia requerida:**
- *Estándar determinista (CLSI/EUCAST):* fuente oficial vigente · versión · diferencia vs
  versión previa · unitarias · integración · regresión · rollback.
- *Guía clínica:* texto completo · fuerza de recomendación · calidad de evidencia ·
  población · conflicto con otras guías · test en NexusBench.
- *Modelo:* benchmark preespecificado · tasa de errores peligrosos · must-not-miss ·
  subgroup performance · alucinaciones/citas falsas · adversariales · evaluación humana ·
  rollback · plan de monitorización.

> NexusMED **no** aprende directamente en producción de «aceptar/corregir/rechazar».
> Ese feedback crea un **candidato a mejora**, no una nueva regla clínica.

## 6.3 · Intended use y frontera CDS — E9-03

### Declaración oficial

> **NexusMED es una plataforma de apoyo a la decisión clínica dirigida a profesionales
> sanitarios cualificados. Integra, estructura y resume información clínica; recupera y
> contextualiza evidencia; identifica posibles riesgos y discrepancias; y genera opciones
> diagnósticas y terapéuticas explicables para revisión independiente por el profesional.
> NexusMED no sustituye el juicio clínico ni ejecuta de forma autónoma diagnósticos,
> prescripciones, órdenes, triage o tratamiento.**

### Funciones diseñadas como CDS REVISABLE
resumen de historia · organización de problemas · búsqueda de evidencia · comparación de
guías · diferencial explicable · sugerencias diagnósticas · opciones terapéuticas ·
explicación de interacciones · información farmacológica · visualización de tendencias ·
contextualización del antibiograma · recordatorios/bundles con fundamento verificable.

Para conservar esa frontera, Nexus debe mostrar: datos utilizados · datos faltantes ·
población a la que aplica la evidencia · fuente · versión · lógica relevante · limitaciones ·
fundamento. Coincide con la guía final de FDA sobre *Clinical Decision Support Software*
(enero 2026): el profesional debe poder **revisar independientemente la base**, no confiar
en una conclusión opaca.

### Funciones tratadas desde el diseño como CANDIDATAS A SaMD
dosificación individualizada con régimen preciso · vancomicina AUC · aminoglucósidos ·
dosis renal/CRRT/ECMO · detección automática de sepsis · predicción de deterioro ·
«¿a quién veo primero?» · scores que desencadenan acciones · alarmas UCI en tiempo real ·
recomendaciones de vasopresores · ventilación mecánica · ECMO · CRRT/PRISMA · análisis
automatizado de señales · análisis de imágenes · interpretación automatizada de datos IVD ·
cualquier salida time-critical sin oportunidad razonable de revisión · cualquier orden o
modificación terapéutica autónoma.

> **No intentar «redactar alrededor» de la regulación.** Clasificar función por función.

```text
Nexus platform
├── Documentation / workflow
├── Evidence CDS
├── Explainable clinical CDS
├── Safety Kernel
└── Regulated-candidate clinical functions
```

### Mercados
1. México → 2. LatAm país por país → 3. Estados Unidos → 4. Unión Europea

México **no** es un mercado sin regulación de software médico. La **NOM-241-SSA1-2025**
(vigente desde 30-nov-2025) define el **Software como Dispositivo Médico (ScDM)**, incluye
apps móviles con propósito médico y exige validación de diseño/desarrollo y del propio
ScDM, documentación técnica, y demostrar que los inputs se procesan correctamente y los
outputs son exactos, íntegros y precisos. También exige controles de acceso, integridad,
respaldo y validación de sistemas computacionales que impacten la calidad del dato.

### Disciplina exigida desde HOY
QMS · gestión de riesgos · design controls · requirements traceability · V&V · versionado ·
change control · audit log inmutable · provenance de evidencia · provenance de modelo ·
validación clínica · ciberseguridad · control de acceso · backup/DR · rollback ·
post-market monitoring · identificación de versión visible.

### DECISIÓN FINAL E9-03

> **Diseñar NexusMED desde este momento como una plataforma clínica modular con controles
> de calidad de nivel SaMD**, aunque algunas funciones individuales puedan clasificarse
> jurídicamente como CDS no dispositivo en determinados mercados.

Es muchísimo más barato sobrediseñar la trazabilidad hoy que reconstruirla cuando Nexus ya
tenga pacientes reales, cientos de reglas clínicas, múltiples modelos, cinco hospitales,
decenas de versiones y millones de inferencias.

---

# RESUMEN EJECUTIVO PARA IMPLEMENTACIÓN

| ID | Decisión |
|---|---|
| REG-043 | Sustituir `maxDose` por reglas contextuales multidimensionales |
| E0-15a | `effectiveAST` debe propagarse a todas las salidas |
| E0-15b | dato ausente = UNKNOWN; jamás inferir MBL por ausencia |
| E0-15c | preservar operador de CMI; `>X` nunca se convierte en X |
| E0-15d | carbapenémico + alergia a penicilina = WARN, salvo excepciones graves |
| REG-014 | aislar firma y servirla solo vía servicio autorizado |
| REG-015 | UID server-side + validación de monto + transacciones tipadas |
| REG-017 | todas las notas nacen DRAFT |
| E1-02 | NexusConceptID + LOINC/SNOMED/ICD/UCUM como mapeos |
| E1-06 | baseline específico de analito/contexto |
| E4-02 | Safety Kernel siempre ejecutado con PASS/WARN/BLOCK/UNKNOWN/N/A |
| E4-04 | Medication Intelligence por riesgo × frecuencia |
| E2-03 | evidencia multidimensional, no ranking lineal simple |
| E2-04 | mostrar discordancia y adjudicación explicable |
| E2-08 | declarar extrapolación clínicamente relevante |
| E2-09 | Evidence Watch interruptivo solo para cambios accionables |
| E3-05 | confianza clínica compuesta + veto gates |
| E7-02/03 | 15 casos solo Fase 0; expandir benchmark |
| E7-06 | 5–7 expertos; ≥3 evaluaciones/caso |
| E8-04 | Rounds con hard overrides + ranking secundario |
| E8-05 | ≥30 aislados como umbral estándar; estratificar solo con n suficiente |
| E5-04 | formulario restringe ejecución, no evidencia |
| E6-02 | outcomes para vigilancia/revisión, no causalidad ni autoaprendizaje |
| E6-04 | Clinical Change Control Board |
| E9-03 | arquitectura modular SaMD-grade desde hoy |

---

# REGLA ESPECIAL DE MICROBIOLOGÍA

Al 28-jul-2026 el motor debe trabajar con una **versión explícita** de su estándar:
CLSI publicó **M100 36.ª edición el 26-ene-2026** (reemplaza Ed35) y EUCAST tiene
**Clinical Breakpoint Tables v16.1**, vigentes desde el 24-jun-2026.

> Por derechos de autor y por seguridad, **NO copiar manualmente breakpoints CLSI desde
> respuestas de IA al código.** Nexus debe usar una fuente CLSI autorizada/licenciada.

```text
standard: CLSI · edition: M100-Ed36 · effectiveDate
organism · antimicrobial · method · site · breakpoint · footnotes · sourceHash/version
```

EUCAST sigue la misma arquitectura, aunque sus tablas puedan obtenerse de sus recursos
oficiales.

---

# PRINCIPIO FINAL

> **La IA puede razonar.
> El Safety Kernel debe comprobar.
> La evidencia debe citarse.
> El médico debe poder revisar.
> Y el sistema debe saber cuándo no sabe.**
