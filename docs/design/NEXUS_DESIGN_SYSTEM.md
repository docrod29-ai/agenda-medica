# Nexus Design System

> **Unidad**: V9 · `DESIGN-SYSTEM-001` · 9-ago-2026
> **Dónde vive el sistema**: `src/app/globals.css`. Este documento explica **por
> qué**; si el código y este texto se contradicen, **gana el código** — y
> entonces hay que arreglar este texto.
> **Quién lo vigila**: `node scripts/design/trinquete-de-diseno.mjs` y
> `src/__tests__/el-sistema-de-diseno-no-pierde-terreno.test.ts`.

---

## §0 — Lo que esta unidad encontró, y por qué cambia el plan

`PATIENT-UX-TRUTH-001` dejó escrito que había «1 205 hexadecimales a mano, 125
de ellos el azul de marca retecleado». Al ir a sustituirlos, resultó que **la
mayoría no eran literales sueltos: eran respaldos dentro de `var()`**. La
auditoría había contado mal.

Y el hallazgo real era peor que el que se buscaba:

> **Había un segundo sistema de color entero, obsoleto, escondido dentro del
> primero. Y en cinco sitios era el que mandaba.**

280 referencias del tipo `var(--text, #0f172a)`. De ellas:

| | Cuántas | Qué significa |
|---|---:|---|
| **Obsoletas** | **253** | El respaldo no coincidía ni con el valor oscuro ni con el claro de su propio token: eran los colores de **antes** del rediseño |
| **Sin token detrás** | **5** | `--warn-bg`, `--warn-border`, `--warn-text`, `--success` no existían en ningún tema, así que el respaldo era **el único valor que se pintaba jamás** |
| Correctas | 22 | |

El peor caso: `var(--text, #0f172a)`, en 35 sitios. Si ese respaldo llegara a
usarse pintaría texto casi negro sobre el lienzo `#0B0C0E` — contraste
≈ 1,05 : 1, **texto invisible**.

El visible hoy: la tarjeta de aviso de `/pacientes` se pintaba **color crema
sobre el lienzo oscuro**, porque `--warn-bg` no existía. Es la **tercera**
aparición de esta forma; las dos anteriores están contadas en el comentario de
`--panel`.

Y tres más, encontrados por el propio guardián al escribirlo: `--danger`,
`--muted`, `--surface` y `--text1` se usaban **sin respaldo ninguno**. No
pintaban un color equivocado: no pintaban **nada**. El mensaje de error de
Configuración no salía en rojo.

---

## §1 — La regla que gobierna el color

> **Un token, un valor por tema, cero respaldos.**

Un respaldo es un **segundo valor para la misma decisión**. Nace igual que el
primero y se queda quieto mientras el token evoluciona. Nadie lo actualiza
porque nadie lo ve: sólo se pintaría si el token faltara, y el token nunca
falta… hasta el día que sí.

Si el token existe, el respaldo sobra. Si no existe, **se define** — no se
parchea en el sitio de uso.

El techo de `respaldosDeToken` es **0**, y a diferencia de los demás no es deuda
tolerada que va bajando: es un invariante.

---

## §2 — La causa raíz del monolito de estilo en línea

`@theme inline` exponía a Tailwind **cuatro** cosas: `--color-background`,
`--color-foreground`, `--font-sans` y `--font-mono`.

Todo lo demás vivía en variables CSS que Tailwind no conoce, así que **no había
ninguna utilidad de marca que usar**: ni `bg-`, ni `text-`, ni `rounded-`, ni
`p-` que hablaran el idioma del sistema. El código no tenía alternativa y cayó
al estilo en línea — **6 065 `style={{` en el 88,5 % de los archivos**.

No fue dejadez. Fue la consecuencia mecánica de una línea de configuración. Y
mientras siguiera así, repintar pantallas era repintarlas dos veces.

Ahora se exponen ~35 tokens. **Con prefijo `nx-`**, y eso es deliberado:
`--spacing-4` sin prefijo redefiniría `p-4` en toda la aplicación de golpe.
`--spacing-nx-4` **añade** vocabulario sin reinterpretar el que ya se usa. Es la
diferencia entre poder migrar poco a poco y tener que migrar todo a la vez.

---

## §3 — Las escalas

Antes de esta unidad el sistema declaraba radios «6 / 10 / 14» **en un
comentario** y no tenía ningún token de espacio ni de elevación. Lo que había,
contado:

| Dimensión | Valores distintos en uso |
|---|---|
| `fontSize` en línea | ~60, con medios píxeles |
| `borderRadius` | ~19 (3, 5, 7, 9, 11, 20… pura deriva) |
| `gap` | 23 |
| `padding` | 25 |
| `boxShadow` | 24 distintas en 28 usos — **casi ninguna se repetía** |

