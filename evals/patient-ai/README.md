# `evals/patient-ai/` — la compuerta que la regla exige y no existía

## Qué es esto

`.claude/rules/patient-facing-ai.md` §7 dice, literal:

> Las doce del §0 de V9 son **fixture permanente** en `evals/patient-ai/`. No son
> ejemplos: son la puerta. Un cambio en la IA del paciente que no las corra no
> está terminado.

**Este directorio no existía.** La regla llevaba escrita desde que se abrió V9 y
era la única del repositorio que **no se podía correr**: una compuerta que no
existe no falla nunca, y una que no falla nunca no es una compuerta.

Lo peor de eso no es que faltara cobertura. Es que se podía cambiar la IA de cara
al paciente y decir con toda honestidad que se pasaron todas las compuertas.

## Por qué la puerta prueba el SERVIDOR y no un prompt

La misma regla, §3:

> No es una lista de cosas a evitar: es una lista de cosas que el código **no
> debe poder hacer**. Si una ruta lo permite y sólo el prompt lo impide, está mal
> construida. **La prohibición vive en el servidor, no en la instrucción.**

Por eso los casos de `casos.json` se corren contra los módulos deterministas
—`urgenciaDelMensaje` y compañía— y no contra un modelo. Una compuerta que
dependa de que el modelo se porte bien mide el humor del modelo, no el producto,
y sale distinta cada vez que se ejecuta.

Consecuencia honesta y declarada: **esta puerta no prueba lo que el modelo
redacta**. Prueba lo que el sistema hace antes de dejarle redactar. Lo otro es
WS-12 (evaluación con corpus y jueces) y sigue abierto.

## Cómo se corre

```bash
npx vitest run src/__tests__/las-doce-preguntas-del-paciente.test.ts
```

## Cómo crece

De la regla §7, y no se negocia:

```
reproducción → arreglo → prueba de regresión → FIXTURE PERMANENTE
```

Cada defecto que encuentre el equipo rojo entra aquí como caso nuevo. Un caso
**no se borra** porque parezca trivial: los que parecen triviales son los que
llevan seis meses pasando.

## Qué NO es

- **No es un corpus de evaluación del modelo.** No mide redacción, ni tono, ni
  comprensión lectora.
- **No hay pacientes reales.** Cero PHI: todos los textos son sintéticos
  (`.claude/rules/data-privacy.md`).
- **No cubre las cinco clases de respuesta.** Hoy cubre la que el código
  implementa de verdad —`URGENT_REVIEW_REQUIRED`— y **declara** las que no.
  Fingir cobertura de una clase sin implementación sería exactamente el verde
  falso que esta puerta existe para impedir.
