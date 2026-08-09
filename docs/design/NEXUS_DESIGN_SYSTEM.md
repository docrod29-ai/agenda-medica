# Sistema de diseño NexusMED

> **Unidad**: `DESIGN-SYSTEM-001` (iteración 1 de V9) · abierta el 9-ago-2026
> **Fuente de las cifras**: `node scripts/design/trinquete-de-diseno.mjs`
> **Techo congelado**: `docs/design/design-techo.json`
> **Guardián**: `src/__tests__/el-sistema-de-diseno-tiene-trinquete.test.ts`

---

## El defecto no era el que la directiva esperaba

V9 §0 pedía evitar que la interfaz pareciera «SaaS genérico salido de un
generador», con degradado morado y todo tarjetas redondeadas.
`PATIENT-UX-TRUTH-001` fue a contarlo y encontró lo contrario: **cero
degradados, cero `from-purple`, una sola `rounded-2xl`, un `backdrop-blur`**, y
una identidad declarada con los cocientes de contraste WCAG calculados a mano
dentro del propio CSS.

El defecto real es el simétrico, y es peor porque no se ve en una captura:

> **El sistema de diseño existe y la aplicación no le obedece.**

| Medida | Antes de esta unidad |
|---|---|
| `style={{` | **6 193** en **182** archivos |
| Hexadecimales escritos a mano | **1 199** usos · **141** distintos |
| Tamaños de letra en línea | **2 903** usos · **39** distintos |
| Radios en línea | **1 099** usos · **22** distintos |
| Espacio en línea (padding/margin/gap) | **1 246** usos · **33** distintos |
| Tokens que Tailwind veía | **4** |

## La causa raíz era mecánica, no cultural

`@theme inline` exponía cuatro valores: fondo, texto y dos familias de letra.
Todo lo demás vivía en variables CSS que Tailwind no mira, **así que no existía
la utilidad que usar**. Quien escribía una pantalla no tenía `bg-nx-s1` ni
`text-nx-4` a mano; sólo le quedaba `style={{ background: '#131518' }}`.

182 archivos con estilo en línea no son 182 descuidos. Son una mecánica. Y hasta
que la mecánica cambie, cualquier repintado se deshace solo.

Además faltaban escaleras enteras: **no había ninguna escala de espacio**, y los
33 valores distintos de padding/margin incluían **todos los enteros del 1 al
16**. Eso no es una escala con excepciones: es un continuo.

---

## Las cuatro escaleras

Cada peldaño sale de la medición, no del gusto. Viven en `src/app/globals.css`,
con su razón escrita al lado.

### Tipografía — anclada en 13 px

```
--fs-1  10px   micro: sellos, superíndices, marcas de procedencia
--fs-2  11px   pie de tabla, metadatos
--fs-3  12px   secundario
--fs-4  13px   CUERPO — el tamaño por defecto de la aplicación (539 usos)
--fs-5  14px   cuerpo enfatizado, campos de formulario
--fs-6  16px   subtítulo de sección
--fs-7  20px   título de pantalla
--fs-8  26px   display
--fs-9  34px   hero — sólo con --font-display
```

**Los medios píxeles no son un peldaño.** 12,5 px (466 usos), 11,5 px (274),
13,5 px (127) y 10,5 px (115) suman casi la mitad del volumen y nadie los
distingue mirando una pantalla. Lo que sí se nota es que entre el título y el
pie de tabla haya once escalones y ninguno signifique nada.

### Espacio — base 4, con dos medios pasos abajo

```
--sp-1  2px    --sp-4  8px     --sp-7  24px
--sp-2  4px    --sp-5  12px    --sp-8  32px
--sp-3  6px    --sp-6  16px    --sp-9  48px
```

Los medios pasos (2 y 6) están porque un producto clínico denso los necesita de
verdad. Los nueve peldaños cubren 544 de los 1 246 usos actuales tal cual están.

### Radio — seis peldaños, más la píldora que ya tenía razón escrita

```
--r-xs 4px · --r-sm 6px · --r-md 8px · --r-lg 10px · --r-xl 12px · --r-2xl 16px
--r-pill 9999px · --r-circulo 50%
```

Los seis cubren el 87 % de los 1 099 usos.

### Elevación — tres peldaños donde había 22 sombras distintas en 24 usos