```
radio        --r-sm 6px · --r-md 10px · --r-lg 14px · --r-pill · --r-circulo
espacio      --sp-1 4 · --sp-2 8 · --sp-3 12 · --sp-4 16 · --sp-5 24 · --sp-6 32
elevación    --elev-1 · --elev-2 · --elev-3        (tres, y se acabó)
movimiento   --mov-rapido 120 · --mov-normal 200 · --mov-lento 320
             --mov-curva · --mov-nada 0
tipografía   --t-overline 10.5 · --t-caption 12 · --t-body 14
             --t-h2 16 · --t-h1 20 · --t-display 28
```

**Estas escalas no inventan estética**: recogen la que ya estaba declarada y
ponen el espacio en la rejilla de 4 px que la mayoría del código ya usaba. **No
cambian ni un píxel de lo existente** — nada las usa todavía. Existen para que
lo próximo tenga dónde apoyarse y para que el trinquete pueda medir lo que
falta.

**Tres niveles de elevación y no más.** Una sombra por componente es lo que
produce 24 sombras distintas y ninguna jerarquía.

**`--mov-nada` tiene nombre a propósito**: bajo `prefers-reduced-motion`, cada
componente decidía por su cuenta qué significa «sin animación».

---

## §4 — La prueba de que este enfoque funciona aquí

No es teoría. `--r-pill` nació para acabar con una píldora escrita de cinco
formas distintas (`100`, `999`, `9999`, `99`, `50`) y hoy tiene **131
adopciones**; la inconsistencia está resuelta.

Lo que faltaba no era disciplina: **era el token al que acogerse**.

---

## §5 — El trinquete, y por qué no es una prohibición

Prohibir hoy el estilo en línea pondría en rojo 177 de 200 archivos. Un guardián
que nadie puede poner en verde se desactiva en una tarde, y con él se pierde la
única señal que había — la lección de REG-245.

Así que se cuenta la deuda, se sella, y **sólo puede bajar**:

| Métrica | Techo | Qué es |
|---|---:|---|
| `respaldosDeToken` | **0** | invariante, no deuda |
| `hexEnLinea` | 565 | literales de color que no siguen al tema |
| `tamanosFueraDeEscala` | 2 029 | `fontSize` fuera de los seis pasos |
| `radiosFueraDeEscala` | 638 | `borderRadius` que no es 6/10/14 |
| `sombrasEnLinea` | 24 | `boxShadow` literal |

El sello **no lleva holgura**: el guardián exige que el techo sea exactamente lo
que mide el script hoy. Un techo con margen es un techo que no muerde.

---

## §6 — Dos defectos que este trabajo introdujo, y cómo se cazaron

Merecen estar escritos porque los dos son de la misma familia que el programa
persigue, y porque el segundo estuvo dos commits fingiendo ser una prueba.

1. **`trinquete-de-diseno.mjs` llamaba a `process.exit(1)` al importarlo.** Una
   regresión de diseño tumbaba la *recolección* de la prueba en vez de fallar un
   caso: el fallo se veía, pero decía otra cosa.

2. **`inventario-de-pantallas.mjs` reescribía el markdown al importarlo.** La
   prueba comparaba el archivo contra `generar()`… **después** de que el propio
   `import` lo hubiera puesto al día. El guardián **no podía fallar nunca**.
   Cuando se probó al revés añadiendo una pantalla, pasó en verde — y se dio por
   bueno.

Los dos vienen de lo mismo: **un script con cuerpo de línea de órdenes en el
ámbito del módulo**. Ahora ese cuerpo sólo corre si se invoca directamente, y
las dos pruebas fallan al revés de verdad.

La lección, que es la de siempre en este proyecto: **probar al revés no es
suficiente si no se mira el resultado.**

---

## §7 — Qué **NO** hace este sistema todavía

- **No hay compuerta de accesibilidad.** Ni `axe`, ni contraste automático. Una
  prueba de accesibilidad entre 550. Es `A11Y-GATE-001`.
- **No hay regresión visual.** Nada compara cómo se veía una pantalla ayer.
- **No se ha abierto un navegador.** La tarjeta crema sobre lienzo oscuro se
  dedujo de que el token no existía; **verla con los ojos sigue pendiente**, y
  lo mismo vale para las demás correcciones de esta unidad.
- **No se ha migrado ninguna pantalla** a las utilidades nuevas. Esta unidad
  pone el cimiento y la compuerta; el barrido es `VISUAL-EXCELLENCE-001`.
- **Los primitivos de `components/ui/` siguen al ~24 % de adopción.** El sistema
  ya no lo impide; queda el trabajo.
- **No mide si una pantalla se ve bien.** Mide adherencia. Una pantalla puede
  estar al 100 % de tokens y ser ilegible.
