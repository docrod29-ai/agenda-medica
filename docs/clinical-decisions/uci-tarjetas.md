# ADR · Landing de UCI (§3)

**Motor:** `uci-tarjetas` · `src/lib/uci/tarjetas.ts`
**Estado:** `validado`. No emite ningún juicio clínico.

## Fuente de verdad

Charter §3 (vía ICU-001): «Landing de UCI con tarjetas». La tarjeta se arma con
hechos que **ya están registrados** en el episodio (`Internamiento`) y en las
tomas persistidas (`icu_observations`, ICU-P0-1).

## Referencia

Ninguna fuente clínica. La tarjeta **no dice si el paciente está mejor o peor**:
para eso hace falta una dirección de beneficio declarada, y eso vive en
`uci-morning-brief`, sólo para las métricas donde está declarada. Un caso del
golden falla si este módulo llega a exportar algo con nombre de veredicto
(`mejor`, `peor`, `grave`, `riesgo`, `severidad`, `pronóstico`).

## El orden ES la función

Las tarjetas se ordenan por **antigüedad de la última toma**:

1. quien **no tiene ninguna toma** — de ese no se sabe nada;
2. quien tiene la toma más antigua;
3. a igualdad, por cama, para que la lista no baile entre recargas.

Ordenar por número de cama —que es lo natural— escondería justo al paciente del
que hace horas que nadie anota nada, que es a quien esta pantalla existe para
señalar.

## Día de UCI: la convención está declarada

Se cuenta por **bloques de 24 h transcurridas**: día 1 son las primeras 24 h
desde el ingreso. Es la única forma de contarlo sin depender de la zona horaria
del navegador — la lección **REG-011**, y un caso lo comprueba escribiendo el
mismo instante con dos desfases distintos.

**Pendiente del Dr.:** si su unidad cuenta por **día de calendario** (día 2
empieza a medianoche, no a las 24 h), es otra convención. Es un cambio de una
línea, pero es una decisión suya, no del módulo.

## Golden

`src/__tests__/uci-tarjetas.test.ts` — **21 casos**.

| Congela |
|---|
| La tarjeta no exporta ningún veredicto |
| Día 1 = primeras 24 h; a las 24 h exactas empieza el día 2 |
| La cuenta **no** depende de la zona horaria |
| Un ingreso en el futuro se declara y **no** produce día 0 ni negativo |
| Sin ninguna toma: se dice que no se sabe nada del estado actual |
| Una fecha de toma inválida cuenta como **sin toma**, no como toma reciente |
| El que no tiene toma va **primero** |
| **No** se ordena por cama |
| `ordenarTarjetas` no muta la lista que recibe |

## Dato faltante

Cada hueco entra en `avisos` con su frase: sin tomas, sin cama, sin fecha de
ingreso. En una lista de pacientes, una tarjeta silenciosa se lee como «todo en
orden».

## Nota de rendimiento

La pantalla lee **30** tomas por paciente (`TOPE_LANDING`), no las 200 de la
ficha: abre N pacientes a la vez, y bajar la subcolección entera por cada uno fue
la causa real de la lentitud de la agenda. 30 basta para resolver correcciones
recientes y saber cuándo fue la última toma.
