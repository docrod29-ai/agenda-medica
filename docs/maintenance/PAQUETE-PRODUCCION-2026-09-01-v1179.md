# Paquete de producción — `nexusmed-v1179`

> **Estado: PREPARADO, NO PUBLICADO.** Publicar sigue siendo decisión del dueño
> (`.claude/rules/deployment-and-flags.md`).

> **SUPERADO — 1-sep-2026 23:51 UTC. PUBLICADO Y VERIFICADO.** Nada de lo de
> abajo se borra: era verdad cuando se escribió. Lo que pasó de verdad, incluido
> lo que este documento no supo prever, está en §5.

| | |
|---|---|
| **Versión del service worker** | `nexusmed-v1178` → **`nexusmed-v1179`** |
| **Última línea desplegada** | `e72f22a9` — v1178, **verificada contra el sitio vivo** (ejecución [#13](https://github.com/docrod29-ai/agenda-medica/actions/runs/33470948206), 1-sep 04:46 UTC) |
| **Commits que entran** | **40** (24 directos + 16 merges) |
| **Rango de fechas** | 23-ago → 1-sep-2026 |
| **Superficie** | 121 archivos · +17 571 / −693 · **49 de código de producto** |
| **Regresiones cerradas** | **18** (REG-417…432, 504, 505) |
| **Rutas de API nuevas** | **0** |
| **Pantallas nuevas** | **0** |
| **Reglas de Firestore** | **NINGUNA** |
| **Índices de Firestore** | **SÍ — y es el primer despliegue que de verdad los publica** |

---

## 0. LO QUE HAY QUE LEER ANTES DE PULSAR EL BOTÓN

Este paquete **no es como los tres anteriores**. Los otros no tocaban ni reglas
ni índices, y el paso de Firestore era idempotente: publicaba lo que ya había.

Éste publica **doce índices compuestos por primera vez en la historia del
proyecto**, y conviene entender por qué eso no se sabía.

### `firebase.json` nunca declaró dónde estaban (REG-431)

```json
"firestore": {
  "rules": "firestore.rules"     ← declarado
}                                ← "indexes" NUNCA estuvo
```

`firebase deploy --only firestore:indexes` publica los índices **sólo si el
archivo de configuración declara dónde están**. Si no lo declara, **no falla**:
no encuentra nada que publicar y devuelve éxito.

Por eso las actas de v1175, v1176, v1177 y v1178 registran ese paso en
`success` **y no publicaron un solo índice**. Las dos cosas eran ciertas a la
vez, que es exactamente lo que las hacía sospechosas.

Se descubrió acompañando al dueño, paso a paso, a crear los índices a mano en la
consola de Firebase — y encontrando la pestaña **vacía**.

### Qué pasa al publicarlos

Construir un índice sobre una colección con datos tarda **de minutos a horas**.
Y Firestore **no degrada** una consulta que necesita un índice compuesto: la
rechaza con `FAILED_PRECONDITION`.

Mientras se construyen, cuatro consultas quedan sin su índice: el worklist, las
citas del paciente, el resumen de notas, y a quién se le ofrece un hueco.

### Por qué eso ya no rompe una pantalla (REG-424)

`src/lib/firestore/indice-que-todavia-no-esta.ts` corre la consulta buena y,
**sólo** si el error dice que falta el índice, cae al camino de antes y devuelve
`degradada: true`. Eso **sube hasta donde se ve**: `/pendientes` pinta «no se
pudo ordenar por urgencia: lo que se ve son los más antiguos».

Y **no se traga nada más**. Un permiso denegado, una red caída o una regla mal
desplegada siguen subiendo: si esto los absorbiera, convertiría una fuga de
aislamiento en una lista corta, que es peor porque no se ve.

**Consecuencia práctica**: durante un rato después de publicar, algunas listas
pueden salir ordenadas por antigüedad en vez de por urgencia, **diciéndolo**. No
se pierde nada y no hay que hacer nada; se corrige solo cuando Firestore termina.

---

## 1. La base

`e72f22a9` es v1178 y está comprobada, no deducida: la ejecución #13 del botón
cerró con `PRODUCTION_RELEASE=SUCCESS` el 1-sep a las 04:46 UTC, midiendo la
versión contra el sitio vivo.

---

## 2. Qué entra, en orden de lo que le importa al médico

### 2.1 · El expediente se puede recuperar de verdad (#349 — REG-417…420)

Diecinueve módulos de durabilidad, 111 casos oro sellados, y un arnés de
simulacro (`npm run simulacro:recuperacion`).

**El respaldo pasa a formato v2**: el pie lleva recuento por colección y huella
del conjunto. Antes, «restauramos 10 000 documentos» no se podía desmentir si
faltaban 300 — el pie sólo decía un total. Los archivos v1 ya descargados
**siguen restaurándose**: se leen y se declaran «incompletos no verificables» en
vez de degradarse en silencio.

**La restauración tiene cinco candados.** El que más pesa: **un paciente cuya
supresión ARCO consta en el consultorio de destino no vuelve.** Ni con
`sobrescribir=1` —ese permiso es para pisar datos propios, no para deshacer el
derecho de un tercero— ni en modo ensayo, porque un ensayo que prometa que el
expediente vuelve hace que alguien pulse el botón.

Cerró **R-09**, que llevaba días declarado como bloqueado por una dependencia
que, al comprobarla, no existía.

### 2.2 · La firma de la receta deja de ser transferible (#355 — REG-432)

| | Antes | Ahora |
|---|---|---|
| Qué liga el permiso | `path\|exp` | `versión + path + dueño + consultorio + exp` |
| Cuánto dura | **24 h** | **15 min** |
| Sin secreto en el servidor | devolvía la URL pelada | **503** |
| URL sin firma | pasaba salvo una variable de entorno | se rechaza, y **en producción no hay excusa posible** |

La fila que más pesa es la última: antes la puerta estaba abierta y se cerraba
acordándose de poner una variable; ahora está cerrada.

**Y avisa si el membrete no llega al papel.** Ese defecto no existía: lo iba a
crear el propio arreglo —al fallar cerrado el proxy, una imagen sin permiso deja
de verse— y se cerró con él. Avisa **antes** del diálogo de impresión y antes de
guardar el PDF, y **no bloquea**: una receta sin membrete sigue siendo válida.

Cerró **R-06**, que era P0.

### 2.3 · Cuatro consultas vivas llevaban meses sin índice (#425 — REG-421…424, 429, 431)

Y el guardián que debía cazarlo **se saltaba lo que no entendía** (REG-421), y su
limitación declarada tapaba un índice más (REG-422).

### 2.4 · El botón de producción, y el tablero (REG-504, REG-505)

El botón quedó sin poder desplegar y sólo se veía pulsándolo. La versión se
deriva ahora del árbol autorizado en vez de escribirse a mano — la otra mitad del
par que ya se había cerrado para el SHA.

---

## 3. Compuertas, medidas sobre este árbol

```
✅ npx vitest run              12 286 de 12 286
✅ lint-trinquete              95 = techo
✅ trinquete de diseño         sin deuda nueva
✅ npx tsc --noEmit            limpio
✅ npm run build               compila
✅ public/sw.js → v1179 · version-sw.mjs · changelog + acta
⬜ apuntar el botón a v1179            ← PR aparte
⬜ Actions → «Despliegue a producción (manual)» → Run workflow   ← DEL DUEÑO
```

**La suite salió entera en verde**, incluido `ops-timeout-y-punto-ciego` — el
caso que las tres actas anteriores declararon ambiental.

Eso no lo reclasifica: es **intermitente**, no reparado. Necesita una IP que se
trague los paquetes, y depende de si el proxy de la caja responde o no en ese
momento; en la corrida inmediatamente anterior a ésta falló. Se dice así en vez
de escribir «12 286 de 12 286» a secas, porque leerlo dentro de seis meses como
«ya no falla» sería leer una casualidad como un arreglo.

El botón va en un PR aparte por lo de siempre: su compuerta exige un **Vercel
success sobre el SHA al que apunta**, y ningún commit tiene `version.txt = v1179`
hasta que esto entre a `main`.

---

## 4. Lo que este documento NO afirma

- **No afirma que el paquete siga siendo éste al publicar.** Si algo entra a
  `main` antes, entra también en el despliegue. **El bucle autónomo corre cada
  hora**, así que aquí eso no es hipotético — ha pasado varias veces esta semana.
- **No afirma que los índices estén construidos al terminar el botón.**
  `firebase deploy` contesta al ENVIAR. La construcción va por su cuenta y puede
  fallar después, con el `success` ya impreso.
- **No afirma que RPO/RTO estén medidos.** Siguen en `NOT_MEASURED` (R-14): hace
  falta una restauración real en un entorno de nube autorizado, y la evidencia
  sintética no lo cierra.
- **No afirma que una capacidad de receta filtrada sea inservible.** Quince
  minutos y el ligado al dueño **acotan** el daño de una fuga; no la impiden.

---

## 5. Publicado — acta de la ejecución, y lo que el §0 no supo prever

| | |
|---|---|
| **Ejecuciones** | [#14](https://github.com/docrod29-ai/agenda-medica/actions/runs/33567555699) **falló** · [#15](https://github.com/docrod29-ai/agenda-medica/actions/runs/33572744371) y [#16](https://github.com/docrod29-ai/agenda-medica/actions/runs/33573846056) **success** |
| **SHA publicado** | `59a11d6b` — el paquete de este documento |
| **Versión** | `nexusmed-v1179`, medida contra el sitio vivo |

```
FIRESTORE_RULES        = success
FIRESTORE_INDICES      = success      ← el primero de la historia del proyecto
FIRESTORE_RULES_SHA256 = 3032001e141c42eb835674b9219f17a91e491d38f7a7cb55a77177ecbe0e90a9
SECURITY_E2E           = success      57 casos contra producción (2 saltados a propósito)
SMOKE                  = success      10 casos
SMOKE_PORTAL           = success      POST /api/portal sin enlace → 401
PRODUCTION_RELEASE     = SUCCESS
```

### La #14 falló, y falló por lo que este documento avisó

El §0 dijo que este paquete publicaba índices por primera vez. Lo que **no**
supo prever es que la credencial no tuviera permiso para hacerlo: la #14 murió
con `HTTP 403 — The caller does not have permission` al crear el índice de
`appointments`.

Y el acta que se le enseñó al dueño decía `FIRESTORE_RULES=failure`, **acusando
al único paso que había salido bien**. Eso es REG-433, arreglado entre la #14 y
la #15: dos pasos con su propia variable, y el resumen nombrando el rol que
falta y dónde se concede.

**El arreglo no evitó el 403 — hizo que el 403 se pudiera leer.** El dueño
concedió `roles/datastore.indexAdmin` en IAM y volvió a pulsar. La #15 pasó.

### Lo que esto cierra, y lo que no

| | |
|---|---|
| ¿El archivo declara los índices? | **Sí** (REG-431) |
| ¿La credencial tiene permiso? | **Sí**, desde el 1-sep — cerrado |
| ¿Se enviaron los doce? | **Sí**, ejecución #15 |
| ¿Están construidos y `Enabled`? | **No se sabe desde aquí.** Sigue `BLOCKED_EXTERNAL` |

Las tres primeras filas eran **una sola** hasta esta semana, y ahí estaba el
defecto: durante cuatro actas «se publicaron los índices» significó tres cosas
distintas y ninguna se distinguía de las otras.

### Se corrió tres veces

La #14 en rojo, y la #15 y #16 en verde con dos minutos de diferencia. Las dos
verdes publicaron lo mismo: el paso de Firestore es idempotente y el árbol
apuntado era el mismo `59a11d6b`. **No hubo doble publicación de nada.**
