# Traspaso a #306 — el punto seguro de la consulta tiene que VERSE

> Este documento es un traspaso, no una petición de rediseño. El motor está
> escrito, probado y listo; lo que falta es una línea de interfaz, y la interfaz
> de la consulta es de #306. **Nada de este carril ha tocado
> `src/app/(dashboard)/consulta/`.**

---

## Lo que YA está bien, y no hay que tocar

Auditado sobre `src/app/(dashboard)/consulta/[patientId]/page.tsx` el
23-ago-2026. Cinco defensas, y las cinco funcionan:

| defensa | dónde | por qué está bien resuelta |
|---|---|---|
| autoguardado al servidor cada 30 s | `autoguardarRef` + `setInterval(…, 30000)` | el intervalo se arma **una vez** y lee un ref. Atarlo a las dependencias hacía que, dictando sin pausas, no disparara nunca. |
| guardados serializados | `cadenaGuardadoRef.current.then(…)` | dos autoguardados no crean la nota dos veces. |
| escritura rancia | `vistoEnRef` + `updateNota(…, vistoEnRef.current)` | dos pestañas dejaron de pisarse: el servidor se niega si la marca de modificación no es la que esta pestaña vio. |
| red local anti-caída | `localStorage[\`nx.consulta.bkp.${patientId}…\`]`, ofuscado | sobrevive a un refresco y a un cuelgue, con pestillo anti-resurrección tras cerrar sesión. |
| cierre de sesión | `salir-seguro.ts` | espera el **acuse** de guardado de verdad, y si no llega **no purga lo local**. |

Todo eso es más de lo que tienen casi todos. El hueco es otro.

---

## El hueco

`#312` lo pide con estas palabras: *«autosave/recovery contract for active
consultation work with **visible last-safe checkpoint**»*.

Hoy la pantalla enseña un botón «Guardar borrador» que gira mientras guarda. Al
médico eso le dice que **algo está pasando ahora**. No le dice lo único que
necesita saber cuando se le va el wifi a media consulta:

> **¿qué es lo último que quedó a salvo, y a qué hora?**

Y hay un caso peor: cuando el autoguardado lleva cuatro minutos fallando porque
la red se cayó, **la pantalla se ve exactamente igual que cuando todo va bien**.
Un guardado que falla en silencio es peor que uno que no existe: si no hay
autoguardado el médico lo sabe y guarda a mano; si lo hay y falla callando, el
médico confía y no guarda.

---

## Lo que este carril deja hecho

`src/lib/durability/autosave-contrato.ts` — módulo **puro**, sin interfaz, sin
reloj propio, probado en `durabilidad-respaldo-y-restauracion` y ejercitado por
`npm run simulacro:recuperacion` (escenario `punto-seguro-de-la-consulta`).

```ts
import { calcularPuntoSeguro } from '@/lib/durability/autosave-contrato'

const punto = calcularPuntoSeguro({
  ultimoConfirmadoEnServidorMs,   // instante del último guardado CONFIRMADO
  ultimaCopiaLocalMs,             // instante de la última copia en localStorage
  ultimoCambioMs,                 // instante del último cambio del médico
  guardandoAhora,                 // ya existe: el estado `guardando`
  fallosSeguidos,                 // NUEVO: hay que contarlos
  conflictoDeVersion,             // NUEVO: `updateNota` se negó por marca rancia
  firmada,                        // ya existe
}, Date.now())

// punto.frase          → texto listo para pintar, en el idioma del médico
// punto.estado         → al-dia | guardando | pendiente | sin-confirmar | en-riesgo | conflicto
// punto.exigeAtencion  → true cuando NO se puede pasar por alto
// punto.dondeEstaSalvo → servidor | este-navegador | en-ninguna-parte
// punto.antiguedadMs   → por si la pantalla prefiere su propio formato
```

Frases que devuelve hoy (generadas, no fijadas a mano):

- `al-dia` → «A salvo en el servidor hace 20 s.»
- `pendiente` → «A salvo hace 35 s. Hay cambios más nuevos sin guardar.»
- `sin-confirmar` → «El último guardado no se pudo confirmar. A salvo en el servidor: hace 1 min.»
- `en-riesgo` → «Sin conexión con el servidor. Lo último a salvo allí es de hace 4 min; lo de después sólo está en este navegador.»
- `conflicto` → «Otra pestaña o dispositivo cambió esta nota. Lo último a salvo aquí es de hace 1 min; lo que escribas ahora no se está guardando.»

---

## Lo que #306 tiene que hacer

### 1. Llevar la cuenta de tres cosas que hoy no se cuentan

Ninguna es un cambio de arquitectura; son tres `useRef`:

- **`ultimoConfirmadoEnServidorMs`** — se pone al resolverse la promesa de
  `guardarBorrador`, **no** al lanzarla. La diferencia entre las dos es
  exactamente el estado que hay que enseñar.
- **`fallosSeguidos`** — se incrementa cuando `guardarBorrador` rechaza y se
  pone a cero cuando confirma.
- **`conflictoDeVersion`** — `updateNota` ya se niega ante una marca de
  modificación distinta; hoy ese rechazo se trata como un error más. Es otra
  cosa: no se arregla solo y no se debe reintentar.

### 2. Pintarlo donde ya se mira

Junto al botón «Guardar borrador», que es donde el ojo va cuando el médico
piensa en guardar. Sugerencia, no imposición:

- `exigeAtencion === false` → texto secundario, discreto, `role="status"`.
- `exigeAtencion === true` → tratamiento que no se pueda pasar por alto y que
  **no** se pierda si el médico está mirando otra parte de la pantalla. Un aviso
  urgente que llega en el tercer párrafo no llegó.

Restricciones del sistema de diseño que aplican aquí: contraste ≥ 4.5:1,
`role="status"` para que un lector de pantalla lo anuncie sin robar el foco, y
**nunca** un color como único portador del significado.

### 3. Enseñar de cuándo es el borrador al recuperarlo

`SUCESOS_DE_CONTINUIDAD` marca dos huecos con `cubiertoHoy: false`. El segundo
es éste: al reabrir la consulta se ofrece la copia local, pero **no se dice de
cuándo es**. Aceptar un borrador sin saber su antigüedad es aceptar a ciegas
—puede ser de hace treinta segundos o de anteayer— y el médico no tiene forma de
elegir.

---

## Lo que este carril NO va a hacer

- No tocar `consulta/[patientId]/page.tsx`. Es de #306 y hay un escritor activo.
- No cambiar el intervalo de 30 s, la serialización de guardados ni el control
  de escritura rancia: los tres están bien y llevan su propia historia de
  defectos detrás.
- No decidir el tratamiento visual. `exigeAtencion` es un booleano; cómo se
  pinta es del sistema de diseño.

---

## Cómo comprobar que llegó

La regla «el dato tiene que LLEGAR» aplica igual aquí:

1. Abrir una consulta y dictar. Ver la frase cambiar de `pendiente` a `al-dia`.
2. Cortar la red (DevTools → offline). A los tres fallos —90 segundos— la frase
   tiene que pasar a `en-riesgo` **y hacerse notar**.
3. Abrir la misma nota en otra pestaña y guardar. En la primera, `conflicto`.
4. Refrescar. El borrador vuelve, **y dice de cuándo es**.

Con el `git diff` no basta: esto se comprueba mirando la pantalla.
