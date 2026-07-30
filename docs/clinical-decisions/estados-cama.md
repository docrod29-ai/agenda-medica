# ADR · Estados de cama (§2)

**Motor:** `estados-cama` · `src/lib/hospital/estados-cama.ts`
**Estado:** `validado`. La política de rotación **la decidió el Dr. el
2026-07-30**: limpieza terminal requerida por defecto, configurable por hospital.

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

`src/__tests__/hospital-estados-cama.test.ts` — **42 casos**.

| Congela |
|---|
| Limpieza, mantenimiento y bloqueada **no** son camas libres |
| Reservada y aislamiento tienen bucket propio |
| El **ocupante manda** sobre la etiqueta guardada |
| Los buckets suman el total |
| `ocupada → libre` **no pasa** por omisión; el flujo de tres pasos sí |
| El override exige autorización, motivo, autor y fecha — y **devuelve el registro** |
| `confirmarLimpieza` es la única forma de llegar a «lista» |
| El módulo **no** codifica productos, tiempos ni protocolos |
| «Limpia y lista» **sí** cuenta como disponible |
| `ESTADOS_CAMA_NO_DISPONIBLE` y este módulo **no pueden divergir** |
| Ninguna transición apunta a un estado inexistente |

## La decisión del Dr. (2026-07-30) — el default cambia

Le pregunté si dejaba pasar `ocupada → libre`. Su respuesta fue que **no**, y que
el default del producto debía ser el seguro:

> «Después de discharge/transfer, la cama NO debe pasar directamente a AVAILABLE.
> Default global: `OCCUPIED → PENDING_TERMINAL_CLEANING → CLEAN_READY →
> AVAILABLE`. `requireTerminalCleaningAfterDischarge = true`. Debe ser
> configurable por hospital, pero el default seguro de NexusMED es TRUE.»

Lo fundamenta en las recomendaciones de CDC sobre limpieza y desinfección
terminal tras traslado o egreso, con énfasis en UCI y en precauciones basadas en
transmisión, incluido el reprocesamiento del equipo no crítico. **Fundamento
aportado por el médico**, no verificado por mí contra la fuente primaria: la
decisión se registra como suya.

Mi propuesta anterior —dejar `false` para «no imponer una regla que no se
preguntó»— era el error opuesto: un default permisivo se vuelve la práctica real
del 90 % de las unidades, porque nadie cambia lo que ya funciona.

### El flujo, en estados

```
ocupada → limpieza (PENDING_TERMINAL_CLEANING)
        → lista    (CLEAN_READY, confirmada por personal autorizado)
        → libre    (AVAILABLE)
```

`limpieza` conserva el valor que ya está guardado en los documentos y pasa a
significar explícitamente «pendiente de limpieza terminal»: ningún documento deja
de ser válido. Se añaden `lista` y `limpieza_aislamiento`.

### La configuración

```ts
PoliticaCamas = {
  requiereLimpiezaTerminalAlEgreso: true,
  requiereConfirmacionLimpieza:     true,
  permiteOverrideEmergencia:        true,
  exigeMotivoOverride:              true,
}
```

Un hospital puede desactivarlo. El default de NexusMED es el de arriba.

### El override existe, pero deja huella

Una UCI llena a las 3 de la mañana necesita poder saltarse el paso. El override
exige **usuario autorizado + motivo escrito + quién + cuándo**, y devuelve un
`RegistroOverride` que el llamador tiene que guardar. Un override silencioso es
peor que no tenerlo: convierte la política en decorado.

### Lo que el módulo NO codifica

Productos, tiempos de contacto, protocolos de desinfección y qué precauciones
exigen `limpieza_aislamiento`. Eso es configuración de control de infecciones del
hospital, no una constante universal — y un caso del golden falla si aparece.

### Una decisión mía que conviene revisar

`lista` (CLEAN_READY) cuenta como **disponible**. La cama está limpia y puede
recibir; no contarla sería subestimar la capacidad, que es el error inverso al
que este módulo corrigió y en una UCI llena es igual de grave. Si prefiere que no
cuente hasta liberarla, es una línea.
