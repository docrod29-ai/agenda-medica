# Último punto seguro de reanudación

> **Para qué sirve**: que la siguiente sesión sepa, sin leerse todo, qué está
> cerrado y qué es lo siguiente. Se actualiza **tras cada unidad cerrada**, con
> su SHA. Sin SHA, una unidad no está cerrada.

---

## Checkpoint · 9-ago-2026

| | |
|---|---|
| **Rama** | `claude/relaxed-fermi-090gh5` |
| **SHA base de esta sesión** | `0144257` (merge del PR #271, v1163) |
| **SHA de cierre** | *(el commit de `DESIGN-SYSTEM-001` — ver `git log --oneline -3`)* |
| **Unidad cerrada** | **`DESIGN-SYSTEM-001`** (iteración 1 de V9) |
| **Siguiente unidad** | **`NAVIGATION-001`** (iteración 2) |

### Qué quedó hecho

**La causa raíz, atacada donde estaba.** `@theme` exponía a Tailwind cuatro
cosas; hoy expone **43 tokens** en cinco espacios (color, espacio, radio,
tipografía, sombra), con una utilidad por token. Sin eso el código no tenía
alternativa al estilo en línea — de ahí salían los 6 065 `style={{}}`.

**Y se comprueba que LLEGAN.** `scripts/design/verificar-utilidades.mjs` compila
el `globals.css` real y mira la hoja de salida: que `bg-s2` exista **y** que su
valor sea `var(--s2)`, no un color congelado (si se congelara, el tema claro
pintaría oscuro y nada daría error).

**Tres compuertas nuevas**, todas dentro de la suite y por tanto en CI:

| Compuerta | Techo hoy | Orden a mano |
|---|---|---|
| Deriva de diseño | **2 600** | `npm run diseno:trinquete` |
| Deuda de accesibilidad | **312** | `npm run a11y:trinquete` |
| «la utilidad llega» | — | dentro de la suite |

Los techos **sólo bajan**, y encima: **un archivo nuevo nace limpio**. Ésa es la
compuerta que pedía la directiva V9 §1 para esta unidad.

**Archivos nuevos**: `scripts/design/trinquete-comun.mjs` ·
`trinquete-de-diseno.mjs` · `trinquete-de-accesibilidad.mjs` ·
`verificar-utilidades.mjs` · `docs/design/diseno-techo.json` · `a11y-techo.json`
· `src/__tests__/el-sistema-de-diseno-se-cumple.test.ts` ·
`la-interfaz-se-puede-usar-sin-raton.test.ts` (**+33 casos**).

**Dos correcciones que salieron de medir, no de leer**:

1. La auditoría decía que migrar `#3d5afe` «no cambia ni un píxel». Sólo en tema
   oscuro. Corregido en `GENERIC_AI_AESTHETIC_AUDIT.md`, donde se leerá.
2. Los dos únicos `<img>` sin `alt` de la primera medición estaban **dentro de un
   comentario**: 100 % de falsos positivos. Los trinquetes miden código, no
   prosa.

**Siete clases CSS muertas borradas** (`.text-teal*`, `.bg-s1/2/3`,
`.border-theme`): cero usos en 203 `.tsx`, y tres chocaban por nombre con la
utilidad generada desde el token.

### Compuertas en este checkpoint

| Compuerta | Resultado |
|---|---|
| `npx vitest run` | **8 493 casos** · 1 fallo **preexistente y de entorno** (`ops-timeout-y-punto-ciego`: abre una conexión a una IP no enrutable esperando que expire; tras el proxy de este contenedor falla rápido). Comprobado en el `HEAD` limpio antes de tocar nada: falla igual |
| `lint-trinquete` | **96, igual que el techo.** Sin deuda nueva |
| `npx tsc --noEmit` | **limpio** |
| `npm run build` | **compila** |
| `diseno:trinquete` · `a11y:trinquete` | en verde, en su techo |
| navegador / móvil / axe | **no ejecutadas** — sigue faltando entorno con credenciales |

---

## Qué hacer al reanudar

**1. NO rehacer `DESIGN-SYSTEM-001`.** Está cerrada. Su producto son los tokens,
las utilidades y los dos techos; no hay que volver a medir.

**2. NO empezar a migrar los 2 600 usos de deriva.** Eso es
`DESIGN-ADOPCION-001` y pertenece a `VISUAL-EXCELLENCE-001` (iteración 9), no a
la siguiente. Cada tramo cambia píxeles y exige verlo en un navegador.

**3. Empezar `NAVIGATION-001`.** Su criterio de terminado, del §1 de la
directiva: el ciclo **Agenda → Paciente → Consulta → Resultados → Consulta**
devuelve el contexto exacto, con prueba que falla sin el arreglo. Nunca se
pierden: paciente, encuentro, borrador de nota, desplazamiento, filtros, valores
de formulario, estado de audio, transcripción, borrador de IA, herramienta
clínica seleccionada.

En el backlog ya está el hallazgo que la abre: **`NAV-AGENDA-001`** — «Agenda →
Consulta → atrás nunca vuelve a la Agenda». Y el trabajo de audio de los tres P0
ya cerrados es su cimiento: la grabación ya sobrevive a navegar.

**4. Cuando haya entorno con credenciales de Firebase**, y sólo entonces:
`NAV-NAVEGADOR-001` (seis comprobaciones; **dos pueden convertir un P2 en P0**)
y `A11Y-AXE-001` (axe sobre las nueve pantallas del paciente). Las dos necesitan
lo mismo, así que van juntas.

## Lo que este checkpoint NO garantiza

Que la interfaz esté bien. **Nadie ha abierto una pantalla en toda V9.** Ninguna
pantalla está aprobada. Los trinquetes impiden que la deriva crezca; no dicen
nada sobre si el producto se ve o se usa bien, y la directiva V9 §4 prohíbe
aprobar interfaz leyendo código.

El trinquete de accesibilidad es un **suelo estático**: no ve contraste, ni orden
de foco, ni trampa de foco en modales, ni si una etiqueta dice algo útil.
Confundirlo con una auditoría de accesibilidad sería peor que no tenerlo.
