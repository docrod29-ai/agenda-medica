# El alto del teléfono — lo que se midió, y lo que sigue sin poder medirse

**Medido el 1-sep-2026**, Chromium 390×844 (iPhone 14 en CSS px), contra el build
de producción servido en `:3000` con los emuladores de Firebase y la clínica
sintética de `scripts/design/sembrar-capturas.mjs`.

```bash
npx firebase emulators:start --only auth,firestore --project demo-nexusmed-test
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
  node scripts/design/sembrar-capturas.mjs
npm run build && npx next start --port 3000     # con NEXT_PUBLIC_FIREBASE_EMULATORS=1
node scripts/design/medir-el-alto-del-telefono.mjs
```

## Por qué el ALTO

Los arneses de móvil que ya existían miden el **ancho**: desbordamiento
horizontal, objetivo táctil de 44×44, contraste, foco. El alto no lo medía nadie,
y es donde vive la familia de defectos que **sólo** aparece en un teléfono: un
contenedor de alto fijo en `vh`, una barra inferior que tapa, y un control que se
ve y no recibe el toque.

## Lo que encontró — dos defectos reales

| | Antes | Después |
|---|---|---|
| **`/pacientes`** · «¿Por qué está aquí?» | `elementFromPoint` en su centro devolvía `.nx-fila-abrir`: el toque caía en el velo de la fila y **navegaba al expediente** en vez de abrir la lente. **3 filas de 3**, las que tienen un pendiente vivo — justo las que esa pregunta existe para explicar | sin controles tapados (REG-425) |
| **`/calendario`** · el único alto fijo en `vh` del árbol | `div height: calc(-52px + 100vh)` → **792px de alto contra 735px visibles: 57px por debajo de lo que se ve**. En iOS es peor: `100vh` en Safari es la altura con la barra del navegador OCULTA | sin alturas en `vh` (REG-426) |

Y un **falso positivo que se quitó del arnés**, porque un aviso correcto e inútil
enseña a ignorar la lista: en `/citas` el `<input type="date">` vive a 1×1 px con
`clip-path` —oculto a propósito, enfocable con teclado, con un botón visible que
le llama `showPicker()`— y salía como «tapado por btn». Un control de 1px no se
toca con el dedo, y de su tamaño ya se ocupa el guardián de 44×44.

## Lo que este arnés NO puede decir — `BLOCKED_EXTERNAL`

**No es un iPhone.** Corre en Chromium con el TAMAÑO de un teléfono. Los dos
mecanismos del rebote de WS-05 son de WebKit y aquí no existen:

- `overflow-anchor`, que Chromium implementa y WebKit no — una escritura tardía
  de scroll que en un iPhone se siente, aquí la compensa el motor;
- el rebote elástico del documento al encadenar el gesto.

**WebKit no se puede instalar en este entorno.** Comprobado hoy, no supuesto:

```
$ PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0 npx playwright install webkit
Error: Download failed: server returned code 403
  'request blocked: no rule or allowlist entry allows host "cdn.playwright.dev"'
Error: … host "playwright.download.prss.microsoft.com"
```

Y el propio proxy lo confirma como denegación de política, no como fallo de red:

```
$ curl -sS "$HTTPS_PROXY/__agentproxy/status"
"recentRelayFailures": [ { "kind": "connect_rejected",
  "detail": "gateway answered 403 to CONNECT (policy denial or upstream failure)",
  "host": "cdn.playwright.dev:443" }, … ]
```

**Lo desbloquea el dueño**, de una de estas dos formas:

1. añadir `cdn.playwright.dev` y `playwright.download.prss.microsoft.com` a la
   política de red del entorno, y entonces `npx playwright install webkit` deja
   correr el proyecto `iphone-safari` que `playwright.config.ts` ya declara; o
2. un iPhone real, que es lo que §38 pide de verdad: 390px, diez repeticiones,
   `scrollTop` que nunca baje solo.

Hasta entonces **WS-05 no se marca `PROVEN`**, y este acta no debe usarse para
eso. Lo que sí cierra es el alto, que se puede medir en cualquier motor y hasta
hoy no se medía en ninguno.
