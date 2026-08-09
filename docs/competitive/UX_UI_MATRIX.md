# Matriz de UX/UI — principios extraídos y dónde estamos

> **Unidad**: V9 · `PATIENT-UX-TRUTH-001` · 8-ago-2026
> **Fuentes**: información pública de agosto de 2026 (§Fuentes de
> `PATIENT_EXPERIENCE_MATRIX.md`). **No se ha probado ningún producto de la
> competencia** — no hay acceso, y no se va a inventar una impresión de uso.
> **Insumo de**: `DESIGN-SYSTEM-001`, `NAVIGATION-001`, `VISUAL-EXCELLENCE-001`.

---

## §0 — La advertencia honesta sobre esta matriz

Casi todo lo publicado sobre Abridge, Nabla, Suki y Dragon Copilot describe
**resultados** (horas ahorradas, reducción de agotamiento, especialidades,
idiomas, integración con Epic), no **interfaz**. No hay material público que
permita comparar jerarquía visual, densidad, navegación o accesibilidad casilla
por casilla sin inventarlo.

Así que esta matriz no compara pantallas: **compara los principios de
interacción que su comportamiento público implica, contra lo que este
repositorio demuestra hacer**. La columna de NexusMED sí es verificable y sale
del código.

## §1 — Principios extraídos del mercado, y qué exigen

| # | Principio | De dónde se deduce | Qué exige de una interfaz |
|---|---|---|---|
| 1 | **El valor está en el borde de la consulta, no dentro** | Abridge pasó en junio de 2026 de escriba a asistente de antes/durante/después | La pantalla de consulta no puede ser una isla: tiene que llevar a lo de antes y a lo de después sin perder el contexto |
| 2 | **El médico revisa y despacha; no redacta** | Todo el mercado converge en «generado para revisión» | La unidad de interacción es *aprobar / corregir / rechazar*, no *escribir*. Y lo corregido tiene que ser reversible |
| 3 | **El paciente necesita nivel de lectura, no traducción** | El fallo repetido del resumen no es el idioma, es la jerga | Redacción a ~7.º de primaria como requisito de producto, no como opción |
| 4 | **Se entrega donde el paciente ya vive** | El resumen se empuja al portal, no a un sitio nuevo | Para el médico independiente en México: un enlace, no un portal hospitalario |
| 5 | **La confianza se gana enseñando de dónde salió** | Nadie lo hace públicamente — es hueco, no principio ajeno | Procedencia visible en la interfaz, no en una bitácora |

## §2 — Cómo queda NexusMED contra cada principio

| # | Principio | Estado | Evidencia |
|---|---|---|---|
| 1 | Antes/durante/después sin perder contexto | **❌ Ahí está el peor defecto** | Navegar termina la grabación en silencio; volver a grabar borra el audio anterior. `NAVIGATION_STATE_AUDIT.md` §1 |
| 2 | Revisar y despachar, reversible | **✅ Fuerte** | Panel de revisión con punto de deshacer (REG-198), historial de versiones, adendas, «antes de firmar» |
| 3 | Lenguaje llano para el paciente | **◐ Hecho y sin entregar** | `como-se-lo-explico.ts` es **determinista** y se niega a inventar («cada 5 horas» no se expande). Pero la hoja no le llega nunca al paciente |
| 4 | Entregar donde el paciente vive | **◐** | El portal `/mi/[token]` existe y hace mucho; la hoja de la visita no está en él |
| 5 | Procedencia visible | **✅ Y aquí se gana** | «¿De dónde salió esto?» (REG-239), audio conservado (REG-249), **pulsar una frase y oír el segundo exacto** (REG-250). No hay equivalente público en ningún competidor |

## §3 — Contra los antipatrones que la directiva teme

La directiva pide que la interfaz no parezca «SaaS generado por IA». Se midió, y
**esas señales no están aquí**: cero degradados, cero `from-purple`, una
`rounded-2xl`, una `shadow-2xl`, un `backdrop-blur`. Hay una identidad declarada
y con contraste medido a mano.

**El antipatrón real de este producto es otro y no está en la lista de la
directiva: un sistema de diseño que existe y al que la aplicación no obedece.**
88,5 % de los archivos usan estilo en línea; los primitivos compartidos se usan
en el 24 %; hay 1 205 hexadecimales a mano y ~3 000 tamaños de letra en línea con
~60 valores. El detalle, con recuentos, en `GENERIC_AI_AESTHETIC_AUDIT.md`.

Esto importa para la comparación: **un producto puede ser sobrio y aun así verse
inconsistente**, y la inconsistencia se lee como descuido — que en software
clínico se lee como poca fiabilidad.

## §4 — Los principios de la directiva V9, y cuál está peor servido

`CALMA · CLARIDAD · JERARQUÍA · CONTEXTO · CONTINUIDAD · REVELACIÓN PROGRESIVA ·
REVERSIBILIDAD · PROCEDENCIA · ACCESIBILIDAD · VELOCIDAD`

| Principio | Cómo está | Por qué |
|---|---|---|
| **CONTINUIDAD** | 🔴 **el peor** | Tres P0 de pérdida de audio al navegar; agenda, expediente y scroll se reinician |
| **ACCESIBILIDAD** | 🔴 | 1 prueba de accesibilidad entre 540; 41 botones sólo-icono con 4 etiquetas; sin `axe` |
| **JERARQUÍA** | 🟡 | La escala tipográfica existe y no se usa: 60 tamaños distintos |
| **CONTEXTO** | 🟡 | El contexto del paciente se mantiene; el de la jornada de trabajo no |
| **CLARIDAD** | 🟡 | El lenguaje llano está resuelto y sin entregar |
| **REVERSIBILIDAD** | 🟢 | Deshacer, versiones, adendas, correcciones visibles |
| **PROCEDENCIA** | 🟢 **la ventaja** | Frase → segundo exacto del dictado |
| **CALMA** | 🟢 | Sin degradados ni ruido; oscuro por defecto y medido |
| **VELOCIDAD** | ❔ | No medida. `VISUAL-EXCELLENCE-001` |
| **REVELACIÓN PROGRESIVA** | ❔ | No evaluable sin abrir las pantallas |

## §5 — Consecuencias para el orden de V9

El orden de la directiva es `DESIGN-SYSTEM-001 → NAVIGATION-001 → …` y **se
respeta**, con dos matices que salen de esta auditoría:

1. **Los tres P0 de audio no esperan su turno.** Son pérdida irreversible de
   datos clínicos, y la propia rutina dice que un P0 de seguridad o integridad
   manda sobre el orden. Van primero, aunque su ficha diga `NAVIGATION-001`.
2. **`DESIGN-SYSTEM-001` empieza por `@theme inline`, no por colores.** La
   directiva prohíbe empezar por colores (§13) y además el color no es el
   problema: el problema es que Tailwind sólo ve cuatro tokens, y de ahí sale el
   monolito de estilo en línea. Ensanchar esa exposición es la causa raíz;
   cualquier otra cosa es cosmética sobre un cimiento que no sostiene.

## §6 — Qué **NO** cubre esta matriz

- **No compara interfaces.** No hay material público suficiente, y no se ha
  probado ningún producto ajeno.
- **No mide velocidad ni percepción.** Ninguna métrica de rendimiento se tomó.
- **No sustituye mirar las pantallas.** La directiva V9 §4 lo prohíbe
  explícitamente, y esta matriz **no aprueba** ninguna pantalla.
- **Las cinco columnas de la competencia son deducciones**, no declaraciones
  suyas. Están escritas como principios precisamente para no fingir precisión
  que no hay.
