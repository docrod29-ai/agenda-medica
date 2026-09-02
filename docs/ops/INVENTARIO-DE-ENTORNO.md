# Inventario de variables de entorno

> **127 variables**, derivadas del árbol por
> `scripts/ops/inventario-de-entorno.mjs`. La lista viva está en
> [`inventario-de-entorno.json`](inventario-de-entorno.json) y la plantilla para
> arrancar, en [`.env.example`](../../.env.example). **Ninguno de los dos se
> edita a mano**: se regeneran.

## Por qué existe

Lo que cada variable espera vivía en comentarios repartidos por el árbol, y no
había `.env.example` ni inventario. Es el patrón que ya costó caro con los
índices de Firestore: **el dato existía y el registro que lo reúne, no**. Así
nadie puede saber cuántas faltan ni pedirlas de una vez, y cada consultorio
nuevo, cada proyecto restaurado y cada máquina de trabajo recién montada las
descubre de una en una, en producción.

```bash
node scripts/ops/inventario-de-entorno.mjs             # regenera
node scripts/ops/inventario-de-entorno.mjs --verificar # falla si está viejo
```

El guardián `ninguna-variable-de-entorno-vive-sin-declarar.test.ts` compara el
árbol contra el inventario: si alguien añade una lectura y no regenera, sale rojo
en su PR y no seis meses después.

## Cómo se reparten

| Ámbito | Cuántas | Qué significa |
|---|---|---|
| **Runtime** | 73 | Las lee la aplicación. Son las que importan para que el producto funcione |
| **Scripts** | 48 | Sólo herramientas y guiones. No hacen falta para levantar la app |
| **Pruebas** | 2 | Sólo en `__tests__` |
| **Plataforma** | 4 | `NODE_ENV`, `CI`, `VERCEL_URL`, `VERCEL_ENV`. Las pone el entorno; no se escriben |

De las 73 de runtime, **31 no tienen respaldo literal**: si faltan, o algo deja
de funcionar o el código lo declara. Las otras 42 caen a un valor por omisión que
el inventario lista.

## Las 16 públicas, y por qué dos parecen un secreto y no lo son

`NEXT_PUBLIC_*` **se inserta en el paquete que baja el navegador**: es texto
plano para cualquiera que abra las herramientas de desarrollo.

Dos llevan «KEY» en el nombre y están bien así, por diseño del proveedor:

- **`NEXT_PUBLIC_FIREBASE_API_KEY`** — identifica el proyecto, no autoriza nada.
  Lo que protege el dato son las reglas de Firestore, no el secreto de la llave.
- **`NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY`** — la clave de sitio de reCAPTCHA
  v3 está pensada para ir en el cliente; el secreto es el del servidor.

Cualquier **otra** `NEXT_PUBLIC_` con `SECRET`, `TOKEN`, `PASSWORD`, `KEY`… sería
un secreto publicado, y hay un caso del guardián que lo vigila.

## Lo que salió al hacer el inventario

### Los secretos fallan cerrado — comprobado, no supuesto

`patient-token.ts` y `receta-token.ts` usan `PORTAL_PACIENTE_SECRET` con un
respaldo de desarrollo que está **escrito en el repositorio**
(`dev-portal-secret-no-usar-en-produccion-…`). No es un agujero: los dos lo
acotan con `NODE_ENV !== 'production'` y en producción **lanzan**
(`throw new Error('PORTAL_PACIENTE_SECRET no configurada')`).

`receta-diseno-token.ts` es el tercero que cuelga de ese secreto y no lanza: cae
a `''`, y entonces no se firma nada. Con
`RECETA_DISENO_FIRMA=obligatoria` eso significa que **todo** el proxy responde
403 — por eso ese candado tiene su condición previa escrita aparte, en
[`RECETA-DISENO-FIRMA.md`](RECETA-DISENO-FIRMA.md).

### Dos listas de superadmin que hay que mantener iguales

| Variable | Quién la usa | Para qué |
|---|---|---|
| `SUPERADMIN_EMAILS` | servidor (`authz/fundador-servidor.ts`) | **manda**: decide autorización y reserva de créditos |
| `NEXT_PUBLIC_SUPERADMIN_EMAILS` | cliente (`superadmin-client.ts`) | sólo lo que se pinta |

