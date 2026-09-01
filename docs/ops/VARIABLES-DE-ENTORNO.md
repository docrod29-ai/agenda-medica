# Variables de entorno pendientes — qué poner, y cómo saber que llegó

> Alcance: las **cuatro** que estaban en la cola del dueño. No es el inventario
> completo — ver «El hueco que queda declarado», al final.

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

## El hueco que queda declarado

El código lee **128 variables de entorno** distintas (16 de ellas `NEXT_PUBLIC_`)
y **no existe `.env.example` ni ningún inventario**. Lo que cada una espera vive
en comentarios repartidos por el árbol.

Es el mismo patrón que tenían los índices de Firestore antes de
`docs/ops/INDICES-DE-FIRESTORE.md`: un comentario no es un entregable, y así
nadie puede saber **cuántas faltan** ni pedirlas de una vez. Un consultorio
nuevo, un proyecto restaurado o una máquina de trabajo recién montada lo
descubren variable a variable, en producción.

Este archivo cubre cuatro. Las otras 124 siguen sin declarar, y eso es trabajo
pendiente — no un hueco tapado.
