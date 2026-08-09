# Último punto seguro de reanudación

> **Para qué sirve**: que la siguiente sesión sepa, sin leerse todo, qué está
> cerrado y qué es lo siguiente. Se actualiza **tras cada unidad cerrada**, con
> su SHA. Sin SHA, una unidad no está cerrada.

---

## Checkpoint · 9-ago-2026

| | |
|---|---|
| **Rama** | `claude/compassionate-galileo-sg8lel` |
| **SHA base de esta sesión** | `210847a` (merge del PR #269) |
| **SHA de `PATIENT-TELE-002`** | `f981d9c` |
| **SHA de cierre de la sesión** | *(ver `git log -1`)* |
| **Unidades tocadas** | `PATIENT-TELE-002` **cerrada** · `DESIGN-SYSTEM-001` **abierta, no cerrada** |

### Qué quedó hecho

**1 · `PATIENT-TELE-002` — REG-288. El último P0 de V9.**

La videoconsulta se anunciaba por WhatsApp **sin enlace**: `dondeEsLaCita` exige
token desde REG-265 y los tres llamadores de servidor no lo acuñaban, así que el
paciente recibía «recibirás el enlace por este medio antes de tu cita» **en el
mensaje que era ese medio**.

- `src/lib/telesalud/token-de-sala.ts` (nuevo) — la pieza que faltaba; firmar
  exige un secreto de servidor y `lib/whatsapp.ts` se importa desde el navegador.
- La vida del token se **deriva de la hora de la cita**: el plan escrito decía
  «1 día», y el recordatorio de 24 h sale entre 23 y 26 h antes — habría caducado
  antes de la consulta que anuncia. Probado al revés.
- Residuos declarados, no escondidos: `TELE-ALCANCE-001` (P1), `TELE-REVOCA-001` (P2).

**2 · `DESIGN-SYSTEM-001`, primera mitad.**

- `@theme inline`: de **4** tokens a **41**. Era la causa raíz del monolito de
  estilo en línea — sin utilidades, el código no tenía alternativa.
- Escala de **radio** (8 peldaños) y de **espacio** (10), medidas sobre el
  repositorio, no inventadas.
- Dos peldaños tipográficos que faltaban: `.t-body-sm` (13 px, 536 usos sin
  clase) y `.t-micro` (11 px, 292).
- Ortografía del color normalizada: **0** valores escritos en dos mayúsculas
  (eran 7, en 175 sitios). Distintos: 146 → 139. Cero píxeles cambiados.
- **La compuerta**: `scripts/design/trinquete-de-diseno.mjs` congela seis cifras
  y sólo las deja bajar. Una pantalla nueva con estilo en línea la falla.
- `docs/design/NEXUS_DESIGN_SYSTEM.md`.

**3 · `A11Y-GATE-001`, la mitad que no necesita navegador.**

- `eslint-plugin-jsx-a11y` recomendado **en aviso** sobre `src/**/*.tsx`, y
  declarado como dependencia en vez de llegar de rebote por `eslint-config-next`.
- `scripts/design/trinquete-a11y.mjs`: techo **por regla** —no un total— para que
  nadie canjee veinte etiquetas por quince `<div onClick>`. **211 avisos en 46
  archivos**: 156 campos sin etiqueta, 37 controles que el teclado no puede
  pulsar, 14 `autofocus`.
- Los dos trinquetes nuevos corren en CI, en su propio job (`diseño`).

### Compuertas en este checkpoint

| Compuerta | Resultado |
|---|---|
| `npx vitest run` | 8 472 casos · **1 fallo preexistente y de entorno** (`ops-timeout-y-punto-ciego`: abre una conexión a una IP no enrutable esperando que expire; tras el proxy de este contenedor falla rápido). **Comprobado con `git stash`: falla igual en `HEAD` limpio** |
| `lint-trinquete` | **96, igual que el techo** |
| `trinquete-de-diseno` | techo fijado hoy: 1 161 · 139 · **0** · 2 888 · 1 092 · 3 162 |
| `trinquete-a11y` | techo fijado hoy: **211** avisos en 46 archivos, por regla |
| `npx tsc --noEmit` | **limpio** |
| `npm run build` | **compila** («Compiled successfully in 35s») y luego falla al recolectar datos de página con `auth/invalid-api-key`: **este contenedor no tiene las variables de Firebase**. Entorno, no código |
| navegador / móvil / a11y | **no ejecutadas** — sin credenciales, el producto no arranca aquí |

---

## Qué hacer al reanudar

**1. NO rehacer** `PATIENT-UX-TRUTH-001`, los tres P0 de audio ni
`PATIENT-TELE-002`. Están cerrados con SHA.

**2. Terminar `DESIGN-SYSTEM-001`.** Lo que falta, en orden:

- **`A11Y-GATE-001`, la mitad de navegador.** La estática está hecha (trinquete
  por regla, techo 211). Faltan los cinco mínimos que sólo se ven corriendo:
  contraste real, foco visible, atrapado de foco en un modal, cierre con Escape y
  objetivo táctil 44×44. Y hay 156 campos sin etiqueta esperando a que alguien
  los mire de uno en uno — empezando por las 9 pantallas del paciente.
- **Regresión visual** — no hay línea base.
- **Adopción de primitivos** (`components/ui/`, 24 %) — el trinquete de hoy no la
  mide.

**3. Luego `NAVIGATION-001`**, con `NAV-AGENDA-001` (Agenda → Consulta → atrás
nunca vuelve a la Agenda) como cabeza.

**4. Cuando haya entorno con credenciales de Firebase**: las seis comprobaciones
de navegador de `NAV-NAVEGADOR-001`. **Dos de ellas pueden convertir un P2 en
P0.** Y ahí mismo, la comprobación en navegador que REG-265 y REG-288 no han
tenido: abrir el enlace de la sala tal como le llega al paciente.

## Lo que este checkpoint NO garantiza

Que la interfaz esté bien. **Nadie ha abierto una pantalla.** Hay sistema de
diseño y hay compuerta; no hay ninguna pantalla aprobada. Y la deuda de estilo en
línea **no ha bajado** — sólo dejó de poder crecer.
