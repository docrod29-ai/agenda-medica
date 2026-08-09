# ADR-002 · El LLM nunca calcula una cifra clínica

**Estado**: Vigente · **Fecha**: 4-ago-2026 (formalizado 6-ago-2026, REG-194)

---

## Contexto

El sistema genera notas médicas a partir de un dictado. En una nota clínica hay
cifras que **no se dictan sino que se derivan**: percentiles de crecimiento,
dosis por kilo, depuración de creatinina, superficie corporal, escalas de
gravedad, volúmenes de líquidos.

Un modelo de lenguaje puede producirlas. Y lo hace de forma convincente.

## Decisión

**Las cifras derivadas las calcula un motor determinista, probado y versionado.
El modelo transcribe lo que se dictó y, cuando falta un dato para que el motor
calcule, lo señala.**

El modelo puede **explicar** un cálculo. No puede ser su fuente.

## Por qué

Una cifra equivocada de un motor y una de un modelo no se parecen en nada:

| | Motor determinista | Modelo generativo |
|---|---|---|
| Cuando se equivoca | siempre igual | distinto cada vez |
| Se reproduce | sí | no siempre |
| Se arregla | una vez, y queda probado | se ajusta el prompt y se espera |
| Se detecta | con una prueba | **con nada** |

La última fila es la que decide. **Una cifra mal calculada por un modelo no
levanta ninguna excepción, no deja traza y se lee exactamente igual que una
correcta** — dentro de un documento que se firma con cédula profesional.

## Alternativas descartadas

**1. Dejar que el modelo calcule y verificar el resultado con un motor.**
Descartada: si el motor tiene que existir igualmente para verificar, que calcule
él. Añadir el modelo sólo añade una fuente de error y coste por consulta.

**2. Dejar que calcule y marcarlo como «revisar».** Descartada: una cifra
plausible marcada para revisión se aprueba igual. Es el mismo mecanismo de la
fatiga de alerta.

**3. Dejar que calcule sólo lo «fácil» (IMC, edad gestacional).** Descartada: la
frontera entre fácil y difícil no la puede juzgar quien hace el cálculo, y una
regla con excepciones se erosiona hasta desaparecer. La regla vale más siendo
absoluta.

## Consecuencias

**Aceptadas, incluidas las malas:**

- **La nota trae menos cifras derivadas que antes.** Lo que el motor no cubre, no
  sale. Es visible para el médico y hay que decírselo.
- **Cada cálculo nuevo exige escribir un motor**, con su fórmula citada y sus
  pruebas. Es más lento que pedírselo al modelo.
- **Holliday-Segar no tiene motor**, así que hoy los líquidos pediátricos no se
  calculan: se transcribe lo que el médico dictó. Registrado como
  NEEDS_CLINICAL_REVIEW en vez de resolverlo con una fórmula sin validar.

**A favor:**

- Los motores existentes (`oms-crecimiento`, `calcularDosisPediatrica`,
  `funcion-renal`, `prevent`, `calculadoras`) ya cubren lo más frecuente.
- Un error en un motor se arregla para todos los pacientes a la vez.

## Cómo se hace cumplir

- Regla **16-bis** del prompt, global: «tú no calculas», con los motores
  nombrados. Un «no lo hagas» sin decir quién lo hace deja el trabajo sin dueño.
- `src/__tests__/el-llm-no-calcula-en-ninguna-nota.test.ts` comprueba que la
  regla existe y que las guías de especialidad no piden aritmética.
- `src/__tests__/el-prompt-no-se-contradice.test.ts` impide que vuelva una orden
  incompatible por otra vía.

## Historia

Esta regla existía **sólo dentro de la nota de UCI**. Fuera, el prompt pedía
literalmente «dosis en mg/kg/día Y mg/kg/dosis. Holliday-Segar para líquidos» y
«percentiles si hay datos» — aritmética pediátrica hecha por un modelo. Se elevó
a regla global el 6-ago-2026 (REG-194).
