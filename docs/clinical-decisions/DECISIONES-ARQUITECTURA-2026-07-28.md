# DECISIONES DE ARQUITECTURA — Nexus OS completo

**Versión de decisión:** 28 de julio de 2026
**Decide:** Dr. David Alonso Rodríguez Luna — médico dueño
**Responde:** las ~30 preguntas de `PREGUNTAS-TODO-EL-PROGRAMA.md` (bloques A → J)
**Estatus:** DOCUMENTO CANÓNICO. El software implementa esto; no lo reinterpreta.

> Complementa a `DECISIONES-2026-07-28.md` (las 25 decisiones clínicas). Donde una
> respuesta dependía de un dato que solo el Dr. puede aportar, se define el
> **comportamiento seguro por defecto** para que el desarrollo no se detenga.

---

## ⚠️ INVARIANTE TRANSVERSAL — el más importante de todo el documento

> **Ningún dato clínico debe guardar únicamente «valor».** Toda regla susceptible de
> cambiar —dosis, score, breakpoint, guideline, algoritmo— debe guardar también
> **fuente, versión, fecha de vigencia y versión del motor** que produjo la decisión.

Ejemplo vivo a julio 2026: EUCAST pasó a **v16.1** el 24-jun-2026 y CLSI M100 está en
**Ed36** desde enero. Sin versionado, un resultado correcto hoy es imposible de auditar
dentro de dos años.

---

# BLOQUE A — E0

## A1 · Unidades — APROBADO con ampliación + **UCUM**

`ClinicalQuantity` NO es una lista de strings:

```ts
interface ClinicalQuantity {
  value: number
  unitCode: string       // UCUM
  unitDisplay: string    // lo que ve el médico
  dimension: string      // mass, volume, pressure…
  sourceUnit?: string    // conserva lo capturado/importado
}
```

**Catálogo mínimo desde E0:**

- **Masa:** mcg · mg · g · kg · lb
- **Volumen:** mL · L
- **Longitud/superficie:** cm · m · m²
- **Dosificación:** mcg/kg · mg/kg · g/kg · mcg/kg/min · mcg/kg/h · mg/kg/h ·
  mg/kg/día · g/kg/día · mg/m² · mg/m²/día · UI/kg · UI/kg/h · mEq/kg
- **Infusiones:** mcg/min · mg/min · mg/h · mL/h · UI/h · mEq/h
- **Concentraciones:** mcg/mL · mg/mL · mg/L · g/L · ng/mL · pg/mL · mg/dL · g/dL ·
  mmol/L · µmol/L · mEq/L · UI/mL · copias/mL · células/µL · 10³/µL · 10⁹/L
- **Función renal/flujos:** mL/min · mL/min/1.73m² · mL/kg/h · L/min · L/min/m²
- **Presión:** mmHg · cmH₂O · kPa
- **Fisiología:** °C · lpm · rpm · % · mOsm/kg
- **Otras:** UI · mEq · mmol · kcal · kcal/kg/día

**Reglas:**
- pH, INR, scores y relaciones son **adimensionales**, no unidades inventadas.
- **`lpm` no puede significar dos cosas.** Frecuencia cardiaca y flujo de oxígeno
  necesitan semántica distinta aunque el médico vea la misma abreviatura.
- **Vía y frecuencia NO son unidades**: VO/IV/IM/SC, c/8 h, BID… son campos separados.
- Se conserva la capa de seguridad kg/lb ya existente: conversión explícita, detección
  de discordancia ≈×2.2046 y bloqueo hasta confirmar, **sin asumir** que un peso alto
  venía en libras.

## A2 · Matriz de roles — CERRADO

