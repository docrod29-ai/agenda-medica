# Último punto seguro de reanudación

> **Para qué sirve**: que la siguiente sesión sepa, sin leerse todo, qué está
> cerrado y qué es lo siguiente. Se actualiza **tras cada unidad cerrada**, con
> su SHA. Sin SHA, una unidad no está cerrada.

---

## Checkpoint · 9-ago-2026 (3)

| | |
|---|---|
| **Rama** | `claude/compassionate-galileo-sw6sdc` |
| **SHA base de esta sesión** | `0144257` (merge de la PR #271, v1163) |
| **SHA de cierre** | *(el commit de REG-293/294/295 de esta sesión)* |
| **Unidad cerrada** | **`DESIGN-SLATE-001`** — tercera parte de `DESIGN-SYSTEM-001` |
| **Siguiente unidad** | `DESIGN-TABLAS-001` (ver «Qué hacer al reanudar») |

### Qué quedó hecho

Tres defectos, una misma frase: **el sistema de diseño existe y la pantalla no
le hacía caso.**

**REG-293 — la clase que no existe tampoco gira.** REG-266 arregló el
`@keyframes` y dejó escrito que los `<style>` locales eran «inofensivos:
redefinen lo mismo». Cierto para un fotograma; **falso para una clase**, que
puede ser la única definición que existe. `.spin` se usaba en ocho sitios y sólo
la definían dos `<style>` locales, así que giraba mientras esas pantallas
estuvieran montadas. Tres de los ocho no giraban nunca: subir foto clínica,
adjuntar PDF de laboratorio y **enviar la solicitud ARCO** — pantalla pública,
donde ningún panel del médico puede estar montado. Y `.nx-pulse` / `.nx-caret`,
que en `/uci` son el punto de «● Grabando…» y el cursor del dictado, vivían
**sólo en el `<style>` de la página comercial**.

**REG-294 — dos pantallas del paciente clavadas en tema claro.** `/privacidad` y
`/privacidad/[clinicId]`, con la mitad siguiendo al tema y la otra mitad no.
Contador de caracteres de la solicitud ARCO **2,54 : 1**, pie del aviso legal
**3,48 : 1**, aviso ámbar (fondo literal + texto de token) **2,86 : 1** en tema
oscuro. Los tres reprueban AA.

**REG-295 — el relleno usaba el token del TEXTO.** Seis botones a mano con
`background: var(--teal)` y texto casi negro: **2,95 : 1 en tema claro**. Entre
ellos «Confirmar cita» de `/reservar`, «Enviar» de `/resena` y la insignia de no
leídos del `Sidebar`, que está en toda la aplicación. Es **REG-223 otra vez**:
arreglar `.btn-primary` no arregló a quien no usa la clase.

**Compuertas nuevas**:
- `la-pantalla-del-paciente-sigue-al-tema.test.ts` (6 casos) — token obligatorio
  en las 9 rutas del paciente, con excepciones declaradas **una a una y con su
  motivo**, y una prueba que caza las excepciones muertas.
- `toda-animacion-tiene-su-fotograma.test.ts` gana la regla para **clases**, con
  el conjunto de clases de animación **derivado**, no escrito a mano.

**El instrumento también tuvo que arreglarse**: el trinquete de escala contaba
cada `var(--r-…)` como un radio distinto, así que **adoptar un token subía la
cifra** y el guardián se ponía rojo por el arreglo. Ahora los tokens colapsan a
una entrada.

**Backlog nuevo**: `DESIGN-SLATE-002` (P3) — los ~21 literales que quedan fuera
de la superficie del paciente. **No se barren a ciegas**: casi todos son paletas
de categoría y documentos en papel, que a propósito no siguen al tema.

### Compuertas en este checkpoint

| Compuerta | Resultado |
|---|---|
| `npx vitest run` | **8 478 en verde**, 569 archivos, 1 saltado. Falla sólo `ops-timeout-y-punto-ciego`, **intermitente en este contenedor** (abre una conexión a una IP no enrutable esperando que expire) |
| `npm run a11y` | **paciente en cero, resto igual que el techo** |
| `lint-trinquete` | **96, igual que el techo.** Sin deuda nueva |
| `npx tsc --noEmit` | **limpio** |
| `npm run build` | **compila** («Compiled successfully in 37,6 s») y luego falla al recolectar datos de página con `auth/invalid-api-key`: **este contenedor no tiene las variables de Firebase**. Entorno, no código |
| navegador / móvil / contraste real | **no ejecutadas** |

> **Aviso sobre la suite**: tres pruebas de red (`audit-log-cola`,
> `tope-creditos`, `ops-timeout-y-punto-ciego`) fallan de forma **intermitente**
> bajo carga completa en este contenedor y pasan al correrlas solas. No son
> regresiones: es el proxy. Conviene saberlo antes de diagnosticar.

---

## Qué hacer al reanudar

**1. Comprobar** que `git log --oneline -3` incluye el commit de REG-293/294/295
y correr `node scripts/agent-state/actualizar.mjs`.

**2. NO rehacer** `PATIENT-UX-TRUTH-001`, los tres P0 de audio,
`DESIGN-THEME-001`, `A11Y-GATE-001` ni `DESIGN-SLATE-001`. Cerradas con su SHA.

**3. Siguiente sin bloqueo — `DESIGN-TABLAS-001`.** Nueve tablas fijan un
`minWidth` de 520 a 720 px y tres no tienen ni envoltorio: a 375 px se desbordan.
La solución **ya existe** (`.table-wrap.rwd` en `globals.css`, que convierte la
tabla en tarjetas apiladas por debajo de 640 px) y casi nadie la usa. Ficha
completa en `BACKLOG.json`.

**4. Luego**: `DESIGN-RESPALDOS-001` (281 respaldos `var(--token, #hex)` que
nombran colores abandonados) y `DESIGN-SLATE-002` (P3).

**5. Cuando haya entorno con credenciales de Firebase**, dos unidades se
desbloquean a la vez:
- `A11Y-AXE-001` — contraste real, orden de foco, trampa de foco, `aria-live`.
- `NAV-NAVEGADOR-001` — las seis comprobaciones de navegación. **Dos de ellas
  pueden convertir un P2 en P0.**

## Lo que este checkpoint NO garantiza

**Nadie ha abierto una pantalla.** Los cocientes de contraste de este commit
están **calculados**, no observados: se aplicó la fórmula de luminancia relativa
WCAG 2.1 —la misma que `globals.css` usa a mano— sobre las parejas color/fondo
que se leen en el código. Eso vale para decir que `2,54 : 1` reprueba; no vale
para aprobar la pantalla, porque no dice qué hay realmente detrás de cada
elemento cuando se pinta.

Y esta sesión acumula cambios que **mueven píxeles** y siguen sin mirarse:
`.t-h3` → `.t-h2`, el aviso de duplicados con los tokens ámbar, las dos pantallas
de `/privacidad` que pasan de claro fijo a seguir el tema, y seis botones que
cambian de azul y de color de texto. Todos van en la dirección del sistema y
todos están medidos. Ninguno está visto.
