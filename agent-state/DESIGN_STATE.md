# Estado del sistema de diseño — V9

> Se escribe **a mano**, tras cada iteración. Las cifras derivables viven en
> `MASTER_STATE.json`, en `docs/design/SCREEN_INVENTORY.md` (generado) y en los
> dos techos de trinquete (`docs/design/diseno-techo.json`, `a11y-techo.json`).

**Iteración en curso**: `DESIGN-SYSTEM-001` **cerrada** el 9-ago-2026.
**Siguiente**: `NAVIGATION-001`.

---

## Lo que cambió, en una frase

**El sistema de diseño dejó de ser un documento.** Antes existía, estaba bien
pensado y la aplicación no podía obedecerlo; ahora el compilador lo conoce, hay
una utilidad por token y tres compuertas impiden que la deriva crezca.

## La causa raíz, atacada donde estaba

`@theme inline` exponía a Tailwind **cuatro** cosas. Todo lo demás vivía en
variables CSS que el compilador no mira, así que **no había utilidad que usar** y
el código no tenía alternativa al estilo en línea. No era dejadez: era mecánica.

Hoy `@theme` expone **43 tokens** en cinco espacios:

| Espacio | Tokens | Utilidades |
|---|---|---|
| color | 22 | `bg-s1/s2/s3` · `text-fg/fg2/fg3` · `border-linea/linea2` · `bg-nexus-solido` · `text-nexus` · `text-error/aviso/exito/info` |
| espacio | 10 | `gap-8px` · `p-12px` · `mt-4px`… (rejilla de 2 px) |
| radio | 9 | `rounded-10px` · `rounded-pill` · `rounded-circulo` |
| tipografía | 8 | `text-meta` · `text-body` · `text-h1`… |
| sombra | 3 | `shadow-realce` · `shadow-menu` · `shadow-modal` |

Y se comprueba que **llegan**: `scripts/design/verificar-utilidades.mjs` compila
el `globals.css` real y mira la hoja de salida. Declarar un token no es tener una
utilidad — entre las dos cosas hay un compilador que, cuando se equivoca, no da
error: la clase simplemente no existe. Es la regla «el dato tiene que LLEGAR»
aplicada a una hoja de estilos.

## Las escalas salen del producto, no de un libro

| Dimensión | Lo que decía el documento | Lo que declara ahora | Por qué |
|---|---|---|---|
| Espacio | «múltiplos de 4» | 2·4·6·8·10·12·16·20·24·32 | `gap: 6` y `gap: 10` suman 533 usos. La regla de 4 nunca se cumplió |
| Radio | «6 / 10 / 14» | 4·6·8·10·12·14·16 + píldora + círculo | `8` se usa tanto como `10` (245 cada uno) y `12` otras 163 — los tres están en el propio `globals.css` |
| Tipografía | 6 pasos | 8 pasos (+13, +12, +11 px) | Los tres tamaños **más usados de la aplicación** no estaban en la escala |
| Sombra | *no había* | 3 alturas | Había 23 sombras en línea con 21 valores: ruido con forma de paleta |

**Los medios píxeles quedan fuera** (12,5 · 11,5 · 13,5 · 14,5 · 9,5 = 907 usos):
a 1× se redondean, así que 12,5 y 13 pintan lo mismo mientras el código afirma
que son distintos. Con una excepción declarada y anotada como deuda, no como
criterio: `.t-overline`, 10,5 px, que ya estaba en 115 sitios.

## Las tres compuertas

| Compuerta | Deuda congelada hoy | Orden |
|---|---|---|
| Deriva de diseño | **2 600** | `npm run diseno:trinquete` |
| Accesibilidad | **312** | `npm run a11y:trinquete` |
| «la utilidad llega» | — | dentro de la suite |

Y la regla que de verdad muerde, que es la que pide la directiva V9 §1 para esta
unidad: **un archivo nuevo nace limpio**. El techo congela la deuda de lo que ya
existía; lo que no estaba en la foto no tiene nada que congelar. Escribir hoy una
pantalla con hexadecimales y medios píxeles pone la suite en rojo, aunque el
total no suba.

### El desglose, porque el número solo no sirve

| Deriva de diseño | | Deuda de accesibilidad | |
|---|---|---|---|
| `fontSize` fuera de escala | 1 198 | Campo sin etiqueta | 288 |
| Espacio fuera de rejilla | 940 | `<div onClick>` sin `role` | 13 |
| Token reteclado a mano | 251 | Botón de icono mudo | 11 |
| Radio fuera de escala | 184 | `<img>` sin `alt` | 0 |
| Sombra en línea | 27 | | |

## Dos cosas que se aprendieron midiendo

**1. La auditoría se equivocó, y se corrigió al hacerlo.** Decía que migrar
`#3d5afe` «es puro y no cambia ni un píxel». Sólo es cierto en tema oscuro: en
claro, `--nexus-solido` vale `#2845EA`. No es un fallo de contraste —blanco sobre
`#3D5AFE` da 5,13 : 1 y cumple AA— pero sí un cambio visible, así que **no puede
hacerse a ciegas** y pasa a `VISUAL-EXCELLENCE-001` con verificación en
navegador. Corregido en el propio documento de auditoría, donde se leerá.

**2. Un medidor que cuenta comentarios miente.** Los dos únicos `<img>` sin `alt`
de la primera medición eran la palabra `<img>` dentro de un comentario que
explicaba otra cosa: **100 % de falsos positivos**. Y al revés, los comentarios
que documentan hexadecimales y tamaños habrían engordado el techo con deuda
inexistente. En un proyecto que comenta tanto como éste eso no es una anécdota —
se mide el código, no la prosa (`sinComentarios`, con su prueba de que una URL
no es un comentario).

También se quitaron **siete clases muertas** (`.text-teal`, `.text-teal2`,
`.text-teal3`, `.bg-s1/2/3`, `.border-theme`): cero usos en los 203 `.tsx`, y
tres de ellas pasaban a chocar por nombre con la utilidad generada desde el
token. Dos definiciones de la misma clase es la duplicación de fuente de verdad
que este proyecto prohíbe.

## Lo que este estado NO afirma

**Nadie ha abierto una pantalla.** Todo son recuentos sobre el código y una hoja
de estilos compilada. **Ninguna pantalla está aprobada**, y la directiva V9 §4
dice que no se aprueba interfaz leyendo código.

En concreto, siguen sin ejecutarse:

- `axe` sobre las nueve pantallas del paciente. El trinquete de accesibilidad es
  un **suelo estático**: no ve contraste, ni orden de foco, ni trampa de foco en
  modales, ni si la etiqueta dice algo útil. Necesita entorno con credenciales de
  Firebase (`NAV-NAVEGADOR-001`).
- Regresión visual. Sigue sin definirse.
- Móvil y teclado sobre la aplicación corriendo.

Y **no se ha adoptado ni un token en las pantallas**: 2 600 usos de deriva siguen
donde estaban. Bajarlos es `VISUAL-EXCELLENCE-001`, y cada tramo cambia píxeles,
así que cada tramo exige mirarlo.
