# Carriles y bucles — quién escribe dónde

> **Para qué sirve**: que dos agentes no escriban el mismo tablero en dos ramas
> distintas. Cuando eso pasa no hay conflicto de Git —cada uno tiene su rama— y
> por eso no se nota: se nota semanas después, al fusionar, cuando el mismo
> defecto está arreglado dos veces de dos maneras.
>
> Escrito el 30-ago-2026, después de encontrar exactamente eso.

---

## La regla

```
UN TABLERO · UN ESCRITOR · UNA RAMA
```

Un tablero de trabajo (el Master Board de Ausculta, el backlog V10, el de
excelencia de producto) tiene **un solo escritor a la vez**. Que cada agente
tenga su propia rama no los separa: los separa que no elijan la misma tarea del
mismo tablero.

Un segundo escritor sobre el mismo tablero no produce el doble. Produce lo mismo
dos veces, y la segunda vez hay que tirarla.

---

## Los carriles vivos (30-ago-2026)

| Carril | Rama | PR | Tablero que lleva | Escritor |
|---|---|---|---|---|
| ~~A — Tablero Ausculta~~ | ~~`claude/ausculta-master-completion-4clx9v`~~ | #398 | **cerrado**: fusionado a `main` el 30-ago | — |
| **B — Excelencia de producto** | `product/ausculta-product-excellence` | #399 | a11y, estados de carga, pantallas | sesión cloud |
| **C — Bucle autónomo** | `product/ausculta-loop-2026-08-30` | #401 | `docs/product/AUSCULTA-MASTER-BOARD.md` (P0/P1) | GitHub Actions |

**Por qué C pudo reabrirse.** Estuvo en descanso declarado mientras el carril A
avanzaba el mismo tablero: la rama del bucle iba 21 commits por detrás de `main`
y A **nacía de su punta**, así que escribir habría abierto historia divergente
del tablero que A estaba cerrando. Al fusionarse A, el tablero se quedó sin
escritor y el bucle volvió a ser el suyo — sobre una rama nueva nacida de `main`.

C no se para ni se reactiva a mano: **lo decide su propia guardia** en el paso
*«Verify this lane is still the writer of record»*. Si su rama queda por detrás
de `main` o alguien construye sobre su punta, el ciclo se planta y lo dice, en
vez de escribir. Se comprobó en la corrida 31 del 30-ago: se plantó en 8 segundos
con `LANE_STALE`, sin instalar dependencias y sin encadenar.

---

## Cómo volver a poner el bucle a trabajar

Cuando el carril A se fusione a `main`, el bucle necesita **dos líneas** en
`.github/workflows/ausculta-autonomous-loop.yml`:

```yaml
    env:
      TARGET_BRANCH: <la rama nueva, nacida de main, que nadie más escriba>
      PR_NUMBER: '<el PR abierto de esa rama>'
```

Condiciones para que esa rama sea legítima, y que el propio bucle comprueba:

1. **Nace de `main` al día** — cero commits por detrás. Trabajar sobre base vieja
   es fabricar el conflicto de la semana que viene.
2. **Tiene PR abierto** y su cabeza coincide con la rama (ya se exigía).
3. **Nadie ha construido encima** — ninguna otra rama con PR abierto desciende de
   su punta. Ésa es la comprobación que faltaba y la que habría evitado esto.

Y una que no comprueba el código, porque no se puede: **que su tablero no lo
lleve ya una sesión cloud**. Eso lo decide quien reparte el trabajo, y se anota
en la tabla de arriba antes de arrancar.

---

## Qué se arregló del bucle el 30-ago-2026

Tres defectos que lo tenían girando en vacío desde el 29-ago 07:41 UTC, con las
corridas **en verde**:

1. **El escritor fallaba y el ciclo se declaraba bien.** `Claude Opus writer`
   salía con código 1 a los ~2 segundos; `continue-on-error: true` se lo tragaba,
   el delta salía vacío y la corrida terminaba en verde. Ahora un escritor que
   falla **y no deja cambios** pinta el ciclo de rojo. Un escritor que falla
   habiendo dejado trabajo real sigue pasando por las compuertas, que es la regla
   que ya estaba y es correcta.

2. **La causa del fallo se tiraba a la basura.** La salida del CLI iba a
   `/tmp/claude-result.json` y moría con el runner: nadie podía saber si era la
   clave, la cuota o un argumento mal puesto. Ahora se sube como artefacto
   (14 días) y las primeras líneas salen en el registro.

3. **El vacío se encadenaba a sí mismo.** `Chain the next cycle` corría con
   `always()`, así que cada ciclo estéril lanzaba el siguiente hasta chocar con
   el freno de cuatro por hora — cuatro corridas cada hora sin escribir una
   línea. Ahora **sólo encadena cuando hubo checkpoint empujado**. El cron
   horario sigue, que es el latido que corresponde a un escritor de 45 minutos.

Lo que **no** cambia: los 200 turnos, el tope de 45 minutos, el alcance de
mutación (nada de `.github/`, reglas, secretos ni manifiestos), la pasada única
de compuertas, la prueba de que la rama no se movió, y que desplegar y fusionar a
`main` siguen siendo del dueño.

---

## Lo que este documento NO afirma

- **No se ha visto un ciclo verde con trabajo real** después del arreglo. Lo
  medido es que el ciclo estéril deja de mentir; que el escritor vuelva a
  escribir depende de la causa que el artefacto revele en la primera corrida.
- **No dice por qué falla el escritor.** Se ha hecho visible, no diagnosticado.
- El tablero de PRs se limpió el mismo día: de **62 abiertos quedaron 19**. Los
  42 cerrados llevan su motivo medido en su propio hilo (cero commits por delante
  de `main`, su REG ya en el ledger, o superado por un carril vivo). Los que
  siguen abiertos —y por qué— están en
  [`PRS-SIN-ABSORBER-2026-08-30.md`](./PRS-SIN-ABSORBER-2026-08-30.md).
  **Ninguno de ellos debería fusionarse tal cual**: van entre 130 y 172 commits
  por detrás. Se rescatan al tablero o se tiran, no se mergean.
