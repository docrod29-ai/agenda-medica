# Paquete de producción — `nexusmed-v1183`

> **Estado: PREPARADO, NO PUBLICADO.** Se escribe ANTES de fusionar a `main`,
> como manda el ciclo. Publicar y fusionar son actos del dueño.

## Lo primero, porque cambia lo que se está publicando

**Este paquete NO publica «lo último». Arrastra v1182 y v1183 juntos.**

`v1182` está PREPARADO y sin publicar: la última línea certificada en producción
es **v1181** (`e78e1242`, ejecuciones #19 y #20 del botón). Quien pulse el botón
con este árbol publica **las dos versiones**, y por tanto los 64 commits que van
de v1181 hasta aquí — no los 45 de la rama de laboratorio.

| | |
|---|---|
| **Service worker** | `nexusmed-v1182` → **`nexusmed-v1183`** |
| **Última línea DESPLEGADA** | `e78e1242` — v1181 |
| **Commits desde v1181** | **64** (58 desde el árbol al que apunta hoy el botón) |
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

del vigilante (`src/app/api/cron/vigilante/route.ts`, REG-533). **Firestore
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

Escrita en REG-533 y sin desplegar. **No abre ni cierra nada por sí sola**: el
`match /{document=**}` del final de `firestore.rules` ya deniega todo lo no
declarado, así que la colección está cerrada al cliente esté o no esta regla.
Lo que falta es que sea **explícita**, que es lo que impide que un `match` futuro
más laxo la deje al descubierto sin que nadie lo note.

```bash
npx firebase deploy --only firestore:rules --project nexomed-agenda
```

## Qué entra, en grueso

De la rama de laboratorio (45 unidades, REG-515…REG-559):

- **Laboratorio** — el catálogo maestro del dueño (D-041, 220 analitos) cargado
  por máquina; la unidad se normaliza ANTES de juzgar el número; los factores de
  conversión se CALCULAN de pesos atómicos IUPAC en vez de teclearse; el
  espécimen sale de la cabecera de la hoja, así que una glucosuria de 250 deja
  de archivarse como glucemia; el decimal corrido se SUGIERE y no se corrige.
- **Voz** — umbral de motor decidido (D-039) con trinquete sobre las consultas
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
| `npx vitest run` | **975 / 976 archivos · 13 230 / 13 231 casos** |
| `node scripts/lint-trinquete.mjs` | **94**, igual que el techo |
| `node scripts/design/trinquete-de-diseno.mjs` | sin deuda nueva |
| `npm run build` | compila |

El único rojo es `src/__tests__/ops-timeout-y-punto-ciego.test.ts`, y su fichero
es **idéntico al de `main`**: falla porque el proxy de este entorno contesta 403
en vez de colgarse, así que el ayudante de timeout no puede agotarse. No es de
esta rama y en CI no se reproduce.
