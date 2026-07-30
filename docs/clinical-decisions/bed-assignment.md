# ADR · Asignación de camas append-only

**Motor:** `bed-assignment` · `src/lib/hospital/bed-assignment.ts`
**Estado:** `validado` — no contiene criterio clínico; es aritmética de intervalos.

## Fuente de verdad

**Charter NEXUSMED CRITICAL CARE OS §1 y §2** (Dr. David Alonso Rodríguez Luna):

> «La cama **NO** identifica al paciente. La estancia identifica al episodio
> clínico. La cama es una **localización temporal**.»
> «No mezclar estado de cama con estado clínico.»

Los cinco flujos que el charter exige soportar (A–E) son el criterio de
aceptación de este motor, y están transcritos uno por uno en el golden.

## Referencia

No aplica una fuente clínica externa: aquí no hay umbrales, dosis ni criterios
médicos. Es álgebra de intervalos semiabiertos `[desde, hasta)` sobre hechos
append-only. La semántica de intervalo se eligió para que un traslado deje
`hasta === desde` sin producir solape ni hueco.

## Golden

`src/__tests__/bed-assignment.test.ts` — **24 casos**.

| Congela |
|---|
| **Flujo A** paciente → ingreso → UCI → cama |
| **Flujo B** cama **reservada** antes de que llegue el paciente (una reserva no ocupa) |
| **Flujo C** cama temporal → definitiva, sin solape |
| **Flujo D** piso → UCI (una cama de piso no hereda estancia UCI) |
| **Flujo E** UCI → piso → **UCI otra vez**, y las DOS estancias se conservan |
| El string `Internamiento.cama` sigue funcionando como respaldo, y la asignación gana |
| La `fuente` se declara (`asignacion` \| `legado`) para poder auditarla |
| Dos pacientes en la misma cama = conflicto **visible**, no silencioso |
| Asignaciones que se **tocan** no solapan (semiabierto) |
| Trasladar una asignación cerrada, o a una hora anterior al inicio, **lanza** |
| `trasladar` no muta la entrada |

## Unidades y firma

```ts
camaVigenteDe(BedAssignment[], instanteIso, camaLegado?) → { camaId, fuente } | null
trasladar(vigente, destino, instanteIso, motivo?) → { cierre, apertura }
conflictos(BedAssignment[]) → ConflictoCama[]
```

Sin unidades físicas. El instante entra por parámetro: el motor no lee el reloj.

## Dato faltante

Sin asignaciones **ni** string de respaldo ⇒ `null`, nunca una cama inventada.
Fecha inválida ⇒ no cubre y no genera conflicto (un dato malformado no debe
colgar la ficha ni fabricar una alarma). Un conflicto **se devuelve**, no se
resuelve solo: dos pacientes en una cama es algo que un humano tiene que ver.

## Por qué existe

`Internamiento.cama` era un STRING y la unión cama↔paciente se hacía comparando
texto. No había historia de traslados —quedaban como texto libre dentro de
`movimientos[].detalle`—, ni forma de reservar una cama, ni manera de saber quién
la ocupó la semana pasada. El flujo E (volver a UCI) sobrescribía la estancia
anterior.

## Compatibilidad y rollback

`Internamiento.cama` **no se borra**. Durante la transición conviven y el lector
prefiere la asignación con respaldo al string — el patrón de REG-014. Revertir es
dejar de leer las asignaciones: el string sigue ahí.
