# ADR-001 · Una sola fuente de verdad por entidad clínica

**Estado**: Vigente · **Fecha**: 4-ago-2026 (invariante del charter §2)

---

## Contexto

El sistema tiene consulta externa, hospitalización, UCI, farmacia, laboratorio,
recetas y portal del paciente. Cada uno necesita ver al mismo paciente, sus
mismos medicamentos y sus mismas alergias — **de forma distinta**.

La tentación es crear una estructura por pantalla: `patientAgenda`,
`patientConsultation`, `patientHospital`; `medicationInNote`,
`medicationInPharmacy`, `medicationInPrescription`.

## Decisión

**Una entidad clínica, una fuente de verdad, muchas vistas contextuales.**

Nunca duplicados independientes del mismo hecho clínico.

## Por qué

No es elegancia: es que **los duplicados divergen, y divergen en silencio**.

Este repositorio lo ha pagado tres veces documentadas:

- **REG-034 / REG-035 / REG-171** — cuatro parsers distintos del campo de
  alergias. El canónico entendía «Penicilina / Sulfas» como dos alérgenos; los
  otros tres no. Un paciente alérgico a TMP/SMX quedó registrado como alérgico a
  `«SMX)»`, y el cruce con el fármaco **no saltaba**.
- **REG-177** — dos listas de «formas de decir que no lo sé», una en
  `via-normalizada` y otra implícita. La que no se actualizó dejó pasar el hueco.
- **REG-192** — dos listas de negadores, una en `negaciones.ts` y otra más pobre
  en `parser-clinico.ts`. «No padece diabetes» entraba como antecedente
  **positivo**.

El patrón es siempre igual: **dos sitios que deben decir lo mismo acaban diciendo
cosas distintas, y el que se olvide de actualizar es el que deja pasar el error.**

## Alternativas descartadas

**1. Duplicar y sincronizar.** Descartada: la sincronización se olvida
exactamente en el caso raro, que es donde importa.

**2. Duplicar sólo lo "estable".** Descartada: nada clínico es estable. Las
alergias parecían el caso más simple y produjeron tres regresiones.

**3. Una vista única para todos los contextos.** Descartada por el lado
contrario: un intensivista y un médico de consulta externa no necesitan la misma
pantalla. La solución es **una fuente, muchas vistas**, no una vista para todos.

## Consecuencias

**Aceptadas:**

- Cambiar el modelo de una entidad **afecta a todas las pantallas a la vez**. Es
  más caro que tocar una copia, y obliga a probar de más.
- Alguna vista necesita datos que no le corresponden y hay que decidir dónde
  viven. Ejemplo real: la medicación **vigente** del paciente no está en la nota
  de hoy, y hubo que construir `cuadro-completo.ts` para unirlas sin duplicar
  (REG-188).

**A favor:**

- Un arreglo llega a todos los sitios de golpe.
- El cruce alergia ↔ fármaco compara siempre contra lo mismo.

## Cómo se hace cumplir

- `alergenosDe()` es el único parser del campo de alergias; lo usan consulta,
  UCI, receta y el sesgo del reconocedor.
- `hueco-textual.ts` es la única lista de «formas de decir no lo sé».
- Cuando dos módulos necesitan la misma regla y no pueden compartir la función
  —porque hacen cosas distintas con ella—, una prueba comprueba que **ninguno se
  quede corto** respecto al otro (`como-se-dice-que-no-en-una-consulta.test.ts`).
