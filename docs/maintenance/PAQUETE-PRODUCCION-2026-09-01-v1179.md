# Paquete de producción — `nexusmed-v1179`

> **Estado: PREPARADO, NO PUBLICADO.** Publicar sigue siendo decisión del dueño
> (`.claude/rules/deployment-and-flags.md`).

> **SUPERADO — 1-sep-2026 23:51 UTC. PUBLICADO Y VERIFICADO.** El dueño corrió el
> botón sobre `59a11d6b`: ejecuciones
> [#15](https://github.com/docrod29-ai/agenda-medica/actions/runs/33572744371) y
> [#16](https://github.com/docrod29-ai/agenda-medica/actions/runs/33573846056), las
> dos en verde, con la Compuerta 3 midiendo `nexusmed-v1179` contra el sitio vivo.
> La línea de arriba no se borra: era verdad cuando se escribió, y un acta que se
> reescribe deja de servir para reconstruir qué se sabía y cuándo. Lo que pasó de
> verdad está en el **§5**.
>
> **Dos cifras del cuadro sí se corrigieron**, porque no eran criterio sino
> medición: se habían tomado dos commits antes del árbol que acabó publicándose.
> Se declararon **40 commits · 121 archivos · +17 571 / −693**; el árbol publicado
> es **42 · 125 · +17 798 / −695**. La fila que no se movió es la que importa:
> **49 archivos de código de producto**, los mismos que al declararse. Lo que entró
> después fueron pruebas y papel.

| | |
|---|---|
| **Versión del service worker** | `nexusmed-v1178` → **`nexusmed-v1179`** |
| **Última línea desplegada** | `e72f22a9` — v1178, **verificada contra el sitio vivo** (ejecución [#13](https://github.com/docrod29-ai/agenda-medica/actions/runs/33470948206), 1-sep 04:46 UTC) |
| **Árbol que se publicó** | `59a11d6b` — el `SHA_AUTORIZADO` del botón; `public/version.txt` = `nexusmed-v1179` |
| **Commits que entran** | **42** (25 directos + 17 merges) |
| **Rango de fechas** | 23-ago → 1-sep-2026 |
| **Superficie** | 125 archivos · +17 798 / −695 · **49 de código de producto** |
| **Regresiones cerradas** | **18** (REG-417…432, 504, 505) |
| **Rutas de API nuevas** | **0** |
| **Pantallas nuevas** | **0** |
| **Reglas de Firestore** | **NINGUNA nueva** — se republican idempotentes; el sello de la #15 está en el §5 |
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
✅ apuntar el botón a v1179            PR #430, fusionado
✅ Actions → «Despliegue a producción (manual)» → Run workflow   ← lo pulsó el dueño
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
  *(Resuelto en el §5: el botón publicó el árbol `59a11d6b`, ni uno más.)*
- **No afirma que los índices estén construidos al terminar el botón.**
  `firebase deploy` contesta al ENVIAR. La construcción va por su cuenta y puede
  fallar después, con el `success` ya impreso.
  *(Resuelto en el §5, y no por el `success`: mirando la consola.)*
- **No afirma que RPO/RTO estén medidos.** Siguen en `NOT_MEASURED` (R-14): hace
  falta una restauración real en un entorno de nube autorizado, y la evidencia
  sintética no lo cierra.
- **No afirma que una capacidad de receta filtrada sea inservible.** Quince
  minutos y el ligado al dueño **acotan** el daño de una fuga; no la impiden.

---

## 5. Qué pasó al pulsarlo

Escrito **después** de la ejecución [#15](https://github.com/docrod29-ai/agenda-medica/actions/runs/33572744371),
leyendo sus pasos uno por uno. No es la predicción del §3: es lo que midió el
runner.

### Los veintiún pasos, en verde

| Paso | Qué comprobó | Resultado |
|---|---|---|
| Compuerta 0 | el árbol autorizado publica lo mismo que la cabeza de `main` en las cuatro rutas que despliegan | ✅ |
| Compuerta 1 | SHA, versión y REG-323 | ✅ |
| Compuerta 2 | Vercel apunta al proyecto principal `agenda-medica` | ✅ |
| Compuerta 3 | **el sitio vivo sirve `nexusmed-v1179`** | ✅ |
| Firestore · REGLAS | `--only firestore:rules` | ✅ · sello emitido |
| Firestore · ÍNDICES | `--only firestore:indexes` | ✅ |
| Índices · explicar un 403 | sólo corre si el paso anterior falló por permiso | **omitido**, que es lo correcto |
| Seguridad · producción | cabeceras sobre `RUTAS_PRIVADAS` del sitio vivo | ✅ |
| Smoke público · Smoke portal fail-closed | | ✅ · ✅ |

Duración total: **1 min 31 s**. Cerró con `PRODUCTION_RELEASE=SUCCESS`.

### El paso 14 omitido es la prueba de REG-433

Ese paso **no existía** en la ejecución [#14](https://github.com/docrod29-ai/agenda-medica/actions/runs/33567555699).
Allí reglas e índices iban en **un solo paso** —«Firestore · desplegar reglas e
índices»—, y cuando los índices se rechazaron con 403 el paso entero se marcó
`failure`: el acta imprimió `FIRESTORE_RULES=failure` acusando al **único trabajo
que había salido bien**, porque las reglas sí se habían publicado. Eso es REG-433.

El arreglo partió el paso en dos (`rules` e `indices`) y añadió éste, que nombra
el rol que falta. Su condición es `always() && steps.indices.outcome == 'failure'`,
y ese `always()` no es adorno: un `if:` sin función de estado va implícitamente
envuelto en `success()`, así que un explicador de fallos escrito sin él **no corre
nunca justo cuando hace falta**. Se cazó imprimiendo el grafo de pasos resuelto,
no leyendo el YAML.

Que aquí salga **omitido** es, por tanto, la forma que tiene ese paso de decir que
no hubo fallo que explicar.

### Los doce índices, comprobados donde se ven

`firebase deploy` **contesta al ENVIAR**; el `success` del paso 13 dice que se
mandaron, no que existan. Por eso se miró la consola del proyecto, ya con el rol
`roles/datastore.indexAdmin` concedido a
`firebase-adminsdk-fbsvc@nexomed-agenda.iam.gserviceaccount.com`:

**doce índices compuestos, los doce en `Habilitado`**, y los doce cuadrando campo
por campo con `firestore.indexes.json`. La pestaña que días antes estaba vacía
(REG-431) es la misma que ahora los lista.

Es la regla de `.claude/rules/el-dato-tiene-que-llegar.md` aplicada al pie de la
letra: el dato no llegó cuando la función que lo escribe devolvió éxito; llegó
cuando se vio del otro lado.

### Lo que este §5 sigue sin afirmar

- **Que la degradación por índice ausente se ejerciera de verdad.** Los índices
  ya estaban construidos cuando se miró, así que la ventana en la que
  `indice-que-todavia-no-esta.ts` habría contestado `degradada: true` pasó sin
  observador. Lo que hay son sus casos oro, no una observación en producción.
- **Que RPO/RTO estén medidos.** Siguen en `NOT_MEASURED` (R-14).
- **Que el árbol de hoy sea éste.** `main` ha avanzado desde `59a11d6b`; lo que
  vaya después es otro paquete y necesita su acta.
