# Paquete de producción — `nexusmed-v1186`

> **Estado: PUBLICADO Y VERIFICADO — 6-sep-2026, 09:22 UTC.** Autorizado por el
> dueño. El botón corrió sobre el árbol `7c2465ea` (ejecución
> [#26](https://github.com/docrod29-ai/agenda-medica/actions/runs/34024381002))
> y devolvió `PRODUCTION_RELEASE=SUCCESS`.
>
> ```
> VERSION=nexusmed-v1186          FIRESTORE_RULES=success
> FIRESTORE_INDICES=success       SECURITY_E2E=success   (57 casos)
> SMOKE=success (10 casos)        SMOKE_PORTAL=success   (401 sin enlace)
> FIRESTORE_RULES_SHA256=b7966ac9461bb2bd49a93aff0406e38d2a788911c4dffebc9e70046d562ddbd7
> ```
>
> **Lo que el acta NO demuestra**, y por eso se dice aquí en vez de dejarlo
> implícito: que el índice trece esté **construido**. `deploy --only
> firestore:indexes` contesta al ENVIAR; la construcción es asíncrona. Queda ese
> renglón abierto en `docs/ops/INDICES-DE-FIRESTORE.md`, y se cierra mirando la
> consola de `nexomed-agenda`. Si el vigilante empieza a fallar con «The query
> requires an index», ésa es la causa.
>
> Este paquete arrastró **v1184, v1185 y v1186** —los tres estaban preparados y
> sin publicar—, tal como avisaba la sección de abajo.

## Lo primero: ésta es la TERCERA renumeración

`main` avanzó 328 commits, y luego otros 59 mientras esto se fusionaba. Se llevó
REG-515…555, D-032…035 y las versiones v1183, v1184 y v1185. Las 45 unidades de
aquí van ya por **REG-560…604** y **D-036…045**.

Y en la vuelta anterior el detector de colisiones casi deja pasar **veintiún
duplicados**: buscaba `## REG-N —` con raya y `main` escribe `## REG-N ·` con
punto medio. Se vio porque el recuento no cuadraba, **no porque un guardián
avisara**. Ahora la expresión acepta las cuatro formas.

## Qué arrastra este botón

`v1183` está **PUBLICADO Y VERIFICADO**. `v1184` y `v1185` están **PREPARADOS y
sin publicar**, así que pulsar el botón con este árbol publica **v1184, v1185 y
v1186 juntos** — no sólo las 45 unidades de esta rama.

| | |
|---|---|
| **Service worker** | `nexusmed-v1185` → **`nexusmed-v1186`** |
| **Última línea PUBLICADA Y VERIFICADA** | **v1183** |
| **Commits sobre v1185** | **52** |
| **Superficie** | laboratorio, voz, evidencia, expediente, tareas clínicas, ops |
| **Código de producto** | **sí**, y mucho: 45 unidades de la rama + lo de main |
| **Reglas de Firestore** | **UNA sin desplegar** — ver abajo |
| **Índices de Firestore** | **UNO sin construir** — ver abajo, y **bloquea** |

## Las dos cosas que hay que hacer APARTE de pulsar el botón

`vercel --prod` no publica ni reglas ni índices. Estas dos van sueltas y las
tiene que autorizar el dueño.

### 1. El índice — esto SÍ rompe algo si no se hace

Entra una consulta compuesta nueva:

```
errores  ·  where visto == false  ·  orderBy fecha desc
```

del vigilante (`src/app/api/cron/vigilante/route.ts`, REG-578). **Firestore
RECHAZA una consulta compuesta sin su índice.** Si se publica el código sin
construir el índice, el vigilante falla en cada ejecución.

```bash
npx firebase deploy --only firestore:indexes --project nexomed-agenda
```

Está declarado en `firestore.indexes.json` (el trece). El punto 1 de la lista de
comprobación de `docs/ops/INDICES-DE-FIRESTORE.md` queda **REABIERTO**, tal como
ese punto decía que pasaría el día que la tabla creciera.

### 2. La regla — esto NO rompe nada, y conviene saber por qué

```
match /platform_authz_denegadas/{denId} { allow read, write: if false; }
```

Escrita en REG-578 y sin desplegar. **No abre ni cierra nada por sí sola**: el
`match /{document=**}` del final de `firestore.rules` ya deniega todo lo no
declarado, así que la colección está cerrada al cliente esté o no esta regla.
Lo que falta es que sea **explícita**, que es lo que impide que un `match` futuro
más laxo la deje al descubierto sin que nadie lo note.

```bash
npx firebase deploy --only firestore:rules --project nexomed-agenda
```

## Qué entra, en grueso

De la rama de laboratorio (45 unidades, REG-560…REG-604):

- **Laboratorio** — el catálogo maestro del dueño (D-045, 220 analitos) cargado
  por máquina; la unidad se normaliza ANTES de juzgar el número; los factores de
  conversión se CALCULAN de pesos atómicos IUPAC en vez de teclearse; el
  espécimen sale de la cabecera de la hoja, así que una glucosuria de 250 deja
  de archivarse como glucemia; el decimal corrido se SUGIERE y no se corrige.
- **Voz** — umbral de motor decidido (D-043) con trinquete sobre las consultas
  con error crítico, y el crítico real que sigue abierto declarado con nombre.
- **Evidencia, expediente, tareas clínicas, observabilidad** — el resto.

Y de `main`, todo lo suyo desde v1181, incluidos D-023…D-031.

## Lo que este paquete NO trae

- **No se ha visto en un navegador.** Este entorno no llega al sitio vivo: la
  política de red del sandbox contesta 403 al dominio de producción. Todo lo de
  aquí está probado por suite y por build, no por haber mirado la pantalla.
- **`npm run e2e:seguridad:prod` no se ha corrido**, por lo mismo. Va DESPUÉS de
  publicar, que es donde es accionable.
- **La mitad de visión del laboratorio sigue sin medir**: hace falta imágenes y
  llamadas de API. Lo medido es la mitad de texto.

## Compuertas de este árbol

| | |
|---|---|
| `npx vitest run` | se declara abajo, medido sobre este árbol |
| `node scripts/lint-trinquete.mjs` | **94**, igual que el techo |
| `node scripts/design/trinquete-de-diseno.mjs` | sin deuda nueva |
| `npm run build` | compila |

El único rojo es `src/__tests__/ops-timeout-y-punto-ciego.test.ts`, y su fichero
es **idéntico al de `main`**: falla porque el proxy de este entorno contesta 403
en vez de colgarse, así que el ayudante de timeout no puede agotarse. No es de
esta rama y en CI no se reproduce.
