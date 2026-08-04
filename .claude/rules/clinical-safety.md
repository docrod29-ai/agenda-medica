# Regla — seguridad clínica

Aplica a: `src/lib/clinical/`, `src/lib/seguridad/`, `src/lib/expediente/`,
`src/lib/uci/`, y a cualquier texto que llegue a una receta, una orden o una nota.

## 1. Ninguna cifra clínica se inventa

Dosis, umbrales, puntos de corte, rangos de normalidad, intervalos de
administración, equivalencias: **o salen de una fuente citada, o no existen**.

Cuando falte, se escribe literalmente `NEEDS_CLINICAL_REVIEW` con qué falta y
quién puede decidirlo, y se sigue con otra tarea. Nunca se rellena con «lo
habitual».

Rellenar una cifra plausible es el fallo más caro posible aquí: no falla, no
rompe una prueba, y sale impreso con cédula profesional.

## 2. El modelo de lenguaje no calcula

El LLM **redacta y extrae**. Toda escala, score, ajuste renal, conversión de
unidades o cálculo pediátrico corre en un **motor determinista** con pruebas.

Si un motor no puede calcular por falta de un dato, **lo dice** («no se puede
calcular Kirby: falta PaO₂ y FiO₂»). No estima.

## 3. Nada cambia en silencio

Toda corrección automática sobre lo que dijo el médico es **visible y
reversible**. Una corrección que no se puede ver ni deshacer es una edición que
alguien le hizo a su dictado sin decírselo.

## 4. Ausencia de dato no es dato de ausencia

Que no se oyera un antecedente no significa que el paciente lo niegue. Que no se
midiera un signo no significa que sea normal.

## 5. Señalar de menos, nunca de más

Los vocabularios clínicos (crónicas, agudos, fármacos) son **vocabulario, no
criterio**: que falte un término significa que ese caso **no se vigila**, no que
se dé por bueno. Declararlo en el módulo.

## 6. Se pregunta, no se adivina

Cuando hay ambigüedad crítica —dosis, unidad, negación, lateralidad, dos fármacos
plausibles— la interfaz **pregunta**. Los motivos viven en
`src/lib/asr/politica-critica.ts` y se reutilizan; no se inventa un criterio
nuevo por módulo.

## 7. Un motor nuevo trae su registro

Todo motor clínico se declara en `src/lib/clinical/registry.ts` con sus puertas
de entrada reales, y sus casos quedan sellados en
`src/lib/clinical/invariantes-clinicos.json`.