```
--elev-1  0 1px 2px      (tinte 6 %)
--elev-2  0 8px 24px -8px (tinte 10 %)
--elev-3  0 20px 60px -12px (tinte 18 %)
```

El negro se tinta con `color-mix` sobre `var(--text)` en vez de fijarse en
`rgba(0,0,0,…)`: así la sombra sigue al tema claro, en vez de manchar el crema
con una sombra pensada para el lienzo oscuro.

---

## El prefijo `nx-`, y por qué no es cosmética

Las utilidades nuevas se llaman `bg-nx-s1`, `text-nx-4`, `p-nx-5`,
`rounded-nx-md`, `shadow-nx-2`.

El código **ya usa** utilidades por defecto de Tailwind: `text-xs` (29 usos),
`text-sm` (24), `p-6`, `px-2`, `gap-2`, `rounded-md` (8), `shadow-2xl`.
Declarar `--text-sm` o `--spacing-6` en `@theme inline` las **reescribiría en
silencio** y encogería pantallas que hoy están bien, sin que ninguna prueba lo
notara y sin que nadie abriera un navegador.

El prefijo hace imposible esa colisión. Y de paso vuelve el sistema greppable:
`nx-` es nuestro. Hay una prueba que falla si alguien declara una utilidad sin
prefijo en los cuatro espacios de nombre que pueden chocar.

---

## Esta unidad no repinta nada

Deliberadamente. Colapsar 12,5 px en 13 px son 466 cambios visuales repartidos
por toda la aplicación, y la directiva V9 §4 es explícita: **no se aprueba
interfaz leyendo el código.** El repintado va detrás del navegador.

Lo que esta unidad entrega es **la escalera y el trinquete que la defiende**.
Sin trinquete, la escalera nueva convive con el continuo viejo y en tres meses
hay 45 tamaños de letra en vez de 39 — es exactamente lo que pasó con el lint
hasta que se le puso techo.

### Cómo funciona el trinquete

```bash
node scripts/design/trinquete-de-diseno.mjs              # comprueba
node scripts/design/trinquete-de-diseno.mjs --actualizar # congela
```

- **Sube** → falla, y dice **en qué archivos** creció.
- **Baja** → falla también, pidiendo que se apriete el techo. Un margen que no
  se congela se lo come el siguiente descuido.

Corre dentro de `npx vitest run`, no aparte: una compuerta que hay que acordarse
de lanzar no es una compuerta.

---

## Qué **NO** cubre este sistema, hoy

- **No dice que ninguna pantalla se vea bien.** El trinquete cuenta literales.
  Una pantalla con cero estilos en línea puede ser ilegible y pasará.
- **No mide accesibilidad.** Contraste, foco, objetivo táctil y trampa de foco
  son `A11Y-GATE-001`, que sigue abierto. Hoy hay **1** prueba de accesibilidad
  entre 540 y es una expresión regular sobre `layout.tsx`.
- **No hay regresión visual.** Sigue sin definirse (V9 §4 la declara «nueva»).
- **No vigila** `src/app/globals.css`: ahí los literales viven a propósito.
- **No detecta** un hexadecimal en un `.scss`, en un `<style>` servido, ni
  construido por concatenación (`'#' + tono`). Es vocabulario, no criterio: lo
  que no está en el patrón **no se vigila**, no se da por bueno.
- **Nadie ha abierto una pantalla.** Todo son recuentos sobre el código.

## Lo siguiente, en orden

1. **`A11Y-GATE-001`** — `axe` sobre las 9 pantallas del paciente. WCAG 2.2 AA.
2. Migrar `components/ui/` (12 primitivas, 24 % de adopción) a las utilidades
   `nx-`, que es donde el cambio se multiplica sin repintar a mano.
3. Los 127 literales `#3d5afe`/`#3D5AFE`. **Ojo**: `DESIGN_STATE.md` decía que
   este cambio «no cambia un píxel». **Es falso en el tema claro** —
   `--nexus-solido` vale `#2845EA` ahí, así que sustituir el literal por el
   token sí cambia el color. Es un arreglo (el literal ignora el tema), pero es
   un cambio visual y necesita navegador.
4. Colapsar los medios píxeles. Repintado: detrás del navegador.
