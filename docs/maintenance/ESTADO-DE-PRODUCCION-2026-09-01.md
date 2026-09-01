# Estado de producción — 1-sep-2026

> **Sucede a [`ESTADO-DE-PRODUCCION-2026-08-31.md`](ESTADO-DE-PRODUCCION-2026-08-31.md).**
> Aquel documento cerró con el pin del botón 87 commits atrás y un punto ciego
> declarado. Uno de los dos se cerró; el otro sigue abierto y se dice aquí.
>
> Escrito contestando dos preguntas del dueño: **«¿falta algo o ya se puede
> subir a producción?»** y **«no veo ningún cambio en la aplicación»**.

---

## Respuesta corta

1. **La aplicación no espera a ningún botón.** Vercel publica por su integración
   con GitHub cada vez que algo entra a `main`. Todo lo que está en `main` ya
   está servido, o lo estará en cuanto Vercel termine ese build — sin
   intervención.
2. **El botón no despliega la app.** Publica `firestore.rules`, certifica y corre
   seguridad y smoke contra el sitio vivo. Para `nexusmed-v1178` **no hay reglas
   ni índices que publicar**: el paquete no las toca.
3. **El botón estaba roto desde el 31-ago 20:26 UTC.** Se repara aquí (REG-417).
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
| **Cabeza de `main` hoy** | `e72f22a9` — `nexusmed-v1178`, 41 commits por delante |
| **Qué traen esos 41 commits** | 41 archivos · +2 818 / −130 · **ni reglas, ni índices, ni rutas de API, ni pantallas nuevas** |

«Certificado» y «servido» no son lo mismo, y la diferencia importa: lo primero lo
mide el botón; lo segundo lo hace Vercel solo. Los 41 commits de diferencia ya
están servidos si Vercel construyó `e72f22a9`; lo que les falta es el acta.

---

## 2. El botón llevaba desde ayer sin poder correr — REG-417

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

**El arreglo, en este mismo cambio:** la versión se **deriva** del árbol
autorizado y desaparece de `env:`. Queda **un** mando, el pin — que sigue siendo
el acto de autorización del dueño. Detalle, causa raíz y lo que no cubre:
**REG-417** en `docs/audit/regression-ledger.md`.

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

1. **Fusionar este cambio a `main`** (decisión del dueño). Repara el botón.
2. **Pulsar el botón** — Actions → «Despliegue a producción (manual)» → *Run
   workflow*. Con el pin al día, la Compuerta 0 pasa; si Vercel no hubiera
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
  deriva entre dos árboles que declaran lo mismo. REG-417 quita una fuente de
  verdad duplicada; **no** cierra ésta.
- **No se corrió nada contra producción.** Ni reglas, ni smoke, ni seguridad:
  eso vive en el botón, y el botón es del dueño.
