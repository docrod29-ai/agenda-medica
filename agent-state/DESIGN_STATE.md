# Estado del sistema de diseño — V9

> Se escribe **a mano**, tras cada iteración. Las cifras derivables viven en
> `MASTER_STATE.json`, en `docs/design/SCREEN_INVENTORY.md` (generado) y en
> `docs/design/trinquete-de-diseno.json` (medido).

**Iteración en curso**: `DESIGN-SYSTEM-001` — **abierta el 9-ago-2026, no
cerrada**. Hecho: tokens, escalas y compuerta. Falta: accesibilidad, regresión
visual y adopción de primitivos.
**Anterior**: `PATIENT-UX-TRUTH-001` cerrada el 8-ago-2026.

---

## Lo que se sabe, y sigue siendo la frase que importa

**La premisa de la directiva no se cumple aquí.** No hay «cara de producto
generado por IA»: cero degradados, cero `from-purple`, una `rounded-2xl`, una
`shadow-2xl`, un `backdrop-blur`. Hay una identidad declarada, oscura por
defecto, con los cocientes de contraste WCAG calculados a mano.

**El defecto real es el simétrico: el sistema existe y la aplicación no le
obedece.** Y la causa era mecánica, no cultural.

## Lo que hizo esta iteración

| | 8-ago | 9-ago |
|---|---|---|
| Tokens que Tailwind ve | **4** | **41** |
| Escala de radio | 2 (`--r-pill`, `--r-circulo`) | **8** |
| Escala de espacio | **ninguna** | **10** peldaños |
| Peldaños tipográficos | 6 | **8** (`.t-body-sm` 13 · `.t-micro` 11) |
| El mismo color en dos mayúsculas | 7 valores · 175 sitios | **0** |
| Hexadecimales distintos | 146 | **139** |
| Compuerta de diseño | **ninguna** | trinquete de 6 cifras, sólo baja |

**La causa raíz, con nombre**: `@theme inline` exponía cuatro tokens, así que no
había utilidades que usar y el código **no tenía alternativa** al estilo en
línea. Ensancharla es lo único de esta unidad que no cambia un píxel.

**Las escalas se midieron, no se inventaron.** Radio 4·6·8·10·12·16 cubre 804 de
1 092. Espacio base 2 hasta 12 y base 4 desde ahí, que es lo que el producto ya
habla — se rechazó la rejilla de 4 porque el 6 y el 10 son 534 usos y
redondearlos mueve medio producto sin que nadie lo mire.

Detalle y razones: `docs/design/NEXUS_DESIGN_SYSTEM.md`.

## La deuda NO ha bajado, y eso es a propósito

1 161 colores a mano, 2 888 tamaños y 3 162 espacios siguen ahí. Lo único que
bajó es la ortografía. Lo que cambió es que **existe la alternativa** y la
puerta quedó cerrada por detrás: una pantalla nueva con estilo en línea sube una
de las seis cifras y falla la compuerta.

Colapsar los medios píxeles (865 sitios) o migrar los 127 usos de `#3D5AFE` a
`var(--nexus-solido)` cambia píxeles en el tema claro, y eso **no se aprueba
leyendo el código**. Es `VISUAL-EXCELLENCE-001`.

## Lo que falta para cerrar `DESIGN-SYSTEM-001`

1. **`A11Y-GATE-001`** — hoy hay **1** prueba de accesibilidad entre 566, y es
   una expresión regular sobre `layout.tsx`. Objetivo WCAG 2.2 AA. Necesita
   `axe` sobre el producto corriendo, y este contenedor no tiene credenciales de
   Firebase.
2. **Regresión visual** — no existe línea base.
3. **Adopción de primitivos** (`components/ui/`, 24 %) — el trinquete no la
   mide: se puede escribir una pantalla entera con tokens y sin un `<Button>`.
4. **`DESIGN-TABLAS-001`** (P2) — nueve tablas con `minWidth` 520-720 y tres sin
   envoltorio; `.table-wrap.rwd` ya existe.

## Lo que este estado NO afirma

**Nadie ha abierto una pantalla.** Todo son recuentos sobre el código. Ninguna
pantalla está aprobada, y la directiva V9 §4 dice que no se aprueba interfaz
leyendo código. Móvil, teclado, consola y red: sin ejecutar.
