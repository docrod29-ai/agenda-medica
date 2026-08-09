# Estado del sistema de diseño — V9

> Se escribe **a mano**, tras cada iteración. Las cifras derivables viven en
> `MASTER_STATE.json` y en `docs/design/SCREEN_INVENTORY.md` (generado).

**Iteración en curso**: `DESIGN-SYSTEM-001` **abierta** el 9-ago-2026 (la
auditoría `PATIENT-UX-TRUTH-001` quedó cerrada el 8-ago).

---

## 9-ago-2026 · el cimiento, puesto

Se cierran los pasos **1, 2 y 3** de los seis que `GENERIC_AI_AESTHETIC_AUDIT.md`
§6 prescribe para esta unidad.

**1 · `@theme inline` pasa de 4 entradas a 36.** Era la causa raíz: superficies,
bordes, texto, marca, semántica clínica, radio, espacio y sombra ya son
utilidades de Tailwind. `inline` no es un detalle — sin él la utilidad copiaría
el valor del tema oscuro y el tema claro dejaría de funcionar, con las utilidades
ya repartidas por la aplicación y **sin que fallara nada**.

**2 · Las escalas que no existían**: espacio (8 pasos, base 4 px, que es la que
el código ya usaba de hecho), los tres radios intermedios que faltaban entre
`--r-pill` y `--r-circulo`, y **dos** sombras — cortas a propósito, porque
«exceso de sombras» está en la lista de lo que la interfaz no debe parecer. Hoy
no cambian un píxel: existen para que la próxima pantalla tenga a dónde ir.

**3 · El trinquete**, en `el-sistema-de-diseno-tiene-donde-ir.test.ts`:

| Guardián | Estado |
|---|---|
| `@theme inline` expone ≥ 36 entradas | sólo puede subir |
| ningún token expuesto apunta a una variable inexistente | «el dato tiene que LLEGAR», en CSS |
| literales hexadecimales fuera de `globals.css` | **techo 1 161**, sólo baja |
| pasos de sombra | ≤ 2, y subirlo es una decisión de diseño |

Los cuatro **probados al revés**: encoger `@theme` a las cuatro entradas falla,
un token que apunta a la nada falla, y tres colores nuevos a mano rompen el
trinquete.

## Una corrección a la auditoría, antes de que cueste 54 archivos

`GENERIC_AI_AESTHETIC_AUDIT.md` §6.3 propone empezar por `#3d5afe` **«que es
puro y no cambia ni un píxel»**. Eso es cierto sólo en el tema oscuro.

```
--nexus-solido → #3D5AFE en oscuro   ·   #2845EA en CLARO
```

Un `#3d5afe` reteclado a mano **se queda igual en los dos temas**; convertirlo a
`var(--nexus-solido)` lo cambia en el claro. Puede que sea justo lo que hay que
hacer —seguir al tema es la razón de ser del token— pero **es un cambio visual en
122 sitios de 54 archivos**, y la directiva V9 §4 prohíbe aprobar interfaz
leyendo el código.

Se deja sin hacer, a propósito, para una sesión que pueda **abrir una pantalla**.
Este contenedor no tiene credenciales de Firebase: el build compila y se cae al
recoger datos de página.

## Lo que sigue en esta unidad

4. Compuerta de accesibilidad (`axe`) sobre la superficie del paciente —
   `A11Y-GATE-001`.
5. Los literales *slate* que no siguen al tema, en 10 archivos.
6. Las tablas, con `.table-wrap.rwd`, que ya existe — `DESIGN-TABLAS-001`.

Y el barrido de literales de marca, **con navegador**, cuando lo haya.

---

---

## Lo que se sabe hoy, y no se sabía ayer

**La premisa de la directiva no se cumple aquí.** No hay «cara de producto
generado por IA»: cero degradados, cero `from-purple`, una `rounded-2xl`, una
`shadow-2xl`, un `backdrop-blur`. Hay una identidad declarada, oscura por
defecto, con los cocientes de contraste WCAG calculados a mano y escritos en el
propio CSS.

**El defecto real es otro: el sistema existe y la aplicación no le obedece.**

| Medida | Valor |
|---|---|
| `style={{` | **6 065** en **177 de 200** archivos (88,5 %) |
| `className` | 816 |
| Hexadecimales a mano | **1 205** (151 distintos) |
| `fontSize` en línea | ~3 000, ~**60 valores** — la escala declarada tiene 6 |
| Radios en línea | ~19 valores — el sistema declara 3 |
| Adopción de `components/ui/` | **48 de 200** archivos (~24 %) |
| Tokens que Tailwind ve | **4** (`globals.css:126-131`) |

## La causa raíz, y por dónde se empieza

`@theme inline` expone a Tailwind cuatro valores. Todo lo demás vive en
variables CSS que Tailwind no ve, así que **no hay utilidades que usar** y el
código no tiene alternativa al estilo en línea. No es dejadez: es mecánica.

`DESIGN-SYSTEM-001` empieza ahí. **No por colores** — lo prohíbe §13 de la
directiva y además el color no es el problema.

## La prueba de que el enfoque funciona

`--r-pill`. La píldora estaba escrita de cinco formas (`100`, `999`, `9999`,
`99`, `50`). Se creó **un** token con su razón escrita, y hoy tiene **131
adopciones**. Un token bien puesto sí se adopta aquí. Falta repetirlo para
espacio, radio, tipografía y color, **cada uno con su guardián**.

## Reparado en esta iteración

**REG-266 · `@keyframes spin`** no existía en ningún sitio global, y lo
referencian 90 sitios incluidos `ui/Spinner` y `ui/Button loading`. Lo definían
31 pantallas en `<style>` locales, así que el giro funcionaba «según en qué
pantalla estuvieras». Reparado y sellado con
`toda-animacion-tiene-su-fotograma.test.ts`.

## Compuertas nuevas: ninguna todavía

Accesibilidad, regresión visual, móvil y flujo en navegador **siguen sin
definirse**. Es lo que `DESIGN-SYSTEM-001` tiene que entregar. Hoy hay **1**
prueba de accesibilidad entre 540, y es una expresión regular sobre `layout.tsx`.

## Orden para `DESIGN-SYSTEM-001`

1. Ensanchar `@theme inline`.
2. Tokens de espacio, radio y sombra.
3. Un guardián de trinquete por token. Empezar por `#3d5afe`/`#3D5AFE` (125 usos
   en dos mayúsculas): es puro y no cambia un píxel.
4. `axe` sobre las 9 pantallas del paciente. Objetivo WCAG 2.2 AA.
5. Los literales *slate* que no siguen al tema, en 10 archivos.
6. Las tablas, adoptando `.table-wrap.rwd` que ya existe.

## Lo que este estado NO afirma

Nadie ha abierto una pantalla. Todo son recuentos sobre el código. **Ninguna
pantalla está aprobada**, y la directiva V9 §4 dice que no se aprueba interfaz
leyendo código.
