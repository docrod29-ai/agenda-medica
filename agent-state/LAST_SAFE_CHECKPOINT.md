# Último punto seguro de reanudación

> **Para qué sirve**: que la siguiente sesión sepa, sin leerse todo, qué está
> cerrado y qué es lo siguiente. Se actualiza **tras cada unidad cerrada**, con
> su SHA. Sin SHA, una unidad no está cerrada.

---

## Checkpoint · 9-ago-2026

| | |
|---|---|
| **Rama** | `claude/relaxed-fermi-13j6rd` (nace de `main` en `0144257`) |
| **SHA base de esta sesión** | `0144257` (merge del PR #271, `v1163`) |
| **SHA de cierre** | `4a9eca4` |
| **Unidad cerrada** | **`PATIENT-TELE-002`** — el cuarto y último P0 del backlog de V9 |
| **Siguiente unidad** | `DESIGN-SYSTEM-001` (iteración 1 de V9) |

### Qué quedó hecho

**REG-291 — el enlace de la videoconsulta llega por donde se anuncia.**

Los tres mensajes que anuncian una videoconsulta —alta de la cita por el bot,
cita ganada desde la lista de espera, y los dos recordatorios del cron— mandaban
«recibirás el enlace por este medio antes de tu cita». **Y este medio era justo
ése.** No había ningún mensaje detrás: el enlace sólo existía dentro del portal.

- `src/lib/telesalud/token-de-sala.ts` (nuevo) — acuña el token **en el
  servidor**, alcance `agenda`, con la versión del expediente, y **sin enlace**
  para citas a más de 7 días.
- `esTeleconsulta()` exportado: el criterio vive en un solo sitio.
- `src/__tests__/el-enlace-de-video-llega-por-whatsapp.test.ts` (sellado, 15
  casos), **probado al revés**: sin el cableado de los llamadores, falla.
- `cron/reminders` entra a la lista congelada de rutas que tocan la identidad del
  paciente — con su razón escrita.

### El estado del backlog de V9

**Ningún P0 abierto.** Los cuatro están cerrados:

| P0 | Cerrado en |
|---|---|
| `PATIENT-AUDIO-001` | v1158 (REG-283) |
| `PATIENT-AUDIO-002` | v1161 (REG-287) |
| `PATIENT-AUDIO-003` | v1161 (REG-287) |
| `PATIENT-TELE-002` | REG-291 (`4a9eca4`) |

### Compuertas en este checkpoint

| Compuerta | Resultado |
|---|---|
| `npx vitest run` | 8 475 casos · **1 fallo preexistente y de entorno** (`ops-timeout-y-punto-ciego`: abre una conexión a una IP no enrutable esperando que expire; tras el proxy de este contenedor falla rápido). Es el mismo del checkpoint anterior |
| `lint-trinquete` | **96, igual que el techo.** Sin deuda nueva |
| `npx tsc --noEmit` | **limpio** |
| `npm run build` | **compila** («Compiled successfully in 44s») y luego falla al recolectar datos de página con `auth/invalid-api-key`: **este contenedor no tiene las variables de Firebase**. Entorno, no código |
| navegador / móvil / a11y | **no ejecutadas** |

---

## Qué hacer al reanudar

**1. Comprobar** que `git log --oneline -3` incluye `4a9eca4` y correr
`node scripts/agent-state/actualizar.mjs`.

**2. NO rehacer** la auditoría ni ninguno de los cuatro P0. Están cerrados con su
SHA.

**3. `DESIGN-SYSTEM-001`**, empezando por `@theme inline` (`globals.css`) — **no
por colores**, que lo prohíbe §13 de la directiva y además no es el problema. El
orden está escrito en `DESIGN_STATE.md` §«Orden para DESIGN-SYSTEM-001» y el
hallazgo raíz es `DESIGN-THEME-001` en el backlog.

**4. Cuando haya entorno con credenciales de Firebase**: las seis comprobaciones
de navegador de `NAV-NAVEGADOR-001`. **Dos de ellas pueden convertir un P2 en
P0.**

## Lo que este checkpoint NO garantiza

Que la interfaz esté bien. **Nadie ha abierto una pantalla.** Ninguna pantalla
está aprobada, y la directiva V9 §4 dice que no se aprueba interfaz leyendo
código.

Y que el WhatsApp llegue: REG-291 comprueba que el token se acuña, que verifica y
que los tres llamadores lo pasan. **Que Meta entregue el mensaje es otra
frontera**, y ésa sigue sin instrumento.
