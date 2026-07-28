# ✅ RESUELTAS — 28 de julio de 2026

> **Las 25 preguntas fueron contestadas.** Las respuestas canónicas viven en
> `DECISIONES-2026-07-28.md`, que es el documento que el software implementa.
> Este archivo se conserva como el registro de QUÉ se preguntó y por qué.

---

# Decisiones clínicas pendientes — Dr. David Alonso Rodríguez Luna

Todas las decisiones que el programa Nexus OS necesita de ti, **adelantadas** para que
las contestes en bloque en vez de detenerse 19 veces.

**Cómo usar este archivo:** contesta debajo de cada pregunta (o dímelo en el chat y yo
lo anoto). Lo que quede sin respuesta simplemente detiene esa unidad; no frena las demás.

**Estado:** `CONFIRMADA` = ya la topé en el código, la pregunta es exacta.
`ANTICIPADA` = la deduzco del diseño de la unidad; puede afinarse al implementar.

---

## BLOQUE 1 — Lo que ya está bloqueando (contestable hoy)

### 1.1 · Catálogo de dosis del adulto — `REG-043` · CONFIRMADA

Aprobaste ampliarlo, pero **no** con un `maxDose` único. Para cada fármaco necesito:

| Campo | Qué es |
|---|---|
| `usualMaxPerDose` / `usualMaxPerDay` | El uso habitual |
| `hardMaxPerDose` / `hardMaxPerDay` | El absoluto (hard stop) |
| `route` / `indication` / `formulation` | Cuándo cambia el máximo |
| `renalAdjustment` / `hepaticAdjustment` | Si aplica |
| `weightBased` / `requiresTDM` | Aminoglucósidos, vancomicina |

Los 20 sin referencia: cefalexina, ceftriaxona, cefotaxima, clindamicina, azitromicina,
TMP/SMX, nitrofurantoína, metronidazol, vancomicina, gentamicina, amikacina, meropenem,
prednisona, ondansetrón, difenhidramina, aciclovir, hierro elemental, salbutamol,
loratadina, ranitidina/omeprazol pediátrico.

> **Sugerencia para no morir en el intento:** empieza por los 5 que más recetas: los
> demás siguen diciendo «sin referencia», que es honesto y no estorba.

**Tu respuesta:**

---

### 1.2 · Motor de antibiograma — `E0-15` · CONFIRMADAS (4)

Detalle completo en `docs/audit/antibiograma-spec-para-dr.md`.

**a) Propagación EUCAST S→R.** El motor edita fluoroquinolonas de S a R por regla
experta, pero esa edición no llega a la nota, al prompt del LLM, al validador ni al
PK/PD: cada salida muestra la «S» cruda que el propio motor ya declaró R.
¿La edición debe reflejarse en TODAS las salidas? (esperado: sí)

**Tu respuesta:**

**b) «Dato ausente ≠ resistente».** Un panel sin imipenem hace que una *E. coli*
ertapenem-R / meropenem-S se marque como carbapenemasa MBL + NOM-045 + aislamiento.
¿Debe caer a «indeterminado — confirmar carbapenemasa» en vez de asumir el fenotipo?

**Tu respuesta:**

**c) CMI censurada.** Neumococo con penicilina «>2» se lee como 2 → «tratable con
penicilina». ¿Confirmas que «>X» con X ≥ sMax nunca puede ser S? (es CLSI estándar)

**Tu respuesta:**

**d) Carbapenémicos y alergia a penicilina.** Hoy se marcan como reacción cruzada
**crítica**, lo que bloquea la primera línea en sepsis y meningitis. El gemelo
`copiloto.ts` los trata como precaución (~1%). ¿Crítica o precaución?

**Tu respuesta:**

---

### 1.3 · Tres decisiones de riesgo (no son clínicas, son tuyas como dueño)

- **REG-014** — la firma médica es leíble por cualquier miembro del consultorio vía SDK.
  Separarla toca el camino de impresión. ¿Lo hago?