| Rol | Agenda | Contacto | Nota clínica | Medicamentos/órdenes | Cobros | Config |
|---|---|---|---|---|---|---|
| Recepción | editar | editar | **NO** | **NO** | crear/ver | no |
| Enfermería | ver | mínimo necesario | **ver completa** del episodio asignado | ver + MAR + órdenes de enfermería | no | no |
| Farmacia | generalmente no | **NO** | solo contexto clínico necesario | ver/validar | no | no |
| Laboratorio | no | mínimo | **NO** | órdenes + datos relevantes | no | no |
| Médico | todo de sus pacientes | sí | todo | todo | según permiso | clínica |
| **Admin no médico** | operativo | sí | **NO** | NO salvo métricas administrativas | todo | administrativa |
| Dueño médico | rol médico + admin | sí | sí | sí | sí | sí |

**Las dos que bloqueaban:**

- **Admin no médico: NO lee notas clínicas.** Ser dueño o administrador no convierte a
  nadie en personal asistencial. Si además es médico, **dos roles separados**:
  `ADMIN` + `PHYSICIAN`.
- **Enfermería: SÍ lee la nota completa**, pero solo con **relación asistencial** con el
  paciente/episodio, en modo lectura. Necesita contexto para administrar medicamentos,
  ver alergias, ejecutar cuidados y detectar deterioro; **limitarla a signos vitales
  puede ser clínicamente peligroso**.
- **Farmacia necesita más que «solo medicación»**: alergias, peso, función renal/hepática,
  indicación, microbiología y laboratorios pertinentes para validar una prescripción.
  No acceso indiscriminado al expediente.

**Agregar `BREAK_GLASS`:** razón obligatoria · paciente específico · duración limitada ·
usuario · fecha/hora · auditoría reforzada · alerta al responsable.

*(NOM-024 contempla control de acceso por rol a nivel de módulos, expedientes, formatos y campos.)*

## A3 · Append-only — DEFAULT AMPLIADO

**Regla superior: cualquier dato clínico FINALIZADO/FIRMADO es append-only.** Edición
libre mientras sea `draft`; después de firmar: sin UPDATE destructivo, sin DELETE físico,
corrección = nueva versión/adenda, original conservado.

Incluye: notas médicas y de enfermería firmadas · prescripción, modificación y suspensión
de medicamentos · MAR · alergias e intolerancias · signos vitales · órdenes · resultados
de laboratorio, microbiología e imagen · resultados críticos y quién los recibió ·
correcciones de resultados · diagnósticos/problemas y cambios de estado · ingreso, alta y
traslado · transfusión · procedimientos · dispositivos invasivos · ventilador, ECMO,
CRRT/PRISMA y eventos UCI · código de reanimación/limitación terapéutica · consentimientos
y rechazos · alertas clínicas importantes y overrides · firmas y adendas · fusión/corrección
de identidad · accesos break-glass · bitácora de auditoría.

## A4 · Sello de integridad — **(b) + verificador versionado permanente**

> Una nota histórica **no debe volverse «no verificable»** solo porque Nexus actualizó
> su esquema. **Nunca recalcular una firma histórica con un payload nuevo.**

```
hashVersion = 1 → notas históricas siguen VERIFICADAS-v1
hashVersion = 2 → notas nuevas incluyen preop + hospital + infectología + campos nuevos
```

En pantalla:
```
✓ Integridad verificada · Algoritmo/scope v1 · firmado 18/05/2026
✓ Integridad verificada · Algoritmo/scope v2 · firmado 29/07/2026
```

Guardar mínimo: `hashAlgorithm · hashVersion · payloadSchemaVersion · payloadHash ·
signedAt · signedBy · previousHash?`

## A5 · Stripe — **(c) Sandbox primero**

El defecto es serio: **«recibido» ≠ «procesado»**.

```
RECEIVED → PROCESSING → PROCESSED
                     ↘ FAILED → retry
```

La fila de idempotencia **no debe declarar completado el evento antes de que la
transacción de negocio haya terminado.** Además: `event.id` único · operación DB
transaccional · `PROCESSED` solo tras el commit · duplicado ya procesado → 2xx sin
volver a aplicar · fallo real → no marcar procesado · reconciliación periódica contra
Stripe · no depender del orden de eventos.

*(Stripe advierte que los webhooks pueden duplicarse, no garantiza orden y reintenta hasta tres días.)*

## A6 · CSP — **(a)**, gradual

