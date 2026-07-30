# ADR · Estados de cama (§2)

**Motor:** `estados-cama` · `src/lib/hospital/estados-cama.ts`
**Estado:** `validado` para lo estructural. La política de limpieza queda
**pendiente de decisión del Dr.** y por eso es un parámetro, no una constante.

## Fuente de verdad

Charter §2 (vía ICU-001): los estados de cama pasan de **4 a 7**. El tipo
`EstadoCama` ya lo hizo en ICU-002c; esto es la otra mitad — qué significa cada
estado **para la capacidad** y qué transiciones describen algo real.

## Referencia

Ninguna fuente clínica externa: son estados operativos de la unidad. El módulo
**no** decide quién ocupa qué cama ni quién requiere aislamiento.

## El defecto que cierra

`ESTADOS_CAMA_NO_DISPONIBLE` estaba declarado en `src/types/hospital.ts` y **no
lo usaba nadie**. El tablero contaba como ocupadas sólo las camas en `ocupada`,
así que una cama en **limpieza**, en **mantenimiento** o **bloqueada** se sumaba
a «camas libres».

Un jefe de guardia que lee «4 libres» y sólo puede usar 1 está decidiendo un
ingreso sobre un número que no existe. El tablero ahora cuenta por
disponibilidad real y desglosa reservadas, aislamiento y fuera de servicio.

Segundo defecto, en la misma pantalla: el selector de estado ofrecía sólo
`libre · bloqueada · limpieza`. Los tres estados nuevos eran inalcanzables desde
la interfaz, y una cama que ya estuviera en uno de ellos mostraba el selector en
blanco. Ahora se ofrece el estado actual más los alcanzables desde él.

## Por qué «disponible» no es un sí/no

Dos estados no caben en el binario:

- **reservada** — libre, pero apartada. Es el flujo B del charter (reservar
  antes de que llegue el paciente). Contarla como libre anula la reserva.
- **aislamiento** — puede recibir, pero **sólo a quien lo requiera**. Quién lo
  requiere es criterio médico, así que la cama sale como `condicionada` y la
  decisión se queda con quien la toma.

## Golden

`src/__tests__/hospital-estados-cama.test.ts` — **22 casos**.

| Congela |
|---|
| Limpieza, mantenimiento y bloqueada **no** son camas libres |
| Reservada y aislamiento tienen bucket propio |
| El **ocupante manda** sobre la etiqueta guardada |
| Los buckets suman el total |
| Sin política, `ocupada → libre` se permite; con ella, se bloquea |
| La política cambia lo que se ofrece en pantalla |
| `ESTADOS_CAMA_NO_DISPONIBLE` y este módulo **no pueden divergir** |
| Ninguna transición apunta a un estado inexistente |

## Lo que NO se asume — pendiente del Dr.

Si una cama puede pasar de **ocupada a libre sin limpieza** es una política de
control de infecciones de cada unidad. El módulo no la impone ni la omite: entra
como parámetro obligatorio (`FALTA_POLITICA_LIMPIEZA`).

Mientras el Dr. no la fije, el tablero pasa `false` — **no aplicar una regla que
no se preguntó**. En la práctica no cambia nada hoy: el selector no aparece en
camas con ocupante. Cuando la fije, el valor sale de la configuración del
hospital y el mismo motor la aplica sin tocar la pantalla.