- **REG-015** — `cobros` no fuerza que el autor sea quien lo creó ni valida monto ≥ 0.
  ¿Lo endurezco? (los llamadores hoy son inconsistentes: unos mandan email, otros uid)
- **REG-017** — una nota puede nacer ya «firmada», saltándose borrador→firmada.
  ¿Fuerzo que siempre nazca borrador?

**Tu respuesta:**

---

## BLOQUE 2 — Datos de referencia que solo tú tienes

### 2.1 · Vocabulario de conceptos — `E1-02` · ANTICIPADA

Para que «creatinina», «Cr» y «creatinina sérica» sean el MISMO concepto, necesito tu
lista de sinónimos reales — los que tú y tus asistentes dictan de verdad.
¿Mapeamos a LOINC/ICD-10 donde la licencia lo permita, o vocabulario propio primero?

**Tu respuesta:**

### 2.2 · Cómo se define un BASAL — `E1-06` · ANTICIPADA

«La creatinina subió 48% sobre su basal» exige definir *basal*:
¿la **mediana** de los últimos 6/12 meses? ¿el **valor más bajo** del periodo?
¿el último valor en estado estable? ¿Cambia según el analito (Cr vs Hb vs peso seco)?

**Tu respuesta:**

### 2.3 · Verificaciones del Safety Kernel — `E4-02` · ANTICIPADA

Cuáles corren SIEMPRE y cuáles solo si hay dato: alergia, renal, hepático, edad, peso,
embarazo, interacción, duplicidad terapéutica, máximo, PK/PD, formulario.
Y para cada una: ¿es **BLOCK** (rojo) o **aviso** (amarillo)?

**Tu respuesta:**

### 2.4 · Medication Intelligence — `E4-04` · ANTICIPADA

Es la 1.1 pero completa. ¿Empezamos por tus 20–30 fármacos más recetados en
infectología y medicina interna, y crecemos desde ahí?

**Tu respuesta:**

---

## BLOQUE 3 — Jerarquía de evidencia (aquí mandas tú como infectólogo)

### 3.1 · Qué fuente pesa más — `E2-03` · ANTICIPADA

Tu documento dice «no mezclar todas las fuentes como equivalentes». Necesito tu orden.
Propuesta a validar: guía de sociedad vigente > meta-análisis/Cochrane > RCT > cohorte >
serie de casos > opinión. ¿Y dónde entran las guías **locales** y tu **formulario
institucional** — por encima de la guía internacional cuando aplican?

**Tu respuesta:**

### 3.2 · Guías discordantes — `E2-04` · ANTICIPADA

Cuando IDSA dice X y ESC dice Y: ¿mostrar ambas y la discordancia (sin elegir)?
¿O preferir la más reciente / la de la especialidad dueña del problema?

**Tu respuesta:**

### 3.3 · Cuándo el paciente NO cumple la población — `E2-08` · ANTICIPADA

¿Qué desviación amerita decirlo explícitamente? ¿Edad fuera de rango? ¿TFG por debajo
del corte del estudio? ¿Embarazo? ¿Qué se declara y qué se calla?

**Tu respuesta:**

### 3.4 · Evidence Watch — `E2-09` · ANTICIPADA

¿Qué merece interrumpirte? Propuesta: solo guía nueva o RCT que **cambie conducta** en
un problema activo. ¿O también meta-análisis? ¿Con qué frecuencia máxima?

**Tu respuesta:**

---

## BLOQUE 4 — Incertidumbre y evaluación

### 4.1 · Qué es «confianza alta» — `E3-05` · ANTICIPADA

Tu documento dice que la confianza no puede ser la probabilidad de tokens. Debe combinar
calidad de datos, completitud, acuerdo entre fuentes, actualidad, evidencia y
concordancia entre agentes. **¿Qué peso lleva cada factor?** ¿Y qué falta de dato baja
automáticamente a «insuficiente»? (ej. sin cultivo actual en una sepsis)