`report-only` → eliminar orígenes innecesarios → reducir `unsafe-eval` → migrar inline a
nonce/hash → enforce en staging → smoke tests → canary → enforce global.
**No activar CSP estricta «a ver qué se rompe».**

---

# BLOQUE B — E1 · Patient Clinical Graph

## B1 · Vocabulario — léxico existente + aprendizaje SUPERVISADO

No partir de ~50 términos: la biblioteca actual ya tiene ~196,949 registros, 141
abreviaturas clínicas y 56 entradas de unidades/vías/frecuencias.

```
concepto canónico
 ├── alias escrito
 ├── alias hablado
 ├── abreviatura
 ├── error de STT frecuente
 └── variante regional
```

**El alias nunca sustituye al identificador canónico.** Laboratorio → **LOINC** cuando
exista; unidades → **UCUM**.

Equivalencias aprendidas del dictado: `observada → propuesta → revisión → aprobada`.
**Nunca aprendizaje automático directo a producción.**

## B2 · Basales — DEFAULT MODIFICADO

| Variable | Definición |
|---|---|
| HbA1c | último valor válido, con fecha |
| TA | mediana de las últimas 3 mediciones ambulatorias válidas |
| **Peso para dosis** | **peso actual medido** |
| **Peso basal** | último peso clínicamente estable — **separado** del actual |
| LDL actual | último valor válido |
| **LDL pretratamiento** | campo **separado**, solo si realmente existe |
| Plaquetas basal | mediana de hasta 3 valores estables previos, ventana 12 meses |
| **Plaquetas actual** | último valor; **para decisiones agudas nunca sustituir por el basal** |
| TFG basal | CKD-EPI 2021 desde la creatinina basal |

**Cambio importante:** NO usar «último LDL pre-tratamiento» como definición general de
LDL basal — muchos pacientes llegan ya tratados y nunca tendrán ese valor. Guardar
`ldlCurrent` y `ldlPretreatment` por separado.

**Función renal: eGFR y CrCl NO son intercambiables.** El motor usa la métrica que
especifique el fármaco/ficha técnica/protocolo. Si una dosis se validó por
Cockcroft-Gault, **no sustituir automáticamente** por CKD-EPI.

## B3 · Problemas activos — **(a)**

Solo cuando un clínico lo marque: `resolved` · `inactive` · `entered-in-error`.
Para agudos el sistema puede **sugerir** («sin actividad documentada desde hace 60 días,
¿marcar resuelta?») pero **nunca resolver solo**. Crónicos, antecedentes, prótesis, VIH,
trasplante o neoplasia **no desaparecen** por dejar de mencionarse.

## B4 · Look-back — default, con separación

```
historicalRecord = todo
clinicalContext  = relevancia + recencia + estado activo + ventana propia del dato
```
**No mandar 20 años completos al LLM cada vez.**

---

# BLOQUE C — E4 · Safety Kernel

## C1 · Catálogo — **DEFAULT RECHAZADO para producción**

Tampoco una tabla de 30 fármacos con cuatro números universales: para varios sería
**clínicamente falsa**.

```ts
MedicationDoseProfile {
  drug · activeComponent · population · route · formulation · indication · infectionSite?
  doseMin? · doseMax? · frequency?
  usualMaxPerDose? · usualMaxPerDay? · hardMaxPerDose? · hardMaxPerDay?
  weightBased · weightScalar?
  renalMetric? · renalAdjustment? · hepaticAdjustment?
  intermittentHD? · CRRT? · ECMO?
  infusionDuration? · requiresTDM · tdmTarget? · pkpdTarget?
  source · sourceVersion · lastReviewed
}
```

**`hardMax = null` significa** «no existe un único máximo absoluto universal válido para
todos los regímenes» — **NO** «Nexus no sabe nada».

