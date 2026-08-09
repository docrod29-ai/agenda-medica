# Último punto seguro de reanudación

> **Para qué sirve**: que la siguiente sesión sepa, sin leerse todo, qué está
> cerrado y qué es lo siguiente. Se actualiza **tras cada unidad cerrada**, con
> su SHA. Sin SHA, una unidad no está cerrada.

---

## Checkpoint · 9-ago-2026

| | |
|---|---|
| **Rama** | `claude/relaxed-fermi-qqrd66` |
| **SHA base de esta sesión** | `0144257` (merge del PR #271) |
| **SHA de cierre** | `64a789f` (P0) · *(este commit)* (sistema de diseño) |
| **Unidad cerrada** | **`PATIENT-TELE-002`** — el último P0 de V9 |
| **Unidad abierta** | **`DESIGN-SYSTEM-001`**, pasos 1-3 de 6 hechos |

### Qué quedó hecho

**1 · El último P0 de V9, cerrado** (`64a789f`, v1164, REG-291/292).

- **REG-291** — el enlace de la videoconsulta no salía nunca por WhatsApp. La
  regla «sin token no se manda enlace» estaba escrita y probada; los tres
  caminos de servidor no acuñaban el token, así que el paciente recibía
  «recibirás el enlace por este medio»… por este medio.
- **REG-292** — apareció al cablear lo anterior y **no estaba en ningún
  backlog**: `/api/telesalud/sala` nunca miró `portalTokenVersion`, así que
  revocar los enlaces de un paciente le cerraba la agenda y las recetas y le
  dejaba **abierta la sala de video**.

**Con esto V9 no tiene ningún P0 abierto.** Quedan 7 P1 y 3 P2.

**2 · `DESIGN-SYSTEM-001` abierta**, pasos 1-3 de los seis de la auditoría §6:
`@theme inline` de 4 → 36 entradas (la causa raíz del monolito de estilo en
línea), escalas de espacio/radio/sombra, y un trinquete de cuatro guardianes con
techo de literales en **1 161**. Detalle en `DESIGN_STATE.md`.

### Compuertas en este checkpoint

| Compuerta | Resultado |
|---|---|
| `npx vitest run` | 8 477 casos · **1 fallo preexistente y de entorno** (`ops-timeout-y-punto-ciego`: abre una conexión a una IP no enrutable esperando que expire; tras el proxy de este contenedor falla rápido). **Comprobado en HEAD limpio con `git stash`: falla igual** |
| `lint-trinquete` | **96, igual que el techo.** Sin deuda nueva |
| `npx tsc --noEmit` | **limpio** |
| `npm run build` | **«Compiled successfully in 38.4s»** y luego falla al recoger datos de página con `auth/invalid-api-key`: **este contenedor no tiene las variables de Firebase**. Entorno, no código |
| navegador / móvil / a11y | **no ejecutadas** — sin credenciales no arranca la app |

### Probado al revés (todo guardián nuevo)

| Guardián | Con el defecto puesto |
|---|---|
| las 2 rutas acuñan el token | falla al quitarlo |
| la sala comprueba la versión | falla al quitar la comprobación |
| el TTL cubre la ventana de la sala | falla con un TTL fijo de un día |
| `@theme inline` ≥ 36 entradas | falla al encogerlo a las 4 originales |
| ningún token apunta a la nada | falla al añadir uno roto |
| trinquete de literales | falla con 3 colores nuevos a mano |

---

## Qué hacer al reanudar

**1. Comprobar** que `git log --oneline -3` incluye los dos commits de esta
sesión y correr `node scripts/agent-state/actualizar.mjs`.

**2. NO rehacer** ni la auditoría, ni los P0 de audio, ni `PATIENT-TELE-002`.
Están cerrados con su SHA.

**3. Seguir `DESIGN-SYSTEM-001`** por donde quedó — pasos 4, 5 y 6 de
`docs/design/GENERIC_AI_AESTHETIC_AUDIT.md` §6:

- **paso 4** · compuerta de accesibilidad (`axe`) sobre la superficie del
  paciente. Es `A11Y-GATE-001`, y hoy hay **1** prueba de a11y entre 540.
- **paso 5** · los literales *slate* que no siguen al tema, en 10 archivos.
- **paso 6** · las tablas, con `.table-wrap.rwd`, que ya existe.

**4. OJO con el paso 3 de la auditoría** —el barrido de `#3d5afe`—: dice que es
puro y **no lo es**. `--nexus-solido` vale `#3D5AFE` en oscuro y `#2845EA` en
claro, así que la conversión **cambia el tema claro** en 122 sitios de 54
archivos. Necesita una sesión que pueda mirar una pantalla. Está anotado en el
propio backlog, en `DESIGN-THEME-001.ojo`.

**5. Cuando haya entorno con credenciales de Firebase**: las seis comprobaciones
de navegador de `NAV-NAVEGADOR-001`. **Dos de ellas pueden convertir un P2 en
P0.**

## Lo que este checkpoint NO garantiza

Que la interfaz esté bien. **Sigue sin abrirse una sola pantalla** — ni en esta
sesión ni en la anterior. El cimiento del sistema de diseño está puesto y
vigilado; que las 78 pantallas lo usen es `VISUAL-EXCELLENCE-001`, y no ha
empezado.
