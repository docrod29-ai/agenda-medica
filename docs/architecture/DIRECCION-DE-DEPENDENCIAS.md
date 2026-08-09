# La dirección de las dependencias

**Formato**: §4.1 del charter Master Loop V7.
**Abierto**: 6-ago-2026. **Medido**: 6-ago-2026 sobre 734 archivos de `src/`.

---

## Esto está medido, no dibujado

Un diagrama de arquitectura describe **lo que alguien quiso**. El grafo de
`import` describe **lo que hay**. Cuando los dos se separan, el que manda es el
segundo — y el diagrama pasa a ser un documento que tranquiliza sin proteger.

Todo lo de abajo sale de leer los `import` reales. Se puede volver a correr.

---

## La regla

```
app / components  ──▶  contexts  ──▶  hooks  ──▶  lib  ──▶  types
```

Las flechas van en un solo sentido.

**Por qué importa el caso concreto** — un `lib/` que importa un componente ata la
lógica clínica a una pantalla. Deja de poder probarse sin montar la interfaz y,
lo que pesa más, **deja de poder llamarse desde una ruta de API** — que es por
donde entran los motores cuando algo se automatiza: un recordatorio nocturno, un
webhook, una alerta.

---

## Lo medido

| Arista | Veces | ¿Correcta? |
|---|---:|---|
| `app → lib` | 941 | ✅ hacia abajo |
| `app → components` | 140 | ✅ |
| `components → lib` | 87 | ✅ |
| `app → hooks` | 79 | ✅ |
| `hooks → lib` | 22 | ✅ |
| `lib → types` | 16 | ✅ |
| `app → types` | 15 | ✅ |
| `components → hooks` | 11 | ✅ |
| `types → lib` | 2 → **1** | 🟡 **la grieta**, abajo — una cerrada en v1087 |

### Los tres resultados

| | |
|---|---|
| **Dependencias invertidas** | **0** |
| **`lib/` que dependa de una pantalla o una ruta** | **0** |
| **Ciclos de importación** | **0** |

Los `import type` **no cuentan**: TypeScript los borra al compilar, así que no
crean dependencia en tiempo de ejecución. Contarlos daría violaciones que no
existen — y ese mismo detalle ya hizo pasar en verde a cuatro módulos huérfanos
durante meses (v1019).

---

## La grieta: `types/` no era una hoja del todo

La medición encontró **dos** archivos de `src/types/` que traían **código en
tiempo de ejecución** desde `lib/`. Uno se cerró aquí mismo; el otro no se cierra
con un import.

### Cerrado (v1087)

`src/types/hospital.ts` re-exportaba `ESPECIALIDADES_INTERCONSULTA` —un valor,
no un tipo— con un alias. Tenía **un solo consumidor**, y ahora lo importa
directamente de `@/lib/especialidades`, que siempre fue la fuente única. La
comodidad de un alias no valía una arista invertida.

### Declarado, porque no es un import sino una mudanza

`src/types/clinical-quantity.ts` usa `num()` de `lib/uci` para normalizar la coma
decimal mexicana — **y hace bien en usarla**: es la fuente única del repo. Lo que
está mal es **dónde vive**: es un módulo de dominio completo (dimensiones,
factores, constructores) alojado en `types/` por herencia.

Moverlo a `lib/` toca a todos sus consumidores. Es un cambio que **se decide**, no
que se cuela en una madrugada, así que queda escrito en vez de hecho a medias.

**Hoy no hay ciclo — está comprobado.** Pero es exactamente por donde aparecería
el primero: `lib/X → types/Y → lib/Z`. Y un ciclo de importación no siempre
rompe; cuando rompe, lo hace con un `undefined` dentro de un módulo que se lee
perfecto. En un motor clínico eso es **una cifra que no sale**, no un error que
salte.

La excepción está escrita **archivo por archivo** y su prueba exige que la lista
**encoja, nunca crezca**. Una excepción con nombre y motivo es una deuda visible;
relajar la regla es una deuda que desaparece de la vista.

---

## Lo que esta medición NO dice

Que la dirección sea correcta **no dice que los límites entre módulos sean los
correctos**. Un `lib/` enorme con todo dentro cumpliría las tres reglas y seguiría
siendo un solo nudo.

Lo que estas tres cubren es la clase de deterioro que **se cuela sin que nadie lo
decida** — un import de conveniencia un martes por la tarde. La otra clase, la de
poner el límite en el sitio equivocado, se decide y se escribe en
[`docs/decisions/`](../decisions/README.md); no hay guardián que la sustituya.

---

## Cómo se comprueba

`src/__tests__/la-direccion-de-las-dependencias.test.ts` (8 casos), sobre
`src/lib/arquitectura/grafo-de-dependencias.ts`.

Las tres reglas se cumplen hoy. **El valor de la prueba no es certificarlo**: es
que el día que alguien las rompa se entere en su PR, y no seis meses después
cuando deshacerlo cuesta un refactor. Una arquitectura limpia no se mantiene
sola — se mantiene porque algo se pone rojo.