**Catálogo v1 (31):** amoxicilina · amoxicilina/clavulanato · ampicilina ·
ampicilina/sulbactam · piperacilina/tazobactam · cefazolina · cefalexina · ceftriaxona ·
cefotaxima · ceftazidima · cefepime · aztreonam · ertapenem · meropenem · clindamicina ·
metronidazol · vancomicina · linezolid · daptomicina · gentamicina · tobramicina ·
amikacina · TMP/SMX · nitrofurantoína · ciprofloxacino · levofloxacino · aciclovir ·
fluconazol · ondansetrón · difenhidramina · prednisona.

**Inmediatamente después:** ceftazidima/avibactam · ceftolozano/tazobactam · cefiderocol ·
meropenem/vaborbactam · imipenem/cilastatina/relebactam · colistina · polimixina B.

**Regla de producción:** un fármaco sin perfil validado puede buscarse y prescribirse a
mano, pero Nexus debe decir **«DOSIS NO VALIDADA POR EL SAFETY KERNEL»**. Nunca mostrar
«segura». En alto riesgo sin perfil: no autorizar *verified dose*, pedir validación humana.

**La tabla numérica es un dataset clínico VERSIONADO, no constantes dispersas en TypeScript.**

## C2 · Alcance — **(a)**
Safety Kernel único para consulta · urgencias · hospital · UCI, con **perfiles distintos
según contexto**.

## C3 · Severidades — **(a) modificada con jerarquía**

```
INFO                    → no interrumpe
CAUTION                 → aviso contextual
WARNING                 → requiere reconocer/corregir; anulable con motivo estructurado
HARD CLINICAL STOP      → no firmar sin corregir; override solo por clínico autorizado,
                          motivo obligatorio + auditoría
ABSOLUTE TECHNICAL STOP → SIN override (unidad incompatible, peso imposible sin
                          confirmar, medicamento desconocido, cálculo corrupto)
```

Los hard stops previenen errores, pero **usados indiscriminadamente producen
consecuencias no deseadas**: los sistemas de interacción muestran tasas de override muy
altas cuando las alertas son poco específicas.

---

# BLOQUE D — E2 · Evidence

## D1 · Fuentes — **no asumir ninguna suscripción no confirmada**

```
PubMed/MEDLINE · PubMed Central · Crossref · ClinicalTrials.gov
WHO · CDC · FDA/DailyMed · EMA · IDSA pública · ESCMID pública · EUCAST   → ENABLED

UpToDate · AccessMedicine · ClinicalKey · revistas de pago · CLSI        → LICENSE_UNKNOWN
```

### ⚠️ Microbiología — actualización crítica
A 28-jul-2026: **EUCAST v16.1** (publicada 24-jun-2026; las dosis siguen en v16.0) y
**CLSI M100 36.ª edición** (26-ene-2026).

> Una implementación nueva **no debería declararse actual si solo contiene M100-Ed35**.
> Si se integran tablas CLSI completas, deben existir derechos/licencia adecuados: no
> convertir una copia personal del estándar en una base comercial redistribuida.

## D2 · Presupuesto — **$0 MXN/mes** en fase inicial
Primero medir: *coverage rate* · % respuestas sin fuente suficiente · latencia ·
*freshness* · disponibilidad de texto completo · costo por consulta. Después justificar
cada licencia.

**Excepción:** si el producto hospitalario va a interpretar AST con CLSI, ese
licenciamiento es **infraestructura regulatoria/clinical data**, no una suscripción
«nice to have».

## D3 · Idioma — **(a)**
Fuentes en idioma original (predominantemente inglés), síntesis clínica en español.
Guardar título, autores y evidencia originales: **la traducción es presentación, no
fuente de verdad**.

---

# BLOQUE E — E3 · Razonamiento

## E1q · Especialistas — default aceptado
Orden: **1)** Medicina Interna · **2)** Infectología · **3)** Medicina Crítica ·
**4)** Farmacología clínica/PK-PD · **5)** Nefrología.

**No «votan».** Cada uno produce estructura: `assessment · keyEvidence · mustNotMiss ·
contraArguments · confidence · missingData · recommendation`, y un **arbiter** sintetiza
discrepancias.

Expansión: pediatría · cirugía · gineco-obstetricia · cardiología · neumología ·
hematología/oncología.

