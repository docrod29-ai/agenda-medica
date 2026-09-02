# Estado de producción — 1-sep-2026

> **Sucede a [`ESTADO-DE-PRODUCCION-2026-08-31.md`](ESTADO-DE-PRODUCCION-2026-08-31.md).**
> Aquel documento cerró con el pin del botón 87 commits atrás y un punto ciego
> declarado. Uno de los dos se cerró; el otro sigue abierto y se dice aquí.
>
> Escrito contestando dos preguntas del dueño: **«¿falta algo o ya se puede
> subir a producción?»** y **«no veo ningún cambio en la aplicación»**.

---

## LO QUE SE SUPO DESPUÉS — léase antes que nada

Este acta se escribió **antes** de REG-431, y hay una frase suya que sin este
aviso se lee al revés de la verdad.

Abajo, en «Respuesta corta», el punto 2 dice que para `nexusmed-v1178` **no había
índices que publicar**. Eso era cierto de ese paquete — y daba a entender algo
falso: que cuando SÍ hubiera índices, el botón los publicaría.

No podía. `firebase.json` declaraba `rules` y **nunca declaró `indexes`**, así que
`--only firestore:indexes` no fallaba: no encontraba nada que publicar y devolvía
`success`. **En la consola del proyecto no había ni un índice compuesto.** Se vio
acompañando al dueño a crearlos a mano, en su pantalla; no la habría cazado
ninguna prueba de este repositorio.

Por eso el acta de v1177 cuadra, y su sello de reglas (REG-416) también: las
reglas sí se publicaban. Los índices nunca.

El arreglo y su guardián están en `main` (REG-431), y con ellos se invirtió el
orden que este documento y el PR #425 daban por bueno: **fusionar primero**, y
sólo entonces desplegar índices.

**Lo que sigue siendo cierto de este acta**: el diagnóstico del botón (REG-504),
las cifras de por qué no se veían cambios, y que la Compuerta 0 pasaba el 1-sep.

---

## Y DESPUÉS EL BOTÓN CORRIÓ — cuatro veces, 2-sep 00:07 UTC

El apartado anterior corrige lo que este acta **daba a entender**. Éste corrige
lo que **pide**: sus §4 y §5 hablan de un botón sin pulsar y de una pregunta sin
contestar. Las dos cosas ya pasaron. Medido en las ejecuciones, no supuesto:

