# Último punto seguro de reanudación

> **Para qué sirve**: que la siguiente sesión sepa, sin leerse todo, qué está
> cerrado y qué es lo siguiente. Se actualiza **tras cada unidad cerrada**, con
> su SHA. Sin SHA, una unidad no está cerrada.

---

## Checkpoint · 9-ago-2026 (2)

| | |
|---|---|
| **Rama** | `claude/compassionate-galileo-sw6sdc` |
| **SHA base de esta sesión** | `0144257` (merge de la PR #271, v1163) |
| **SHA de cierre** | *(el commit de REG-292 de esta sesión)* |
| **Unidad cerrada** | **`A11Y-GATE-001`** — segunda mitad de `DESIGN-SYSTEM-001` |
| **Siguiente unidad** | los literales *slate* (ver «Qué hacer al reanudar») |

### Qué quedó hecho

**REG-292 — la etiqueta que se ve no es la etiqueta que se oye.**

En las cuatro pantallas donde el paciente **escribe**, el `<label>` se pintaba
encima del campo y no lo señalaba: sin `htmlFor`, sin `id`, sin envolverlo. A la
vista, un formulario etiquetado; para un lector de pantalla, «cuadro de edición»
en blanco. Nueve controles:

- **`/reservar`** — los cuatro campos del alta. Primera pantalla de un paciente nuevo.
- **`/privacidad/[clinicId]`** — los cinco campos de la solicitud **ARCO** y su
  descripción. Es el que más pesa: derecho con plazo legal de 20 días hábiles.
- **`/resena`** — el comentario, y **las cinco estrellas**, que eran cinco
  botones mudos: la única acción de la pantalla, imposible sin ver.
- **`/mi/[token]`** — el campo de fecha para reagendar.

**La compuerta que faltaba**: de 568 archivos de prueba, **uno** era de
accesibilidad y era una expresión regular sobre `layout.tsx`.

| Compuerta | Exige |
|---|---|
| superficie del paciente (9 rutas) | **cero** controles sin nombre |
| resto de la aplicación | trinquete de **312**, sólo baja |

Instrumento: `scripts/a11y/nombres-accesibles.mjs`, también `npm run a11y`. Usa
el parseador de TypeScript porque con expresiones regulares fallaba en **las dos
direcciones** sobre estas mismas nueve pantallas. Sigue la etiqueta a través de
una frontera de componente (`FormField`, `Field`, `Campo`), que es el patrón de
esta base de código.

**El arreglo tuvo que rehacerse para que la compuerta pudiera verlo**: la primera
versión inyectaba el `id` con `useId()` + `cloneElement` — funcionaba y el
guardián no podía comprobarlo. Un arreglo que la compuerta no ve puede
deshacerse en silencio.

**Backlog nuevo**: `A11Y-AXE-001` (P1) — contraste, orden de foco, trampa de
foco, `aria-live`, objetivo táctil. Necesita navegador; mismo bloqueo que
`NAV-NAVEGADOR-001`.

### Compuertas en este checkpoint

| Compuerta | Resultado |
|---|---|
| `npx vitest run` | **8 471 en verde**, 568 archivos, 1 saltado. Falla sólo `ops-timeout-y-punto-ciego`, que ya se sabe **intermitente en este contenedor** (abre una conexión a una IP no enrutable esperando que expire) |
| `npm run a11y` | **paciente en cero, resto igual que el techo** |
| `lint-trinquete` | **96, igual que el techo.** Sin deuda nueva |
| `npx tsc --noEmit` | **limpio** |
| `npm run build` | **compila** («Compiled successfully in 56s») y luego falla al recolectar datos de página con `auth/invalid-api-key`: **este contenedor no tiene las variables de Firebase**. Entorno, no código |
| navegador / móvil / contraste | **no ejecutadas** |

> **Aviso sobre la suite**: tres pruebas de red (`audit-log-cola`,
> `tope-creditos`, `ops-timeout-y-punto-ciego`) fallan de forma **intermitente**
> bajo carga completa en este contenedor y pasan las tres al correrlas solas. No
> son regresiones: son el proxy. Conviene saberlo antes de diagnosticar.

---

## Qué hacer al reanudar

**1. Comprobar** que `git log --oneline -3` incluye el commit de REG-292 y correr
`node scripts/agent-state/actualizar.mjs`.

**2. NO rehacer** `PATIENT-UX-TRUTH-001`, los tres P0 de audio,
`DESIGN-THEME-001` ni `A11Y-GATE-001`. Están cerrados con su SHA.

**3. Siguiente sin bloqueo — los literales *slate* que no siguen al tema**, en 10
archivos. `/privacidad/[clinicId]` es el caso de libro y acaba de quedar a la
vista: pinta `#374151`, `#d1d5db`, `#f9fafb` y `#111827` a mano, así que es una
pantalla **del paciente** clavada en tema claro dentro de una aplicación oscura.
Es la reaparición del defecto ya documentado en `globals.css:25-30`.

**4. Luego**: las tablas con `.table-wrap.rwd`, y `DESIGN-RESPALDOS-001` (281
respaldos `var(--token, #hex)` que nombran colores abandonados).

**5. Cuando haya entorno con credenciales de Firebase**, dos unidades se
desbloquean a la vez:
- `A11Y-AXE-001` — contraste, foco, `aria-live` con `axe` sobre la aplicación.
- `NAV-NAVEGADOR-001` — las seis comprobaciones de navegación. **Dos de ellas
  pueden convertir un P2 en P0.**

## Lo que este checkpoint NO garantiza

**Nadie ha abierto una pantalla.** La compuerta de REG-292 es **estática**: dice
que los controles del paciente tienen nombre, no que la pantalla se pueda usar.
Contraste, orden de foco, trampa de foco y objetivo táctil siguen sin comprobarse
—los ~900 hexadecimales sueltos del código nunca se midieron— y la directiva V9
§4 prohíbe aprobar interfaz leyendo código. **Ninguna pantalla está aprobada.**

Del commit anterior siguen pendientes de mirar dos cambios que mueven píxeles:
`.t-h3` → `.t-h2` y el aviso de duplicados con los tokens ámbar.
