# Último punto seguro de reanudación

> **Para qué sirve**: que la siguiente sesión sepa, sin leerse todo, qué está
> cerrado y qué es lo siguiente. Se actualiza **tras cada unidad cerrada**, con
> su SHA. Sin SHA, una unidad no está cerrada.

---

## Checkpoint · 9-ago-2026

| | |
|---|---|
| **Rama** | `claude/compassionate-galileo-lkq6yf` |
| **SHA base de esta sesión** | `e32d582` (merge del PR #270) |
| **SHA de cierre** | `7b53c9b` (`REG-289`, v1163) · +`91603ce` (B-12) · +el barrido de navegador |
| **Unidad** | `DESIGN-SYSTEM-001` — **abierta**, primer paso cerrado |
| **Siguiente** | ensanchar `@theme inline` (`DESIGN-THEME-001`) |

### Qué quedó hecho en esta sesión

**REG-289 · catorce rellenos azules que reprobaban WCAG AA**, once de ellos
botones primarios: «Iniciar consulta» del tablero, «Crear mi consultorio»,
«Crear cuenta», el botón de enviar del chat, los filtros de `/pacientes`, el
globo de mensajes sin leer del `Sidebar` y los tres CTA de precios.

El relleno pasa a `var(--nexus-solido)` y su texto a `#fff` — 5,13 en tema
oscuro y 6,71 en claro, contra los 3,28 / 3,13 / 2,95 de antes.

**Y lo que de verdad importa**: los catorce ya estaban cubiertos por el guardián
de REG-233, en verde desde hacía dos versiones. Comprobaba **una línea a la
vez**, y `background` y `color` viven en líneas distintas del mismo objeto.
Tampoco leía `.css`, así que `globals.css` no se miraba nunca.

**Guardián nuevo**: `el-relleno-y-su-texto-se-miden-juntos.test.ts` (8 casos,
sellado). **Mide** el cociente de contraste por ámbito —objeto de estilo o regla
CSS— y **lee los tokens del propio `globals.css`**, así que no hay ninguna cifra
copiada que se pueda desfasar.

**Estado puesto al día**: `BACKLOG.json` marcaba los tres P0 de audio y
`PATIENT-TELE-002` como `pendiente` cuando llevaban cerrados desde v1158–v1161.
Ya dicen `cerrado`, con su versión y su REG.

### Compuertas en este checkpoint

| Compuerta | Resultado |
|---|---|
| `npx vitest run` | 8 448 casos · **1 fallo preexistente y de entorno** (`ops-timeout-y-punto-ciego`: abre una conexión a una IP no enrutable esperando que expire; tras el proxy de este contenedor falla rápido). Idéntico al checkpoint anterior |
| `lint-trinquete` | **96, igual que el techo.** Sin deuda nueva |
| `npx tsc --noEmit` | **limpio** |
| `npm run build` | **compila** (llega a «Collecting page data») y falla ahí con `auth/invalid-api-key`: **este contenedor no tiene las variables de Firebase**. Entorno, no código |
| **navegador** | **ejecutado.** `node scripts/design/contraste-en-el-navegador.mjs` sobre `next dev`: **24 rellenos azules opacos medidos en los dos temas, 0 reprueban** — 5,13 en oscuro y 6,71 en claro, exactamente la aritmética. Sólo pantallas públicas |
| móvil / a11y completa | **no ejecutadas** |

---

## Qué hacer al reanudar

**1. Comprobar** que `git log --oneline -3` incluye `7b53c9b` y correr
`node scripts/agent-state/actualizar.mjs`.

**2. Seguir en `DESIGN-SYSTEM-001`**, por el orden que quedó en
`DESIGN_STATE.md`:

- **Ensanchar `@theme inline`** (`globals.css:126-131`). Es la causa raíz del
  monolito de estilo en línea: Tailwind sólo ve cuatro tokens, así que no hay
  utilidades que usar y el código no tiene alternativa. No es dejadez: es
  mecánica.
- Tokens de espacio, radio y sombra, **cada uno con su guardián de ámbito** —no
  de línea. Ésa es la lección que deja REG-289 para el resto de la unidad.
- Los literales *slate* que no siguen al tema, en 10 archivos.
- Las tablas, adoptando `.table-wrap.rwd`.

**3. `A11Y-GATE-001` sigue abierto** y no se puede cerrar leyendo código: el
contraste heredado, el foco, el orden de tabulación y los nombres accesibles
exigen `axe` sobre la aplicación corriendo.

**4. Cuando haya entorno con credenciales de Firebase**: las seis comprobaciones
de navegador de `NAV-NAVEGADOR-001`. **Dos de ellas pueden convertir un P2 en
P0.** Y la comprobación en vivo del arreglo de REG-265, que se hizo siguiendo
tres archivos y no abriendo la aplicación.

## Lo que este checkpoint NO garantiza

Que la interfaz esté bien. **Se abrieron doce pantallas públicas y se midió el
DOM pintado** —eso es nuevo, y confirma que el arreglo LLEGA al navegador— pero:

- **Sólo lo público.** La consulta, la UCI y el hospital están detrás del login
  (B-10). Ahí viven la mayoría de los catorce arreglos, y **no se han visto**.
- **Sólo el estado en reposo.** Un botón que sólo existe al pasar el ratón, al
  enfocarlo o cuando el formulario es válido no se pinta y no se mide. En
  `/registro` el botón nace `var(--s3)`: por eso no aparece en la lista.
- **Sólo rellenos opacos.** Un tinte translúcido se compone con el lienzo y
  medirlo como opaco da una cifra que no existe — la primera versión del barrido
  sacó cuatro falsos a 1,56 en la portada por eso.
- **Sólo contraste.** El foco, el orden de tabulación y los nombres accesibles
  siguen sin cubrirse (`A11Y-GATE-001`).

Ninguna pantalla está **aprobada**: se comprobó un cociente, no un diseño.
