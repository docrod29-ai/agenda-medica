# ADR · Morning Brief (UCI)

**Motor:** `uci-morning-brief` · `src/lib/uci/morning-brief.ts`
**Estado:** `pendiente_validacion` — **5 de 8 métricas no tienen dirección de
beneficio declarada**, y esa declaración es del médico dueño.

## Fuente de verdad

**Charter §30**, con su regla transversal:

> «**Todas las frases deben vincularse a datos reales.**»

## Referencia

Ninguna fuente clínica externa: el módulo **no aporta criterio médico**. Las tres
direcciones de beneficio que declara son definicionales (menos soporte es menos
soporte) y cada una cita su razón en el propio catálogo. Las cinco restantes
quedan **sin declarar** justamente porque sí exigirían criterio, y ese es del
médico dueño.

Los deltas se calculan sobre valores que ya midió otro motor: este archivo recibe
los extremos, no lee la serie.

## La frontera que este módulo respeta

Un **delta es un hecho**: la creatinina pasó de 1.5 a 2.4. Decir que eso significa
«**empeoró** la función renal» ya es **saber medicina** — requiere conocer que en
ese parámetro subir es malo.

Por eso la dirección de beneficio **se declara, no se deduce**. Una métrica sin
declarar produce su delta **sin veredicto**, y la pantalla muestra el cambio para
que lo interprete el intensivista.

### Direcciones declaradas (3) — cada una cita su razón

| Métrica | Dirección | Razón |
|---|---|---|
| Norepinefrina | menor es mejor | Definicional: menos vasopresor es menos soporte |
| FiO₂ | menor es mejor | Definicional: menos FiO₂ para la misma oxigenación es menos soporte |
| PEEP | menor es mejor | Definicional en retiro del soporte: bajar manteniendo oxigenación es desescalar |

Un caso del golden exige que **toda dirección declarada tenga fuente**: sin eso,
un «menor es mejor» entraría como opinión disfrazada de dato.

### Sin dirección (5) — a propósito

`balance` · `lactato` · `creatinina` · `diuresis` · `vexus`

El caso más claro es el **balance hídrico**: un balance positivo **no es malo por
sí mismo** — en choque distributivo la reanimación *es* el tratamiento. Depende
de la fase, y eso lo sabe el médico.

## «PENDIENTE» no se inventa

Los pendientes del ejemplo (cultivo, SBT, reevaluación del CVC) sólo pueden salir
de **metas diarias u órdenes abiertas** como dato estructurado, que aún no
existen (§35). La sección va **vacía y con la ausencia declarada**.

Un espacio en blanco se leería como «no hay nada pendiente», que es una
afirmación clínica que nadie hizo.

## Golden

`src/__tests__/uci-morning-brief.test.ts` — **23 casos**.

| Congela |
|---|
| El formato del charter: `NE 0.18 → 0.06 µg/kg/min` |
| Bajar la NE **mejora**; subirla **empeora** |
| La creatinina que sube **no recibe veredicto**, y se dice por qué |
| El delta **sí se muestra** aunque no haya veredicto |
| El balance positivo **no** se marca como empeoramiento |
| Toda dirección declarada **cita su fuente** |
| Pendientes vacíos **y declarados** |
| Métrica desconocida o valor no finito: se ignora, no rompe |
| Ventana no positiva **lanza** |

## Lo que NO hace

**No elige la ventana ni lee la serie**: recibe los extremos ya medidos. Decidir
cuál es «el valor de hace 12 horas» es la regla de vigencia de
`observacion-version.ts`, y duplicarla aquí las dejaría divergir en silencio.

## Pendiente de validación clínica

La **dirección de beneficio de las 5 métricas sin declarar**. Cada una que el
médico declare convierte su delta en un veredicto; las que deje sin declarar
seguirán mostrándose como cambio, que es el comportamiento seguro.
