# Variables de entorno pendientes — qué poner, y cómo saber que llegó

> Alcance: las **cuatro** que estaban en la cola del dueño. El inventario
> completo de las 127 está en [`INVENTARIO-DE-ENTORNO.md`](INVENTARIO-DE-ENTORNO.md).

## La regla que decide cuándo se pueden poner

**Una variable de Vercel no surte efecto hasta el siguiente despliegue.** El
proceso vivo sigue con el entorno con el que arrancó. Y aquí eso no es un
detalle, porque rige la regla de `deployment-and-flags.md`: **un despliegue
arrastra TODO lo no desplegado**, no «lo último que se pidió».

Medido el 1-sep-2026: el árbol que autorizó la última ejecución del botón
(`e72f22a`, 31-ago 15:40) está **17 commits detrás** de la cabeza de `main`
(`47f0cd9`, 31-ago 23:09). Entre ambos va el carril de **durabilidad** completo
—respaldo conciliable, restauración con cinco candados, supresión ARCO— con
**53 archivos y 9 987 líneas**. Poner estas variables y redesplegar publica todo
eso.

**Lo que este repositorio NO puede afirmar**: qué árbol sirve producción **ahora
mismo**. `public/version.txt` dice `nexusmed-v1178` y eso es un archivo del
repositorio, no una medición del sitio vivo — es justo la confusión que cerró
REG-505. Desde este entorno la salida a Vercel está bloqueada, así que la
comprobación es del dueño: `curl https://agenda-medica-one.vercel.app/version.txt`
y la lista de despliegues en el panel.

## Las cuatro

### 1 · `OPS_ALERTA_WEBHOOK` — Vercel (Production)

Una URL **https** que reciba un `POST` con JSON. Sirve un webhook de Slack, de
Discord, un tema de `ntfy.sh` o un Zapier.

| | |
|---|---|
| Formato | `https://…` — se rechaza `http://` («mandaría el estado de la plataforma en claro») |
| Se lee en | `src/lib/ops/alerta.ts` |
| Timeout | 5 s |
| Sin ella | El vigilante corre igual y devuelve `enviada: false` **con su razón**. No despierta a nadie |

Se elige webhook y no un proveedor a propósito: así no se contrata nada, no se
añade dependencia, y la decisión son dos minutos.