**Tu respuesta:**

### 4.2 · NexusBench — `E7-02` / `E7-03` · ANTICIPADA

Cada caso necesita **gold answer**, alternativas aceptables, **respuestas peligrosas** y
**must-not-miss**. Eso no lo puedo inventar. ¿Empezamos por infectología y UCI, que son
lo tuyo, con 10–15 casos que tú redactes o valides?

**Tu respuesta:**

### 4.3 · Panel ciego — `E7-06` · ANTICIPADA

¿Quiénes evalúan? ¿Colegas de otras especialidades? ¿Cuántos casos por versión?

**Tu respuesta:**

---

## BLOQUE 5 — Hospital y UCI

### 5.1 · Priorización de Nexus Rounds — `E8-04` · ANTICIPADA

«¿A quién veo primero?» debe ser una fórmula explicable, no una improvisación del LLM.
¿Qué pesa y cuánto: NEWS2, delta de SOFA, vasopresores, ventilación, lactato, eventos
nocturnos? ¿Algún criterio que mande sobre todos (ej. lactato en ascenso)?

**Tu respuesta:**

### 5.2 · Antibiograma institucional — `E8-05` · ANTICIPADA

¿Cuántos aislamientos mínimos para que un porcentaje de resistencia local sea creíble?
(el estándar suele ser ~30) ¿Se separa por unidad (UCI vs piso)? ¿Ventana de 12 meses?

**Tu respuesta:**

### 5.3 · Memoria institucional — `E5-04` · ANTICIPADA

¿El formulario del hospital **manda** sobre la guía internacional cuando el fármaco ideal
no está disponible? ¿O se recomienda el ideal y se avisa que no hay?

**Tu respuesta:**

---

## BLOQUE 6 — Aprendizaje y regulación

### 6.1 · Resultado ≠ causalidad — `E6-02` · ANTICIPADA

¿Qué desenlaces vale la pena ligar? (cultivo posterior, susceptibilidad, creatinina,
reingreso). ¿Y qué se hace con ellos: solo medir calibración, o también alimentar
revisión clínica?

**Tu respuesta:**

### 6.2 · Quién aprueba un aprendizaje — `E6-04` · ANTICIPADA

Ningún feedback llega a producción sin revisión clínica. **¿Quién firma esa revisión?**
¿Tú? ¿Un comité? ¿Qué evidencia hace falta para aprobar un cambio?

**Tu respuesta:**

### 6.3 · Intended use y frontera CDS — `E9-03` · ANTICIPADA · **la más importante**

Define legalmente qué es NexusMED. Tu documento ya cita la guía final de FDA de enero
2026: el profesional debe poder **comprender y revisar independientemente** la base de
cada recomendación, por diseño.

- ¿Qué funciones se declaran «apoyo revisable por el profesional»?
- ¿Cuáles se acercan a software regulado (dosis, priorización, UCI)?
- ¿Qué mercados primero: México, luego LatAm, luego EE. UU./UE?

Esto condiciona arquitectura, control de cambios y logging. **Es la que más conviene
contestar temprano**, porque rehacerla después es carísimo.

**Tu respuesta:**

---

## Resumen

| Bloque | Preguntas | Tipo |
|---|---|---|
| 1 — Bloqueando hoy | 8 | Confirmadas |
| 2 — Datos de referencia | 4 | Anticipadas |
| 3 — Evidencia | 4 | Anticipadas |
| 4 — Incertidumbre | 3 | Anticipadas |
| 5 — Hospital/UCI | 3 | Anticipadas |
| 6 — Aprendizaje/regulación | 3 | Anticipadas |

**Si solo contestas tres, que sean:** 1.2 (antibiograma — desbloquea 14 hallazgos),
2.2 (basal — es el cimiento del Patient Clinical Graph) y 6.3 (intended use — condiciona
toda la arquitectura).
