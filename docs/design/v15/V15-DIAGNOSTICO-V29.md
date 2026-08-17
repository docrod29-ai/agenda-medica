# §29 — el diagnóstico, y por qué la vara obvia no sirve

**15-ago-2026 · `V15-SECTION29-STRUCTURAL-REPAIR-003`, fase de diagnóstico.**
Medido sobre `060aade0` con build de producción, emuladores y siembra, en
1440×900 y 390×844, **0 errores de consola**.
Arnés: `scripts/design/medir-anatomia-v29.mjs` · acta:
`docs/design/capturas/v15-anatomia-v29/acta-antes.json` (12 capturas).

## Lo que se midió, y por qué se midió eso

La re-auditoría independiente describió el defecto con palabras de **anatomía**:
«worklist convencional», «directorio CRUD», «índice de ajustes», «panel de
aplicación genérico». Esas palabras se pueden contar, y el encargo pide contarlas
antes de tocar nada. Así que se contaron: cajas delimitadas, rellenos de marca,
primitivas de lista, campos y píldoras de filtro, cromo persistente y a qué
altura aparece la primera acción consecuente.

## El resultado, y la sorpresa

Escritorio 1440×900:

| superficie | §29 | cajas | rellenos de marca | listas rep. | campos/píldoras | 1ª acción consecuente |
|---|---|---|---|---|---|---|
| Hoy | 1.5 | 4 | 1 | 13 | 0/0 | **8px — «Nueva cita»** |
| Pacientes | 1.5 | **0** | 2 | 6 | 1/3 | 24px — «Agendar» |
| Expediente | 1.5 | 5 | 2 | 9 | 0/3 | 24px — «Atrás» |
| Consulta | 1.5 | 5 | 3 | **20** | **12**/0 | **393px** |
| Operaciones | 1.5 | 4 | **0** | 4 | 0/0 | 140px |
| **Pendientes** | **1.0** | **7** | **7** | 4 | 0/0 | 183px |

**La superficie que PASA tiene los peores números de la tabla.** Siete cajas y
siete rellenos de marca — el doble que cualquiera de las que fallan. Y la que
tiene CERO cajas (`/pacientes`) puntúa 1.5.

## La conclusión que importa: la vara está refutada

Si esta corrida hubiera «optimizado» estas métricas, habría empujado a las cinco
superficies **en dirección contraria** a la única que el revisor independiente
aprueba. Contar contenedores y rellenos no mide genericidad.

Es la familia RTC-02 / RTC-20 / INS-01 otra vez —el instrumento que no mide lo
que dice medir— y esta vez se cazó **antes** de escribir producto, que es la
única vez que sale barato. Queda escrito aquí para que la corrida siguiente no
vuelva a empezar por ahí.

## Lo que la medición SÍ encontró

Los números no rankean, pero tres son hallazgos concretos y accionables:

1. **Hoy — la primera acción consecuente de la pantalla clínica de entrada es
   «Nueva cita», a 8px.** Administrativa, y por delante de todo lo clínico.
2. **Consulta — 12 campos de formulario y 20 grupos de hermanos repetidos en
   `<main>`, con la primera acción consecuente a 393px (518px en móvil).** Es,
   literalmente medido, el catálogo de herramientas que el auditor describió.
3. **Pacientes — 1 buscador + 3 píldoras + filas cuya única acción es
   «Editar».** La anatomía «título · buscador · filtros · filas · acciones de
   fila», con un verbo de CRM como único gesto por fila.

## La causa raíz, reformulada por lo que se ve

Mirando las capturas al lado de los números, la diferencia entre `/pendientes`
(1.0) y las cinco que fallan **no es de forma: es de modelo de interacción.**

> En `/pendientes`, **cada entrada lleva encima su siguiente acción segura**
> («Tomarla», «Ya se hizo», «Lo revisé — cerrar»). El estado clínico es algo que
> se TRABAJA donde está.
>
> En las cinco que fallan, el estado clínico es **texto que hay que abandonar la
> pantalla para atender**. `/pacientes` llega a decir «Resultado — venció y nadie
> la tomó» y a ofrecer, como único gesto de esa fila, **«Editar»**.

Eso explica la inversión de los números: la superficie que aprueba tiene más
cajas y más rellenos **porque cada elemento posee su acción**, no a pesar de
ello. Y coincide con lo que el propio encargo pide que se perciba —«next safe
action over button density», «current state over module inventory»— y con la
tesis del producto: un paciente, un espacio clínico, un momento, **una siguiente
acción segura**.

## La línea que esta corrida NO cruza, y por qué

La lectura anterior sugiere el arreglo obvio para `/pacientes`: poner en la fila
los mismos botones de avance de estado que tiene `/pendientes`, reutilizando
`cambiarEstado`. **No se hace, y no por alcance: por seguridad clínica.**

`/pendientes` separa a propósito «Ya se hizo» de «Lo revisé — cerrar» —está
escrito en su cabecera y en `POR_QUE_COMPLETADA_NO_ES_CERRADA`— porque entre esas
dos vive el daño que el worklist existe para evitar: el estudio hecho, el
resultado en el sistema, y nadie que lo lea. Poner «cerrar» a un toque en una
lista donde el detalle de la tarea **no está en pantalla** permitiría cerrar un
resultado sin haberlo mirado. Eso es un cambio de conducta clínica disfrazado de
mejora de diseño, y §1 lo congela.

El camino seguro es el contrario y ya existe pagado: hacer que el estado clínico
de la fila sea **inspeccionable en el sitio** (la lente contextual y el contrato
de regreso de `060aade0`), no mutable en el sitio.

## Estado de la reparación

**§29 sigue SIN pagar.** Esta corrida entrega el diagnóstico medido, la
refutación de la vara y la causa raíz reformulada; no entrega el rediseño
estructural de las cinco superficies, que es un programa de varias rebanadas con
medición, guardián y acta por cada una.

Lo que queda nombrado para la siguiente, en este orden por coste/beneficio:

1. **Hoy** — sacar la acción administrativa de la primera posición clínica.
2. **Pacientes** — que la fila permita INSPECCIONAR su estado clínico en el
   sitio (lente ya pagada) en vez de ofrecer «Editar» como único gesto.
3. **Consulta** — el catálogo de herramientas y los 12 campos: la distancia de
   393/518px hasta la primera acción consecuente es el número a bajar.
4. **Operaciones** — semántica de excepción en vez de índice.
5. **Expediente** — es el más cercano; su hueco era de evidencia.

`/pendientes` no se toca en ninguna.
