# Último punto seguro de reanudación

> **Para qué sirve**: que la siguiente sesión sepa, sin leerse todo, qué está
> cerrado y qué es lo siguiente. Se actualiza **tras cada unidad cerrada**, con
> su SHA. Sin SHA, una unidad no está cerrada.

---

## Checkpoint · 9-ago-2026

| | |
|---|---|
| **Rama** | `claude/compassionate-galileo-sw6sdc` |
| **SHA base de esta sesión** | `0144257` (merge de la PR #271, v1163) |
| **SHA de cierre** | `e49bef8` |
| **Unidad cerrada** | **`DESIGN-THEME-001`** — primera mitad de `DESIGN-SYSTEM-001` (iteración 1 de V9) |
| **Siguiente unidad** | `A11Y-GATE-001` (ver «Qué hacer al reanudar») |

### Qué quedó hecho

**REG-291 — el token que no existe no falla: se calla.**

- **`@theme inline` ensanchado**: de 4 a 20 colores, 5 radios, 7 espacios, 2
  sombras y 6 tamaños de tipo. Es la causa raíz del monolito de estilo en línea
  (6 065 `style={{` en 88,5 % de los archivos): sin utilidad que usar, el código
  no tenía alternativa. Aditivo, cero píxeles cambiados.
- **Tokens declarados** que `docs/DESIGN_SYSTEM.md` ya pedía en prosa y no
  existían en CSS: radio (6/10/14), espacio (múltiplos de 4), dos sombras de
  overlay, y los seis pasos de la escala tipográfica — que vivían dentro de las
  clases `.t-*` y ahora se leen desde token.
- **Catorce referencias a tokens inexistentes, reparadas.** Las dos que muerden:
  el contador «Fallidos» de mensajes al paciente (`var(--danger)`) **nunca se
  ponía rojo**, y el aviso de posible paciente duplicado se pintaba con su
  respaldo, que era crema de tema claro.
- **`--warn-*` declarados en los dos temas**, derivados de las insignias ámbar
  que ya estaban medidas.

**Compuerta**: `src/__tests__/un-token-que-no-existe-no-se-calla.test.ts`
(6 casos, sellada). La última **compila `globals.css` con Tailwind** y exige que
la utilidad se emita y valga `var(--token)`, no el hexadecimal. Probada al revés
cuatro veces.

**Estado reconciliado**: los tres P0 de audio quedan `cerrado` en
`BACKLOG.json` — estaban `pendiente` ahí mientras `CURRENT_ITERATION.md` los
daba por cerrados desde el 8-ago. Es la cuarta vez que un tablero se desfasa
(REG-241): lo que no se deriva, se olvida.

**Backlog nuevo**: `DESIGN-RESPALDOS-001` (P2) — 281 respaldos
`var(--token, #hex)` que nombran colores que el token abandonó.

### Compuertas en este checkpoint

| Compuerta | Resultado |
|---|---|
| `npx vitest run` | 8 469 casos · **1 fallo preexistente y de entorno** (`ops-timeout-y-punto-ciego`: abre una conexión a una IP no enrutable esperando que expire; tras el proxy de este contenedor falla rápido). Es el mismo fallo del checkpoint anterior |
| `lint-trinquete` | **96, igual que el techo.** Sin deuda nueva |
| `npx tsc --noEmit` | **limpio** |
| `npm run build` | **compila** («Compiled successfully in 62s») y luego falla al recolectar datos de página con `auth/invalid-api-key`: **este contenedor no tiene las variables de Firebase**. Entorno, no código — igual que el checkpoint anterior |
| compilación real del CSS | **verificada dentro de la prueba**: las once utilidades de sonda se emiten y todas valen `var(--token)` |
| navegador / móvil / a11y | **no ejecutadas** |

---

## Qué hacer al reanudar

**1. Comprobar** que `git log --oneline -3` incluye el commit de REG-291 y correr
`node scripts/agent-state/actualizar.mjs`.

**2. NO rehacer** `PATIENT-UX-TRUTH-001`, los tres P0 de audio ni
`DESIGN-THEME-001`. Están cerrados con su SHA.

**3. Seguir con `A11Y-GATE-001`** — el P1 que queda de `DESIGN-SYSTEM-001`, y el
único P0 de la auditoría de accesibilidad: de 566 archivos de prueba, **uno** es
de accesibilidad y es una expresión regular sobre `layout.tsx`. Ni `axe-core`, ni
`jest-axe`, ni `@axe-core/playwright` en `package.json`.

Empezar por la **superficie del paciente** (9 pantallas), que es lo que V9
gobierna, con objetivo WCAG 2.2 AA. Los mínimos que fallan la compuerta están en
`.claude/rules/design-system.md`.

**4. Luego**, en este orden: los literales *slate* que no siguen al tema (10
archivos), las tablas con `.table-wrap.rwd`, y `DESIGN-RESPALDOS-001`.

**5. Cuando haya entorno con credenciales de Firebase**: las seis comprobaciones
de navegador de `NAV-NAVEGADOR-001`. **Dos de ellas pueden convertir un P2 en
P0.**

## Lo que este checkpoint NO garantiza

**Nadie ha abierto una pantalla.** Dos cambios de este commit mueven píxeles y
están razonados, no observados: `.t-h3` → `.t-h2` (dos títulos de sección que
salían del tamaño del texto corrido) y el aviso de duplicados, que pasa de crema
de tema claro a los tokens ámbar. Los dos van en la dirección del sistema, y los
dos siguen pendientes de mirar.
