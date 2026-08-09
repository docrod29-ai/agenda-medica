# Último punto seguro de reanudación

> **Para qué sirve**: que la siguiente sesión sepa, sin leerse todo, qué está
> cerrado y qué es lo siguiente. Se actualiza **tras cada unidad cerrada**, con
> su SHA. Sin SHA, una unidad no está cerrada.

---

## Checkpoint · 9-ago-2026

| | |
|---|---|
| **Rama** | `claude/relaxed-fermi-yrvovc` |
| **SHA base de esta sesión** | `0144257` (merge del PR #271, v1163) |
| **SHA de cierre** | *(el commit de esta unidad)* |
| **Unidad cerrada** | **`DESIGN-SYSTEM-001` · parte A — la compuerta de contraste** (REG-291) |
| **Siguiente unidad** | `DESIGN-SYSTEM-001` · parte B (escalas + trinquete de adopción) |

### Qué quedó hecho

**Un defecto de verdad, medido y reparado**: 48 parejas fondo/texto por debajo de
WCAG AA en 22 archivos, en los dos temas — el relleno de marca bajo texto blanco
(3,28:1), los botones de WhatsApp (1,98:1) y seis botones desactivados cuyo texto
blanco sobre superficie clara daba **1,20:1**, o sea, no se veía.

La causa raíz no era el color: era que `--nexus` sirve de texto y de relleno, y
la corrección que creó `--nexus-solido` **se aplicó sólo a `.btn-primary`**,
mientras el 88 % de esta interfaz vive en `style={{ }}`.

**Un instrumento**: `scripts/design/contraste-en-linea.mjs`
(`npm run gate:contraste`), que lee los tokens de los dos temas de `globals.css`
y aplica la fórmula de luminancia relativa de WCAG 2.1.

**Una compuerta con techo CERO**: `docs/design/contraste-techo.json`. No hay
deuda congelada; cualquier pareja nueva por debajo de 4,5:1 falla.

**Cinco tokens de relleno** con su cociente medido y el mismo valor en los dos
temas: `--red-solido`, `--green-solido`, `--amber-solido`, `--whatsapp`,
`--whatsapp-t`. Y `--text3` del tema claro corregido (4,20 → 4,80 sobre `--s3`)
en los **dos** bloques donde se declara el tema claro.

**Una prueba sellada** de 10 casos, probada al revés sobre el repositorio real.

### Compuertas en este checkpoint

| Compuerta | Resultado |
|---|---|
| `npx vitest run` | **8 468 pasan · 1 omitida · 0 fallos** (567 archivos). El fallo de entorno de la sesión anterior ya no aparece |
| `lint-trinquete` | **96, igual que el techo.** Sin deuda nueva |
| `npx tsc --noEmit` | **limpio** |
| `npm run gate:contraste` | **0 parejas bajo 4,5:1**, igual que el techo |
| `npm run build` | ver la bitácora del commit — este contenedor no tiene las variables de Firebase y falla al recolectar datos de página, como en el checkpoint anterior |
| navegador / móvil / regresión visual | **no ejecutadas.** La aplicación no arranca aquí |

---

## Qué hacer al reanudar

**1. NO rehacer la parte A.** Está cerrada y sellada. Su producto es la compuerta
con techo 0: si vuelve a haber parejas por debajo de AA, la prueba lo dice sola.

**2. `DESIGN-SYSTEM-001` · parte B**, en este orden:

- Ensanchar `@theme inline` (`globals.css`) — hoy Tailwind ve **cuatro** tokens,
  y de ahí sale el monolito de estilo en línea. Es la causa mecánica, no la
  dejadez.
- Escala tipográfica y de espacio **derivadas del uso real**, no inventadas: los
  cuatro tamaños más usados (12, 13, 11, 14 px) concentran ~2 400 de ~2 900
  `fontSize` en línea y **no están** en la escala declarada de seis pasos.
- Un trinquete de adopción por token, con tolerancia cero para archivos nuevos,
  igual que el de contraste.

**3. Cuando haya entorno con credenciales de Firebase**: las seis comprobaciones
de navegador de `NAV-NAVEGADOR-001`, y la parte de accesibilidad que el contraste
no cubre (foco, etiquetas, orden de tabulación, objetivo táctil).

## Lo que este checkpoint NO garantiza

Que la interfaz se vea bien. Se ha medido una razón matemática sobre 22 archivos
tocados; **nadie ha abierto una pantalla**, y la directiva V9 §4 dice que no se
aprueba interfaz leyendo código. Lo que queda garantizado es que ninguna pareja
de estilo en línea es **ilegible**.
