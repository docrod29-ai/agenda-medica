# ADR · Línea de tiempo única (UCI)

**Motor:** `uci-linea-tiempo` · `src/lib/uci/linea-tiempo.ts`
**Estado:** `validado` — ordena y declara procedencia; no interpreta.

## Fuente de verdad

**Charter §33**:

> «Crear única línea temporal:
> 07:00 labs · 07:20 ABG · 08:00 rounds · **08:15 PEEP ↑ · 08:20 MAP ↓ ·
> 08:27 NE ↑** · 09:10 POCUS · 09:30 VTI ↓ · 10:00 culture positive ·
> 10:15 antibiotic change»

## Referencia

Ninguna fuente clínica: es ordenamiento temporal. La **interpretación** de las
secuencias ya vive en `correlacion.ts` (§34), que detecta asociaciones y
—correctamente— **nunca afirma causalidad**. Este módulo es anterior a eso.

## Golden

`src/__tests__/uci-linea-tiempo.test.ts` — **23 casos**.

| Congela |
|---|
| El ejemplo del charter: 9 fuentes distintas, una sola línea ordenada |
| **PEEP ↑ → MAP ↓ → NE ↑** queda contigua y visible |
| Cada evento conserva **de dónde vino** |
| Un evento **sin fecha se devuelve aparte**, no se descarta |
| Dos eventos simultáneos se ordenan **siempre igual** (desempate estable) |
| La **zona horaria la pone quien llama** — nunca el módulo |
| Rango invertido **lanza** en vez de devolver vacío |
| Los huecos de documentación se **señalan, no se juzgan** |
| El primer cambio de titulación **no tiene dirección**: no hay contra qué compararlo |

## Dato faltante

Un evento con fecha inválida **no se tira en silencio**: se devuelve en
`sinFecha`. Un hecho clínico que no se pudo ubicar en el tiempo sigue siendo un
hecho, y esconderlo es peor que mostrarlo mal colocado.

Un hueco en la línea **es información**: significa que nadie documentó. No se
rellena.

## Por qué el rango invertido LANZA

Devolver vacío se confundiría con «no pasó nada en ese periodo», que es una
afirmación clínica. Un error de programación no debe poder disfrazarse de dato.

## Por qué la zona horaria la pone quien llama

Es la lección de **REG-011**: el corte de caja usaba la zona de CDMX y daba el
día equivocado en el norte del país. La zona del hospital es del hospital; este
módulo recibe el formateador y no elige.

## Por qué existe

Cada fuente ya tenía su vista: las tomas en la gráfica, la titulación en su
tabla, los cultivos en microbiología, los traslados en el episodio. Todas ciertas
y todas separadas.

El intensivista que llega a las 11:00 quiere saber **qué pasó en orden**, no
abrir seis pantallas y reconstruirlo de memoria. La secuencia «PEEP ↑ → MAP ↓ →
NE ↑» sólo se ve cuando las tres viven en la misma línea.
