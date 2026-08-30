# Carril del bucle autónomo — abierto el 30-ago-2026

**Rama**: `product/ausculta-loop-2026-08-30` · **Nace de**: `main` en `c08d97ff`

## Qué es esto

La rama donde escribe el **bucle autónomo** (`.github/workflows/ausculta-autonomous-loop.yml`).
Existe para que el bucle tenga un carril propio y **al día**, que es la condición
que su guardia comprueba antes de escribir:

1. cero commits por detrás de `main` al abrirse,
2. con PR abierto cuya cabeza es esta rama,
3. y sin ninguna otra rama con PR abierto descendiendo de su punta.

## Por qué hacía falta abrirlo

El carril anterior (`product/ausculta-master-completion`, PR #389) quedó **97
commits por detrás** y superado: el trabajo del tablero lo terminó una sesión
cloud en #398, ya fusionado. Un bucle apuntando a una rama superada escribe
historia divergente del mismo tablero — el defecto que se arregló hoy y que está
contado en [`docs/maintenance/CARRILES-Y-BUCLES.md`](../docs/maintenance/CARRILES-Y-BUCLES.md).

## La regla que lo gobierna

```
UN TABLERO · UN ESCRITOR · UNA RAMA
```

Mientras este carril esté vivo, **el tablero de Ausculta es suyo**. Si una sesión
cloud va a trabajar el mismo tablero, este carril se cierra primero — no se
trabajan los dos a la vez, porque no chocan en Git y por eso no se nota hasta
semanas después.

## Qué NO cambia

Desplegar y fusionar a `main` siguen siendo del dueño. El bucle llega hasta
rama + commit + PR + CI en verde, y ahí para.