**Cómo saber que llegó** — el vigilante corre cada 15 min y su respuesta lo dice:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://agenda-medica-one.vercel.app/api/cron/vigilante
```

Busque `enviada: true` y `destino: <host>`. Si sale `enviada: false`, la razón
viene al lado. **La URL nunca se registra en los logs**: un webhook lleva su
secreto en la ruta.

### 2 · `TIPO_CAMBIO_USD_MXN` — Vercel (Production)

El tipo de cambio del **DOF del día que usted declara**. Lo pone usted o su
contador; el código no trae ninguno por omisión, y es deliberado: «escribir aquí
un 17 o un 20 de memoria daría una conversión que en pantalla se ve igual de
exacta que la buena, y sobre esa cifra se decide un precio».

| | |
|---|---|
| Formato | Número con **punto** decimal y sin símbolo: `18.35` |
| Se lee en | `src/app/api/superadmin/contabilidad/route.ts` |
| Sin ella | La contabilidad usa el supuesto viejo y lo declara **en ámbar** como supuesto, no como medición |

#### Automatizarlo está DIFERIDO, no descartado — D-024 (4-sep-2026)

El dueño preguntó si el tipo de cambio puede actualizarse solo cada día. **Sí se
puede, y el número a mano se pudre en silencio**, así que la pregunta es buena.
Se difiere porque hoy esa cifra la ve una sola persona, no hay ingresos que
convertir, y ponerla a mano cuesta un minuto cada varios meses. Se retoma cuando
el margen sea una decisión de negocio y no un número simbólico.

**El diseño queda escrito para que ese día no se improvise.** Tres cosas, y las
tres son la diferencia entre que sirva y que mienta:

1. **La fuente es Banxico, no una API de divisas.** Una API genérica devuelve el
   precio de MERCADO; la contabilidad usa el que publica el **DOF**. Automatizar
   contra la fuente equivocada daría dos números para el mismo gasto —el panel
   por un lado y la declaración al SAT por otro—, que es justo lo que esta
   variable evita hoy obligando a poner el del contador.
   **Antes de cablear nada se mira la respuesta REAL de Banxico**, no su
   documentación (regla «el dato tiene que LLEGAR»).

2. **Se guarda el tipo de cambio POR FECHA, no un único valor «actual».** Los
   costos de agosto se convierten con el de agosto. Un único valor vigente haría
   que la utilidad de los meses pasados **cambiara sola** cada vez que se abre el
   panel — peor que un número viejo, porque un número viejo al menos no se mueve.

3. **Falla cerrado y lo dice.** Si no se pudo consultar, NO se rellena con el
   último que había ni con un cero: se declara «no se pudo consultar, esta cifra
   es del día tal». Es literalmente **REG-511** con otra ropa —allí un `npm audit`
   que no corrió se publicó como «cero vulnerabilidades»— y sería reincidir en la
   misma familia con el número sobre el que se decide un precio.

**Coste real**: la integración, el histórico por fecha, el fallo cerrado y sus
guardianes. Más un token de Banxico, gratis pero que solicita el dueño — o sea
que no elimina el paso manual, lo cambia por otro una sola vez.

**Cuidado con el formato**: la lectura es `Number(…) || null`. Un `18,35` con
coma, o un `$18.35`, dan `NaN` → `null` → **se comporta exactamente igual que si
no estuviera puesta**, sin error y sin aviso distinto. Compruébelo en
`/superadmin/contabilidad`: el costo de IA debe dejar de decir «supuesto».

Vecinas, por si las quiere ajustar en el mismo viaje: `COSTO_CREDITO_MXN` e
`INFRA_MENSUAL_MXN` (ésta sí trae un valor por omisión, 1500).

### 3 · `STRIPE_WEBHOOK_SECRET` — Vercel (Production)

El `whsec_…` que **Stripe emite al crear el endpoint**, no una contraseña que se
inventa. Primero se crea el endpoint en Stripe, apuntando a:

```
https://agenda-medica-one.vercel.app/api/stripe/webhook
```

y Stripe devuelve el secreto de firma. Ese es el valor.

| | |
|---|---|
| Formato | `whsec_…` |
| Se lee en | `src/app/api/stripe/webhook/route.ts` |
| Sin ella | **Falla cerrado**: `constructEvent` no valida la firma y la ruta contesta `400 Invalid signature`. Ningún webhook de Stripe se procesa |

Es un secreto **por endpoint**: el de prueba y el de producción son distintos. Si
algún día hay endpoint de Preview, lleva el suyo.

**Cómo saber que llegó**: en Stripe, el endpoint tiene un botón de reenvío de
eventos. Un evento reenviado debe pasar de `400` a `200`. Mientras dé `400`, el
secreto no es el de ese endpoint.

### 4 · `ASSEMBLYAI_API_KEY` — **no es de Vercel**

Ésta es la excepción de la lista y conviene no confundirla: **en Vercel ya
está**. El bloqueo B-11 es que `vercel env pull` la devuelve como `[SENSITIVE]`
—Vercel redacta los valores sensibles— así que no hay forma de tenerla en una
máquina de trabajo sin que el dueño la pegue.

Lo que hace falta es ponerla en el **`.env.local`** de la máquina donde se vaya a
medir. El corpus actuado (12 diálogos, 72 turnos, 5m12s, con el milisegundo de
cada turno) y el medidor **ya están hechos y probados**: en cuanto haya llave, es
un comando.

Se lee en `src/lib/ai-keys.ts` y en `api/expediente/transcribir-diarizado`, y
`resolverClaveIA` deja que la llave del consultorio gane sobre la del entorno.

## La quinta, que no estaba en la cola

`RECETA_DISENO_FIRMA=obligatoria` cierra una ruta que sirve papelería **y
fotografía clínica** sin comprobar sesión. Tiene condición previa, comprobación
en vivo y plan de reversión propios:
**[`docs/ops/RECETA-DISENO-FIRMA.md`](RECETA-DISENO-FIRMA.md)**.

## El inventario completo

Ya existe. El código lee **127 variables** (16 públicas) y todas están declaradas
en [`INVENTARIO-DE-ENTORNO.md`](INVENTARIO-DE-ENTORNO.md), derivadas del árbol
por `scripts/ops/inventario-de-entorno.mjs` y con un guardián que se pone rojo si
alguien añade una lectura sin regenerar. La plantilla para arrancar una máquina
nueva es [`.env.example`](../../.env.example).

**Corrección**: este archivo decía «128». Eran 127: la de más era una mención en
el comentario de una prueba, no una lectura. La cifra sale ahora del inventario.

Este archivo se queda con lo que el inventario derivado no puede saber: qué valor
poner en las cuatro pendientes y cómo comprobar que llegó.