## E2q · Latencia — aceptada
Quick <5 s · Consult <30 s · Grand Rounds ≤3 min. **No aumentar rutinariamente.** Si a
los 3 min faltan fuentes: *«Análisis disponible; revisión de evidencia incompleta»*.
**Degradar transparentemente es preferible a bloquear la atención clínica.**

---

# BLOQUE F — E5/E6

## F1 · Formulario — `institutionalFormulary.status = UNCONFIGURED`
No se localizó un cuadro básico autoritativo de Star Médica. **No debe bloquear E5.**
Construir el importador: **XLSX/CSV preferidos** · API/LIS ideal después · PDF solo
fallback.

Modelo: medicamento · genérico · presentación · concentración · vía · disponibilidad ·
restricción · quién autoriza · servicio · alternativa · última actualización · fuente.

> **Nexus nunca debe inferir «disponible en el hospital» por aparecer en una guía.**

## F2 · Aprobadores
```
ClinicalOwner:                Dr. David Alonso Rodríguez Luna
IndependentClinicalReviewer:  PENDING_ASSIGNMENT
```
Regla: `approver1.userId !== approver2.userId`. **Nadie firma dos veces con roles
distintos.** Para reglas farmacológicas, microbiológicas o PK/PD, al menos un revisor
competente en esa materia.

**E6 puede desarrollarse completo.** Lo que queda cerrado es *publicar* cambios clínicos
a producción.

## F3 · Consentimiento — **(b)**
Consentimiento **explícito, separado y revocable**. No una cláusula de opt-out enterrada
en el aviso de privacidad.

*(LFPDPPP: el estado de salud es dato sensible y exige consentimiento expreso y por
escrito. La disociación verdadera es una excepción; una pseudonimización reversible NO
es automáticamente «anónima».)*

Finalidades **separadas**: uso asistencial ≠ telemetría operacional ≠ evaluación de
calidad ≠ investigación ≠ aprendizaje del modelo.

---

# BLOQUE G — E7 · NexusBench

## G1 · Casos — default + **doble adjudicación independiente**

> El modelo puede redactar casos, pero **no puede ser simultáneamente autor + gold
> standard + juez.**

```
1. IA genera caso ficticio
2. fuentes clínicas ancladas
3. gold answer preliminar
4. revisor clínico A
5. revisor clínico B
6. consenso
7. caso congelado
8. versión + fecha
```

Cada caso: `mustDo · acceptable · unsafe · mustNotMiss · criticalInputs · evidence ·
scoringRubric`.

**Separar DEV / VALIDATION / FROZEN TEST.** El test congelado **no se reutiliza** para
optimizar prompts: dejaría de medir generalización.

## G2 · Panel — empezar con 3, por PERFIL
1) experto clínico principal · 2) médico de otra especialidad troncal/UCI ·
3) farmacéutico clínico o segundo experto independiente.
Después 5–7 con pediatría · cirugía · gineco-obstetricia · farmacia ·
microbiología/enfermería según módulo. **Los nombres no bloquean la programación.**

---

# BLOQUE H — E8

## H1 · Orden — **(a) Pre-visit Brief**
1) Pre-visit Brief · 2) Nexus Rounds · 3) PROA/antibiograma · 4) Ambient.
El Brief da valor inmediato sin audio continuo, integración hospitalaria profunda ni la
capa de privacidad de Ambient.

## H2 · Microbiología — no asumir acceso ni formato
Importador en este orden: **1)** WHONET · **2)** CSV/XLSX del LIS · **3)** HL7/FHIR/API ·
**4)** PDF solo fallback.

Cada registro conserva: especie · muestra · fecha de colección · unidad/servicio · método ·
plataforma · antimicrobiano · MIC · diámetro si aplica · S/I/R · **norma (CLSI|EUCAST)** ·
**versión** · comentario/footnote.

> **INVARIANTE: jamás reinterpretar un antibiograma sin conocer estándar y versión.**
> `CLSI M100 Ed36` y `EUCAST 16.1` no son dos nombres de la misma tabla.

