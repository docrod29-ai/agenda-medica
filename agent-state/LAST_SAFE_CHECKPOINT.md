# Último punto seguro de reanudación

> **Para qué sirve**: que la siguiente sesión sepa, sin leerse todo, qué está
> cerrado y qué es lo siguiente. Se actualiza **tras cada unidad cerrada**, con
> su SHA. Sin SHA, una unidad no está cerrada.

---

## Checkpoint · 9-ago-2026

| | |
|---|---|
| **Rama** | `claude/relaxed-fermi-gxalc8` |
| **SHA base de esta sesión** | `0144257` (merge del PR #271, v1163) |
| **SHA de cierre** | `4852e23` |
| **Unidad cerrada** | **`PATIENT-TELE-002`** — el último P0 abierto de V9 |
| **Siguiente unidad** | **`DESIGN-SYSTEM-001`** (iteración 1 de §1 de la directiva) |

### Qué quedó hecho

**REG-291 — el enlace de la videoconsulta ya viaja por WhatsApp.** Los tres
mensajes que anuncian una teleconsulta (bot al agendar, recordatorio de 24 h y
recordatorio del mismo día) llevan ahora el token que hace funcionar el enlace
del otro lado. Antes mandaban «recibirás el enlace por este medio» y no había
ningún medio que lo mandara.

- `src/lib/telesalud/token-de-sala.ts` (nuevo) — acuña el token **en el
  servidor**, alcance `agenda`, y falla cerrado sin `pacienteId`.
- `diasDeVidaDelEnlace` (en `ventana-sala.ts`) — la vida del token se **calcula
  desde la cita**. Un día fijo caducaba antes de la consulta cuando el
  recordatorio salía a T-26 h; más de ocho días no se emite y lo trae el
  recordatorio.
- `/api/telesalud/sala` comprueba `portalTokenVersion`: **la revocación ya llega
  a la sala de video**, que es lo que hace tolerable poner un token dentro de un
  mensaje de WhatsApp.

**Reconciliación de tableros.** Los tres `PATIENT-AUDIO-00x` estaban cerrados en
`CURRENT_ITERATION.md` y en el ledger desde el 8-ago y seguían `pendiente` en
`BACKLOG.json` — la misma forma de REG-267 que el commit `d22fbfd` quiso evitar.
Cerrados también ahí.

### Estado de V9 en este checkpoint

**Cero P0 abiertos.** Quedan 7 P1 y 3 P2, todos en `agent-state/BACKLOG.json`.

### Compuertas en este checkpoint

| Compuerta | Resultado |
|---|---|
| `npx vitest run` | 8 481 casos · **1 fallo preexistente y de entorno** (`ops-timeout-y-punto-ciego`: abre una conexión a una IP no enrutable esperando que expire; tras el proxy de este contenedor falla rápido). **Comprobado con `git stash` sobre `HEAD` limpio: falla igual** |
| `lint-trinquete` | **96, igual que el techo.** Sin deuda nueva |
| `npx tsc --noEmit` | **limpio** |
| `npm run build` | **compila** («Compiled successfully in 39.4s») y luego falla al recolectar datos de `/dr/[clinicId]` con `auth/invalid-api-key`: **este contenedor no tiene las variables de Firebase**. Entorno, no código |
| `clinical-safety-gate` | verde, con los tres archivos citados por REG-291 sellados |
| navegador / móvil / a11y | **no ejecutadas** |

---

## Qué hacer al reanudar

**1. Comprobar** que `git log --oneline -3` incluye el commit de REG-291 y correr
`node scripts/agent-state/actualizar.mjs`.

**2. NO rehacer** `PATIENT-UX-TRUTH-001`, los tres P0 de audio ni
`PATIENT-TELE-002`. Están cerrados con su REG y su guardián sellado.

**3. Empezar `DESIGN-SYSTEM-001`**, por `@theme inline` (`globals.css:126-131`)
— **no por colores**, que lo prohíbe §13 de la directiva y además no es el
problema. El orden está escrito en `DESIGN_STATE.md`, sección «Orden para
DESIGN-SYSTEM-001».

**4. Cuando haya entorno con credenciales de Firebase**: las seis comprobaciones
de navegador de `NAV-NAVEGADOR-001` (**dos pueden convertir un P2 en P0**) y la
verificación en vivo que le falta a REG-291 y a REG-265.

## Lo que este checkpoint NO garantiza

Que la interfaz esté bien. **Nadie ha abierto una pantalla**, y REG-291 tampoco
se comprobó mandando un WhatsApp de verdad: no hay número de pruebas en este
espacio. Ninguna pantalla está aprobada.
