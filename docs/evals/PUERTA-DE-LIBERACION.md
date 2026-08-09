# Puerta de liberación — los nueve ceros

**Formato**: §H6 del charter Master Loop V7.
**Abierto**: 6-ago-2026.

---

## Qué es esto

El charter fija nueve cosas que, sobre un conjunto finito y versionado de casos,
deben dar **cero**. Cualquiera que falle **bloquea la liberación**.

No son objetivos ni aspiraciones. Son la puerta: si una da distinto de cero, no
se publica, por buena que sea la versión en todo lo demás.

## La palabra que hace el trabajo: **silencioso**

Seis de los nueve dicen «silencioso», y ahí está el sentido entero de esta
puerta.

Un error que el sistema **detecta y avisa** no es lo que se persigue aquí: es
trabajo hecho. Lo que se persigue es el error que **pasa sin que nadie se entere**
— el que se lee exactamente igual que un dato correcto, dentro de un documento
firmado con cédula profesional.

Por eso cada fila de abajo se pregunta lo mismo: *si esto ocurriera, ¿algo lo
delataría?*

---

## Estado hoy

| # | Debe ser cero | Qué lo protege | Estado |
|---|---|---|---|
| 1 | **Paciente equivocado** | `deEstePaciente`, guardia de nota ajena | 🟡 **DÉBIL** |
| 2 | **Error de medicación silencioso** | motor de dosis + compuerta de firma + cruce de alergias | ✅ |
| 3 | **Error de unidad silencioso** | `revisarUnidadDosis` + compuerta + `ClinicalQuantity` | ✅ |
| 4 | **Negación invertida silenciosa** | motor de negación + aviso que no se pliega | ✅ |
| 5 | **Cita fabricada** | verificación de PMID + `EVIDENCE_UNAVAILABLE` | ✅ |
| 6 | **Orden activa no confirmada** | intención vs orden + nada se activa sin firma | ✅ |
| 7 | **Acceso entre consultorios** | reglas de Firestore + puerta `aislamiento-tenant` en CI | 🟡 **DÉBIL** |
| 8 | **Pérdida de datos** | respaldo local + autoguardado + punto de deshacer | ✅ |
| 9 | **Pago duplicado** | id determinista `stripe_{session}` + idempotencia | ✅ |

---

## Los dos débiles, dichos como son

### 1 · Paciente equivocado — el más grave y el peor cubierto

Es el **primero** de la lista del charter, y el que menos pruebas dedicadas
tiene. No hay un corpus adversarial que intente meter la nota de un paciente en
el expediente de otro.

Lo que hay hoy son controles reales pero **derivados**: `deEstePaciente` impide
abrir una nota que no corresponde, y las reglas de Firestore acotan por
`clinicId`. Ninguno se escribió pensando en «paciente equivocado» como peligro
con nombre.

**Lo que falta**: un caso de peligro en `docs/clinical-safety/` y un corpus que
lo ataque a propósito — dos pacientes con nombre parecido, un cambio de pestaña
a mitad del dictado, una nota restaurada de otro paciente.

### 7 · Acceso entre consultorios

La puerta `aislamiento-tenant` corre en cada PR y es real. Pero prueba lo que
**se le pidió probar**; no hay un equipo rojo independiente intentando romperla,
que es lo que el charter §5.16 pide.

---

## Lo que esta puerta NO significa

**Un cero aquí no significa que el error no pueda ocurrir.** Significa que, sobre
el conjunto de casos que hay escrito, no ocurrió sin avisar.

La diferencia importa: **el conjunto sólo cubre lo que alguien pensó en escribir**.
Cada REG del ledger empezó siendo un caso que nadie había pensado. Por eso la
regla §H7 —cada defecto se convierte en prueba permanente— es lo que hace que
esta puerta valga más cada mes, y no lo que la hace suficiente hoy.

---

## Cómo se comprueba

`src/__tests__/la-puerta-de-liberacion-sigue-cerrada.test.ts` verifica que cada
uno de los nueve tenga al menos una prueba viva que lo proteja, y que las que
este documento cita **existan de verdad**.

No mide el cero: comprueba que **el mecanismo que lo vigila siga en pie**. Un
cero que nadie está midiendo no es un cero: es una casilla.