Hasta recibir datos locales: `hospitalAntibiogram = DISABLED`,
`demoAntibiogram = SYNTHETIC`. **Nunca presentar epidemiología nacional publicada como si
fuera el antibiograma del hospital.**

---

# BLOQUE I — E9 · Regulatorio

## I1 · Consultor — requerido antes del lanzamiento comercial clínico
Perfil: COFEPRIS/dispositivos médicos · Software como Dispositivo Médico · protección de
datos de salud · responsabilidad médica · ciberseguridad · contratos B2B hospitalarios ·
propiedad intelectual/licencias.

**La documentación técnica y el QMS pueden construirse desde ahora; las afirmaciones
regulatorias y la clasificación definitiva no se inventan.**

## I2 · Entidad legal — `PENDING_CONFIRMATION`
Como diseño de producto: **persona moral separada de la práctica clínica individual**
antes de contratos hospitalarios. La figura societaria concreta se decide con abogado y
contador. **No fijar «persona física» desde el código.**

## I3 · Ambición regulatoria — **(a)**
Diseñar desde ahora con disciplina de software médico/ScDM y certificar cuando la
clasificación, mercado o cliente lo requieran. Ni «ISO 42001 desde ya» como meta única,
ni «solo NOM-241».

Trazabilidad compatible con: NOM-241 · NOM-024 · gestión de riesgos · ciclo de vida de
software médico · usabilidad · ciberseguridad · gestión documental · vigilancia
post-implementación · gestión de cambios de IA.

*(ISO/IEC 42001:2023 es útil como gobernanza de IA y exige gestión continua, pero
alinearse no obliga a certificar en fase inicial.)*

---

# BLOQUE J — Producto y negocio

## J1 · Pilotos — default, estructurado por fases
`1) datos sintéticos → 2) casos retrospectivos desidentificados → 3) uso asistencial
controlado → 4) expansión`

Gratis a cambio de: reporte de errores · casos donde Nexus fue incorrecto · alertas
inútiles · dosis cuestionables · problemas de UX · tiempo ahorrado · acciones
aceptadas/rechazadas.

## J2 · Orden de sacrificio — DEFINITIVO

1. **Seguridad clínica**
2. **Evidencia citada + trazabilidad**
3. Fiabilidad y velocidad de la aplicación
4. Hospital/UCI
5. WhatsApp/agenda
6. Cobros/facturación
7. Pulido visual

> **Precisión importante: usabilidad ≠ «que se vea bonito».** Usabilidad, accesibilidad,
> legibilidad, jerarquía visual y evitar errores humanos pertenecen a **seguridad** y por
> tanto están arriba. Lo sacrificable es animación, decoración y perfeccionismo estético.

## J3 · Ritmo — **(a) con human gate**

Autónomo SÍ: tests unitarios · E2E · NexusBench · fuzzing · regresión · análisis estático ·
dependency/security scan · casos sintéticos · detección de duplicados · auditorías de
datos · benchmarks de latencia.

**Autónomo NUNCA:** cambiar una regla clínica validada · cambiar una dosis · cambiar un
breakpoint · publicar un algoritmo clínico · modificar permisos · migrar datos clínicos
destructivamente · cambiar lógica de cobros · desplegar un cambio clínico crítico sin
revisión.

---

# Los 6 datos externos que el software no puede inventar

| Dato | Estado seguro hasta recibirlo |
|---|---|
| D1 · Suscripciones reales | todas las comerciales `LICENSE_UNKNOWN` |
| F1 · Formulario hospitalario | `UNCONFIGURED` |
| F2 · Segundo aprobador | `PENDING_ASSIGNMENT` — bloquea *publicar*, no desarrollar |
| G2 · Nombres del panel | usar roles; nombres pendientes |
| H2 · Acceso/formato microbiología | importadores listos, antibiograma local `DISABLED` |
| I1/I2 · Abogado + entidad jurídica | `PENDING_REGULATORY_REVIEW` / `PENDING_CONFIRMATION` |
