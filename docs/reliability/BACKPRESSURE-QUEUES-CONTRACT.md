# Contrato de colas y contrapresión

**Carril:** #310. **Estándar:** #320 Gate 3.
**Implementación de referencia:** [`src/lib/reliability/cola.ts`](../../src/lib/reliability/cola.ts)
· golden: `src/__tests__/reliability-cola-y-degradacion.test.ts`.

**No se introduce ningún proveedor de colas ni ninguna infraestructura de pago.** Esto es
el contrato que una cola real tendría que cumplir, más una implementación en memoria que
sirve de banco de pruebas determinista y de modelo para el arnés de carga.

---

## 1. La frontera

```
CAMINO CALIENTE                          │  TRABAJO ASÍNCRONO
el médico está esperando                 │  puede tardar, encolarse y reintentarse
─────────────────────────────────────────┼──────────────────────────────────────────
abrir paciente · abrir encuentro         │  transcripción · razonamiento
buscar paciente · editar nota            │  evidencia · generación de documentos
guardar borrador · reanudar borrador     │  notificaciones · WhatsApp · analítica
agendar cita · firmar nota               │
                                         │
sin proveedor externo en la ruta         │  todo proveedor externo vive aquí
sin reintento largo                      │  reintento acotado con retroceso y jitter
sólo `firmar` puede bloquear             │  ninguno puede bloquear
```

La lista vive en código, no aquí: `src/lib/reliability/clases-de-trabajo.ts`. Este dibujo
es su lectura. Si los dos discrepan, gana el código —y hay un golden que falla el día que
alguien marque una clase asíncrona como bloqueante.

## 2. Lo que todo trabajo encolado lleva

| Campo | Por qué | Si falta |
|---|---|---|
| `id` (identidad) | dos entregas del mismo trabajo son un trabajo | efecto duplicado |
| `clase` | fija presupuesto y cola | reintentos equivocados |
| `clinicId` | atadura al inquilino | encaminar adivinando = fuga |
| `encuentroId` | atadura al destino | resultado aplicado al encuentro que no era |
| `versionAlEncolar` | detecta resultado caduco | pisa verdad clínica ya editada o firmada |

`encolar()` **rechaza** un trabajo sin `clinicId` y un trabajo de clase `hot:` — en tiempo
de ejecución, no sólo por tipos: el tipo no protege de un `as` ni de un JSON que viene de
fuera.

## 3. Presupuesto por clase

De `PRESUPUESTOS` en `clases-de-trabajo.ts`:

| Cola | Tiempo máximo | Reintentos | Por qué ese número |
|---|---|---|---|
| transcripción | 120 s | 3 | lo capturado ya está a salvo; el texto puede llegar tarde |
| razonamiento | 120 s | 2 | sugerir no es decidir; la nota se escribe sin él |
| evidencia | 60 s | 2 | sin evidencia se dice que no hay; nunca se rellena |
| documento | 60 s | 3 | la nota firmada ya es la fuente de verdad |
| notificación | 30 s | 5 | un aviso que no sale no revierte la cita |
| WhatsApp | 10 s | 5 | la cita canónica vive en el expediente, no en el mensaje |
| analítica | 30 s | 1 | perder una métrica no es un incidente clínico |

Retroceso exponencial con **jitter completo** y presupuesto de tiempo total: manda el que
se agote primero. Ver `src/lib/reliability/reintentos.ts`.

**El jitter no es un detalle.** La única política que había en el repositorio
(`src/lib/whatsapp/reintentos.ts`) no lo tiene, y para un cron en serie da igual. A diez mil
consultorios significa que todos reintentan en el mismo milisegundo tras una caída y
vuelven a tumbar al proveedor que se estaba recuperando.

## 4. Contrapresión

La cola tiene **fondo**. Llena, `encolar()` devuelve `{encolado: false, motivo: 'cola-llena'}`
y quien llama lo dice en voz alta.

Rechazar es aceptable porque ninguna de estas clases es del camino caliente, por
construcción. Una cola infinita no es resiliencia: es el mismo fallo más tarde y con más
trabajo perdido dentro.

Bajo saturación, la garantía que se conserva es exactamente ésta:

> las colas pueden retrasarse; **abrir, editar, guardar y reanudar el encuentro no**.

El arnés lo comprueba: con `--fallo=ia-caida` a 2 000 médicos, el p95 del camino caliente no
sube (`src/__tests__/arnes-carga-consultorio.test.ts`, caso «la latencia del camino caliente
NO se contagia»).

## 5. Carta muerta

Agotado el presupuesto, el trabajo pasa a `carta-muerta` con su `motivoTerminal`
(`permanente`, `intentos-agotados`, `presupuesto-agotado`) y **sigue siendo consultable**.

Un trabajo que desaparece en silencio es peor que uno que falla: nadie sabe que faltaba. En
el contrato de evidencia de #310 eso se llama `silentProviderFailureCount` y es bloqueador
incondicional.

## 6. Resultado caduco

`resultadoCaduco(trabajo, versionActual, encuentroFirmado)`:

- encuentro firmado → **caduco siempre**, no hay versión que valga;
- versión actual mayor que la de encolado → caduco;
- en cualquier otro caso → se aplica.

Es #320 Golden Path B punto 9 escrito como función. La comparación `>` sola no basta: el
caso firmado se cuela, y el golden lo prueba al revés.

## 7. Deduplicación

Dos capas, porque protegen de cosas distintas:

1. **Identidad del trabajo** (`id`) — protege de la entrega «al menos una vez» del
   transporte.
2. **Llave de idempotencia** (`src/lib/reliability/idempotencia.ts`) — protege del
   reintento del CLIENTE y del doble clic, que el transporte no ve.

`src/lib/whatsapp/dedup.ts` ya hace la primera para los webhooks de Meta, con `create()`
atómico de Firestore. Ése es el patrón; no se sustituye, se generaliza.

**Una diferencia deliberada:** el dedup de WhatsApp es *fail-open* (si el almacén falla, se
procesa) porque su peor caso es responder dos veces a un mensaje. La idempotencia de
acciones consecuentes es *fail-closed*: si no se puede garantizar la identidad, no se
ejecuta. Su peor caso es una segunda receta.

## 8. Cancelación

Un encuentro que se cierra, se firma o se descarta **cancela** sus trabajos pendientes. Si
el trabajo ya está en vuelo, no se puede cancelar el proveedor — pero su resultado llega
caduco por la regla 6 y se descarta. Las dos defensas hacen falta: la primera ahorra la
llamada, la segunda protege la nota.

## 9. Lo que este contrato NO resuelve

- **No es una cola durable.** `ColaEnMemoria` se pierde si el proceso muere. Una cola
  durable es infraestructura y necesita autorización del dueño.
- **No decide el proveedor.** Firestore como cola, Cloud Tasks, un `outbox` propio —los tres
  pueden cumplir esto. La decisión tiene coste y no se toma aquí.
- **No está cableado.** Ninguna ruta usa hoy este módulo; ver
  [`HANDOFF-306.md`](HANDOFF-306.md).