| Ejecución | Cuándo | Árbol | Resultado |
|---|---|---|---|
| [#13](https://github.com/docrod29-ai/agenda-medica/actions/runs/33470948206) | 1-sep 04:46 UTC | `19d58353` | **éxito** — `nexusmed-v1178` |
| [#14](https://github.com/docrod29-ai/agenda-medica/actions/runs/33567555699) | 1-sep 22:42 UTC | `fc3a5159` | fallo |
| [#15](https://github.com/docrod29-ai/agenda-medica/actions/runs/33572744371) · [#16](https://github.com/docrod29-ai/agenda-medica/actions/runs/33573846056) | 1-sep 23:51 y 2-sep 00:07 UTC | `c7eb7032` | **éxito** — `nexusmed-v1179` |

**El `NEEDS_OWNER_VERIFICATION` del §5 está contestado.** «¿Producción sirve
v1178?» — sí, y no por deducción: la Compuerta 3 lo midió contra el sitio vivo
desde el runner de GitHub en la #13. Este contenedor no podía mirar; el runner
sí, y ésa es la diferencia entre declarar una duda y resolverla.

**Los tres pasos del §4 ya se dieron**, y el paquete siguiente encima:
producción está hoy en **`nexusmed-v1179`**, certificada sobre `c7eb7032` — el
primer despliegue que de verdad publica los doce índices compuestos, por lo que
cuenta el apartado de arriba. Su acta es
[`PAQUETE-PRODUCCION-2026-09-01-v1179.md`](PAQUETE-PRODUCCION-2026-09-01-v1179.md).

**El pin del §2 ya no es el del archivo.** `SHA_AUTORIZADO` es hoy `59a11d6b`
(v1179), 20 commits por detrás de la cabeza `c7eb7032`, y los cuatro publicables
son byte a byte idénticos entre los dos. La Compuerta 0 pasa por la misma razón
que explica el §2, con otros dos shas.

---

## Respuesta corta

1. **La aplicación no espera a ningún botón.** Vercel publica por su integración
   con GitHub cada vez que algo entra a `main`. Todo lo que está en `main` ya
   está servido, o lo estará en cuanto Vercel termine ese build — sin
   intervención.
2. **El botón no despliega la app.** Publica `firestore.rules`, certifica y corre
   seguridad y smoke contra el sitio vivo. Para `nexusmed-v1178` **no hay reglas
   ni índices que publicar**: el paquete no las toca.
3. **El botón estuvo roto desde el 31-ago 20:26 UTC.** Ya está reparado **en
   `main`**: entró con el PR #422 como **REG-504** (la versión se deriva del
   árbol autorizado y desaparece de `env:`). Comprobado corriendo la propia
   Compuerta 0 con los valores de hoy — ver §2.
4. **No se ven cambios porque los tres últimos paquetes casi no tienen cara.**
   Cero pantallas nuevas y cero rutas de API nuevas en v1176, v1177 y v1178. Lo
   que traen son controles que no se podían pulsar, un visor que se caía y
   accesibilidad. Está detallado abajo, con las cifras.

---

## 1. Qué está certificado, y qué está sólo publicado

| | |
|---|---|
| **Último cierre completo** | 31-ago **19:33 UTC**, [run 33431057064](https://github.com/docrod29-ai/agenda-medica/actions/runs/33431057064) — éxito |
| **Árbol certificado** | `8f74901d` — `nexusmed-v1177` |
| **Reglas de Firestore** | Publicadas y **selladas** (REG-416) |
| **Pin del botón hoy** | `e72f22a9` — `nexusmed-v1178` |
| **Cabeza de `main` hoy** | `19d58353` — `nexusmed-v1178`, 56 commits por delante del árbol certificado |
| **Qué traen esos 56 commits** | 86 archivos · +12 759 / −278 · **cero rutas de API nuevas y cero pantallas nuevas** (medido con `git diff --name-status … -- 'src/app/api/**/route.ts' 'src/app/**/page.tsx'`). Reglas e índices: idénticos |

«Certificado» y «servido» no son lo mismo, y la diferencia importa: lo primero lo
mide el botón; lo segundo lo hace Vercel solo. Los 41 commits de diferencia ya
están servidos si Vercel construyó la cabeza; lo que les falta es el acta.

---

## 2. El botón estuvo sin poder correr, y hoy ya no — REG-504

No se dedujo del YAML: se corrió **su propia compuerta** con los valores reales.

```
SHA_AUTORIZADO   8f74901d   (árbol de nexusmed-v1177)
cabeza de main   e72f22a9   (árbol de nexusmed-v1178)
VERSION_ESPERADA nexusmed-v1178   ← escrita a mano, movida sin mover el pin

decidirArbolAutorizado(...) →
  ok:false · «41 commits por detrás Y difiere en lo que este workflow publica:
  public/version.txt, public/sw.js»
```

`a1734b2` subió el service worker a v1178 y movió con él `VERSION_ESPERADA`, pero
no `SHA_AUTORIZADO`. Son el mismo hecho escrito en dos renglones, y se separaron.

**El arreglo ya está en `main`** (PR #422, **REG-504**): la versión se **deriva**
del árbol autorizado y desaparece de `env:`. Queda **un** mando, el pin — que
sigue siendo el acto de autorización del dueño. Causa raíz y lo que no cubre:
**REG-504** en `docs/audit/regression-ledger.md`; el golden es
`src/__tests__/la-version-del-boton-no-se-escribe-dos-veces.test.ts`.

### Y hoy la Compuerta 0 pasa. Medido, no deducido

El pin (`e72f22a9`) ya no es la cabeza de `main` —van 15 commits por delante—,
así que la pregunta no es retórica. Se corrió la compuerta con los valores
reales:

```
$ SHA_AUTORIZADO=e72f22a9… CABEZA_DE_MAIN=19d58353… ES_ANCESTRO=si \
  COMMITS_DETRAS=15 PUBLICABLES_DIFIEREN='' node scripts/ops/arbol-autorizado.mjs

El árbol autorizado e72f22a9 está por detrás de la cabeza (19d58353), 15 commits
por detrás, pero TODO lo que este workflow publica o certifica es idéntico:
publicar desde el pin equivale a publicar desde la cabeza.
exit=0
```

Los cuatro publicables —`firestore.rules`, `firestore.indexes.json`,
`public/version.txt`, `public/sw.js`— son byte a byte iguales entre el pin y la
cabeza. Por eso pasa: **no** porque la compuerta se haya aflojado, sino porque
publicar desde el pin y desde la cabeza es publicar lo mismo.

---

## 3. Por qué no se ve ningún cambio

Porque casi no lo hay **de cara**. Los tres últimos paquetes, según sus propias
actas:

| Versión | Publicado | Pantallas nuevas | Rutas de API nuevas | Qué trae |
|---|---|---|---|---|
| v1176 | 31-ago 13:28 UTC | 0 | 0 | La agenda deja de aceptar días que no existen; doble reserva sobre el mismo hueco; accesibilidad medida en Chromium real |
| v1177 | 31-ago 19:33 UTC | 0 | 0 | «Cerrar sesión» y «Ayuda» de `/consultor` no se podían pulsar; las ocho horas de `/asistente` no acusaban el puntero |
| v1178 | **sin certificar** | 0 | 0 | El portal del paciente sin `<main>`; el visor del documento medicolegal se caía con una nota sin `metadata` (REG-415); seis controles que se leían como texto |

Los tres son reparaciones de cosas que **no se veían que se podían usar**, no
funciones nuevas. Un botón que ya se puede pulsar se parece muchísimo al mismo
botón de ayer.

El cambio grande de estos días —`nexusmed-v1175`, 84 commits, REG-373 a REG-413—
se publicó el **31-ago 03:12 UTC** y está vivo desde entonces.

Dicho sin adorno: **el trabajo de ayer fue de instrumentación y de reparación
fina**. De los 627 archivos que separan v1174 de hoy, +72 818 líneas, la mayoría
son pruebas (≈24 900 líneas), documentación (≈20 200) y arneses (≈7 400). Código
de producto: ≈21 900 líneas, y su parte visible son los arreglos de la tabla.

Si lo que se espera ver es **producto nuevo**, esto no lo trae, y ningún
despliegue lo va a hacer aparecer.

---

## 4. Lo que falta para cerrar producción — tres pasos

1. **El botón ya está reparado en `main`** (REG-504, PR #422). No hace falta
   fusionar nada para pulsarlo.
2. **Pulsar el botón** — Actions → «Despliegue a producción (manual)» → *Run
   workflow*. La Compuerta 0 pasa hoy —comprobado arriba—; si Vercel no hubiera
   construido ese árbol, la Compuerta 2 para y no toca nada.
3. **Pegar el sello** que emite el acta (`FIRESTORE_RULES_SHA256`) en
   `firestore.rules.estado.json`. El despliegue lo calcula; confirmarlo sigue
   siendo un acto de alguien (REG-416).

Nada de esto es requisito para que la app esté al día: los tres son el **acta**.

---

## 5. Lo que NO se puede afirmar desde aquí

- **No se pudo mirar el sitio vivo.** La política de red de este contenedor
  rechaza la conexión a `agenda-medica-one.vercel.app`
  (`connect_rejected`, tres intentos). Que producción sirva `nexusmed-v1178`
  queda como **`NEEDS_OWNER_VERIFICATION`**: se comprueba abriendo
  `https://agenda-medica-one.vercel.app/version.txt`. Si dice `nexusmed-v1178`,
  la aplicación está al día y lo único pendiente es el acta. Si dice `v1177`,
  Vercel no ha construido la cabeza y eso sí es un problema de despliegue.
- **El punto ciego del 31-ago sigue abierto**: `public/version.txt` es una copia
  del propio repositorio, así que la cadena de versión no puede detectar una
  deriva entre dos árboles que declaran lo mismo. REG-504 quita una fuente de
  verdad duplicada; **no** cierra ésta.
- **No se corrió nada contra producción.** Ni reglas, ni smoke, ni seguridad:
  eso vive en el botón, y el botón es del dueño.
