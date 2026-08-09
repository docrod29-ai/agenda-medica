# Último punto seguro de reanudación

> **Para qué sirve**: que la siguiente sesión sepa, sin leerse todo, qué está
> cerrado y qué es lo siguiente. Se actualiza **tras cada unidad cerrada**, con
> su SHA. Sin SHA, una unidad no está cerrada.

---

## Checkpoint · 9-ago-2026

| | |
|---|---|
| **Rama** | `claude/relaxed-fermi-7tkh0t` |
| **SHA base de esta sesión** | `0144257` (merge del PR #271, v1163) |
| **SHA de cierre** | `SHA_DE_CIERRE` |
| **Unidad cerrada** | **`DESIGN-THEME-001`**, dentro de `DESIGN-SYSTEM-001` (iteración 1 de V9) |
| **Siguiente unidad** | `A11Y-GATE-001` — ver «Qué hacer al reanudar» |

### Qué quedó hecho

**1 · El sistema de diseño existe ahora como mecánica, no como documento.**

`@theme inline` pasó de **4 a 47** tokens. Nacieron las escaleras que faltaban,
cada peldaño con la medición que lo justifica escrita al lado:

- `--sp-1..9` — **no había ninguna escala de espacio**. Los 33 valores de
  padding/margin en línea incluían **todos los enteros del 1 al 16**.
- `--fs-1..9` — anclada en 13 px, el cuerpo real de la aplicación (539 usos).
- `--r-xs..2xl` — seis peldaños que cubren el 87 % de los 1 099 radios.
- `--elev-1..3` — donde había 22 sombras distintas en 24 usos.

Prefijo `nx-` en las utilidades, y **no es cosmética**: el código ya usa
`text-xs` (29), `text-sm` (24), `p-6`, `rounded-md` (8). Declarar `--text-sm`
las habría reescrito en silencio.

**Cero píxeles repintados, a propósito.** Colapsar 12,5 px en 13 px son 466
cambios visuales por toda la aplicación y §4 prohíbe aprobar interfaz leyendo
código.

**2 · Un trinquete que corre dentro de vitest.**

`scripts/design/trinquete-de-diseno.mjs` + `docs/design/design-techo.json`.
Sube → falla diciendo en qué archivos; baja → falla pidiendo que se apriete.

| Métrica congelada | Techo |
|---|---|
| Hexadecimales a mano | 1 199 usos · 141 distintos |
| Tamaños de letra en línea | 2 903 usos · 39 distintos |
| Radios en línea | 1 099 usos · 22 distintos |
| Espacio en línea | 1 246 usos · 33 distintos |
| `style={{` | 6 193 en 182 archivos |

**3 · La prueba que de verdad importa: se compila y se mira la salida.**

Todo lo demás lee el CSS y comprueba que **diga** lo acordado — una prueba de
contrato. El destinatario es Tailwind, y hay tres formas de que `@theme inline`
se vea impecable y no produzca nada. Así que la prueba compila con
`@tailwindcss/postcss` y verifica que `.bg-nx-s1`, `.text-nx-4`, `.p-nx-5`,
`.rounded-nx-md` y `.shadow-nx-2` **salgan del compilador**, y que `text-xs` y
`p-6` sigan valiendo lo mismo. Comprobado al revés: retirando un token del
bloque, la prueba se pone roja.

**4 · REG-291 — el backlog decía tres P0 falsos.**

Los tres P0 de audio se cerraron el 8-ago en `CURRENT_ITERATION.md` y en el
documento de auditoría, pero **no en `agent-state/BACKLOG.json`**, que es el que
la directiva §3 nombra como backlog del programa. El commit que los cerró
avisaba en su mensaje de este mismo defecto y lo cometió mientras lo describía.

Guardián nuevo que cruza los tableros, con el silencio tratado como lo que es:
que un tablero no mencione un elemento **no dice nada** sobre él. Cazó una
ambigüedad de mi propia prosa en su primera ejecución completa.

### Compuertas en este checkpoint

| Compuerta | Resultado |
|---|---|
| `npx vitest run` | **8 476 casos · 1 fallo preexistente y de entorno** (`ops-timeout-y-punto-ciego`: abre una conexión a una IP no enrutable esperando que expire; tras el proxy de este contenedor falla rápido). Idéntico al checkpoint del 8-ago |
| `lint-trinquete` | **96, igual que el techo.** Sin deuda nueva |
| `npx tsc --noEmit` | **limpio** |
| `npm run build` | **«Compiled successfully in 38.2s»** y «Finished TypeScript». Luego falla al recolectar datos de página con `auth/invalid-api-key`: **este contenedor no tiene las variables de Firebase**. Entorno, no código |
| trinquete de diseño | **igual que el techo** (recién congelado) |
| navegador / móvil / a11y | **no ejecutadas** |

---

## Qué hacer al reanudar

**1. Comprobar** que `git log --oneline -3` incluye este commit y correr
`node scripts/agent-state/actualizar.mjs`.

**2. NO rehacer `DESIGN-THEME-001`.** La escalera está puesta y congelada.

**3. `A11Y-GATE-001`** es lo siguiente de `DESIGN-SYSTEM-001`. Hoy hay **1**
prueba de accesibilidad entre 540 y es una expresión regular sobre `layout.tsx`.
No hay `axe-core`, ni `jest-axe`, ni `@axe-core/playwright` en `package.json`, y
`eslint.config.mjs` son 18 líneas sin `jsx-a11y`. Empezar por las 9 pantallas
del paciente, que es lo que V9 gobierna, y luego trinquete.

**4. Después**, migrar `components/ui/` (12 primitivas, 24 % de adopción) a las
utilidades `nx-`: es donde el cambio se multiplica sin repintar a mano.

**5. Lo que necesita navegador y no se puede hacer aquí**: `DESIGN-LITERAL-001`
(127 literales `#3d5afe`), `DESIGN-MEDIOPIXEL-001` (1 025 medios píxeles) y las
seis comprobaciones de `NAV-NAVEGADOR-001`. **Dos de esas seis pueden convertir
un P2 en P0.**

**6. Único P0 abierto de verdad**: `PATIENT-TELE-002` — el enlace de
videoconsulta que viaja por WhatsApp sigue sin token. Comprobado hoy contra el
árbol: `api/cron/reminders:212` y `api/whatsapp/webhook:1083,1276` siguen
llamando a `dondeEsLaCita` sin `tokenPaciente`.

## Lo que este checkpoint NO garantiza

Que la interfaz esté bien. **Nadie ha abierto una pantalla** — ni en esta sesión
ni en la anterior. El trinquete cuenta literales; una pantalla con cero estilos
en línea puede ser ilegible y pasará. Ninguna pantalla está aprobada.