El patrón es el correcto —el servidor no confía en la pública— pero son **dos
listas para la misma verdad**. Añadir un socio a una y no a la otra deja la
interfaz y la autorización diciendo cosas distintas, y el síntoma («veo el menú y
me rechaza la ruta») no se parece a la causa.

### Los dos nombres del token de WhatsApp — **cerrado con REG-508**

`WHATSAPP_WEBHOOK_TOKEN` y `WHATSAPP_VERIFY_TOKEN` son alias a propósito: los dos
caminos aceptan cualquiera de los dos, «para no depender de cuál pusiste en
Vercel». Eso está bien y se queda.

Lo que no estaba bien era el literal `agenda-medica-bot`, que vivía en dos sitios
y **el servidor no acepta en ninguno** —`whatsapp/webhook` cae a `''` y rechaza,
sin respaldo, con la decisión escrita al lado—:

- `whatsapp/meta-connect` lo tenía en una constante **sin un solo consumidor**.
- **La pantalla de Configuración lo imprimía como instrucción** para teclear en
  Meta. Eso sí lo veía el médico, y era la mitad que hacía daño: con la variable
  puesta a otra cosa, seguir esa instrucción dejaba el webhook sin verificar y el
  bot mudo.

**Corrección de lo que este archivo decía antes.** Aquí se afirmó que
`meta-connect` «cae al literal y con él registra la suscripción en Meta». **No es
cierto**: esa constante no tenía consumidor y el literal nunca viajó a Meta desde
el código. `registerWebhook` sólo hace `POST /{wabaId}/subscribed_apps`, donde no
va ningún token; el de verificación se teclea a mano en el panel de la app. Se
corrige porque afirmar de más sobre un hallazgo de seguridad envenena el registro
tanto como no verlo.

Hoy: el literal está fuera del código, y la pantalla **nombra la variable sin
enseñar ningún valor**. Lo que queda en sus manos es que el valor de
`WHATSAPP_WEBHOOK_TOKEN` en Vercel y el tecleado en el panel de Meta sean
idénticos — son dos consolas, y eso no lo puede comprobar el repositorio.

## Lo que este inventario NO puede decir

- **Si una variable está puesta en Vercel.** Eso se mira del otro lado —regla
  «el dato tiene que LLEGAR»— y no puede vivir en el repositorio.
- **Si un valor es correcto**, ni si el respaldo por omisión es el adecuado.
- **Respaldos que no son literales**: `?? DEFAULT_OWNER` (real en
  `superadmin-client.ts`) se cuenta como «sin respaldo». Se prefiere ese error a
  la inversa — decir «tiene respaldo» de algo que no lo tiene sería peor.
- **Variables construidas dinámicamente** (`process.env[algo]` con una variable).
  Hoy no hay ninguna; el día que la haya, el lector no la verá.

## Tres defectos del propio lector, para que no se repitan

Se anotan porque los tres hacían que el inventario **mintiera**, y los tres
salieron de probarlo al revés en vez de leerlo:

1. **Importarlo lo ejecutaba.** El guardián importaba la función y de paso corría
   el cuerpo del script, que **regeneraba los archivos antes de compararlos**: la
   prueba se arreglaba a sí misma y pasaba siempre. Ahora el script sólo actúa
   cuando se ejecuta directamente.
2. **Contaba la prosa.** Un comentario que menciona una variable la metía en el
   inventario. El primer conteo dijo 128 por una mención en el comentario de una
   prueba; son 127.
3. **Y al quitar la prosa se comió código.** Emparejar aperturas y cierres de
   bloque con una expresión regular no funciona en un árbol real:
   `src/lib/firebase.ts` tiene doce aperturas y nueve cierres, y una sin pareja
   se tragó la lectura verdadera de `NEXT_PUBLIC_FIREBASE_EMULATORS`. El
   inventario pasó a decir que esa variable **no se leía** — el error en la
   dirección peligrosa. Ahora se descartan líneas enteras de prosa y nunca se
   recorta dentro de una línea.

El cuarto no era del lector sino de lo que leía: tomaba el valor por omisión del
**primer archivo que lo tuviera**, incluidas las pruebas, y por eso atribuía a
`PORTAL_PACIENTE_SECRET` un respaldo benigno que sólo existe en su prueba,
cuando en producción lanza. Ahora los respaldos se leen sólo de código que corre.
