# V9 — bitácora y operación

> **Esto NO es la especificación.** La especificación maestra y autoritativa de
> V9 es [`NEXUSMED_PATIENT_EXPERIENCE_AND_DESIGN_MASTER_LOOP_V9.md`](./NEXUSMED_PATIENT_EXPERIENCE_AND_DESIGN_MASTER_LOOP_V9.md),
> que el dueño entregó el 9-ago-2026 y que se guarda **íntegra y sin mezclar**.
>
> Lo que sigue vivía dentro de aquel archivo: la lectura operativa del programa
> (condición de terminado por iteración, protocolo de reanudación, compuertas) y
> la **bitácora de unidades cerradas con su SHA**. Se movió aquí para que la
> especificación quede exactamente como la escribió el dueño y no se confunda
> nunca con la interpretación de quien la ejecuta.
>
> **Si esto y la especificación se contradicen, gana la especificación.**

---

## §1 — Las nueve iteraciones, con su condición de terminado

El orden **no es negociable**: lo fijó el dueño y además es el único orden en el
que cada pieza tiene dónde apoyarse. Rediseñar antes de tener sistema de diseño
es repintar; construir el compañero del paciente antes de tener navegación que no
pierda contexto es construir sobre arena.

| # | Iteración | Terminado cuando | Depende de |
|---|---|---|---|
| 0 | **PATIENT-UX-TRUTH-001** | Los 7 documentos existen, con inventario real de pantallas, y hay backlog P0/P1/P2/P3 con evidencia por hallazgo | — |
| 1 | **DESIGN-SYSTEM-001** | Existen tokens, escala tipográfica, escala de espacio, jerarquía y primitivas; hay compuerta que falla si una pantalla nueva no los usa | 0 |
| 2 | **NAVIGATION-001** | El ciclo Agenda→Paciente→Consulta→Resultados→Consulta devuelve el contexto exacto; hay prueba que falla sin el arreglo | 1 |
| 3 | **PATIENT-COMPANION-001** | Las cinco destinaciones existen, móvil primero, con `PatientVisitPackage` en DRAFT/RELEASED | 2 |
| 4 | **POSTVISIT-001** | El paquete se genera del encuentro y **sólo se libera con aprobación del médico** | 3 |
| 5 | **PATIENT-AI-001** | ASK NEXUS con las cinco clases de respuesta, jerarquía de fuentes y las doce pruebas de equipo rojo en verde | 4 |
| 6 | **DOCUMENTS-001** | Cartera con los ocho tipos y los cuatro estados, identificador seguro y bitácora | 4 |
| 7 | **CLOSED-LOOP-PATIENT-001** | Los tres bucles (orden, seguimiento, mensaje) cierran y se puede ver dónde se atoró cada uno | 6 |
| 8 | **PATIENT-LANGUAGE-001** | es-MX completo; en-US arquitectado con paquetes de locale, **sin bifurcar el producto** | 3 |
| 9 | **VISUAL-EXCELLENCE-001** | Barrido visual de toda la app contra el sistema de diseño, verificado en navegador y en móvil | 1, 2 |

### Lo que V9 explícitamente NO hace

- **No vende Hospital ni UCI.** Siguen en ALPHA, detrás de bandera. No entran al
  tanteo de Practice y su incompletitud **no bloquea** este programa — salvo que
  el defecto esté en el núcleo compartido y le pegue a Practice.
- **No empieza por colores** ni por un chatbot. Instrucción explícita §13.
- **No copia la UI de nadie pixel por pixel.** Se extraen principios de
  interacción, y se documenta dónde NexusMED puede ser objetivamente mejor.
- **No despliega, no fusiona a `main`, no toca Stripe productivo, no manda
  mensajes reales, no emite recetas reales, no usa datos de pacientes reales, no
  hace migraciones destructivas.**

---

## §2 — Seguridad del paciente en la IA de cara al paciente

Esto es lo más peligroso que ha construido este proyecto, y merece decirse en
voz alta: **hasta hoy, la IA hablaba con el médico.** Un error se lo comía un
profesional entrenado que podía verlo. A partir de PATIENT-AI-001, la IA le habla
a alguien que **no puede detectar el error**.

Por eso las prohibiciones de §0 no son una lista de deseos: son **invariantes
sellados**, con prueba que falla al revés, y viven en
`.claude/rules/patient-facing-ai.md`.

### El orden de las fuentes es la defensa, no una preferencia

Un dato específico del paciente **sólo** puede venir de material aprobado por el
médico. El modelo general entra **únicamente** al final de la lista y **sólo**
para explicar o reformular lo que ya dijo el médico. Nunca para producirlo.

> Si la respuesta no se puede sostener sobre una fuente aprobada, la respuesta
> **no es una respuesta**: es una escalación.

### Ausencia de dato no es dato de ausencia — también aquí

Que el plan aprobado no mencione el embarazo no significa que la paciente no esté
embarazada. Que no diga «no manejes» no significa que pueda manejar. La regla 4 de
seguridad clínica se aplica igual del lado del paciente.

---

## §3 — Estado persistente y reanudación

V9 se apoya en la lección más cara del programa (REG-241): **un tablero que
depende de que alguien se acuerde, miente.**

| Archivo | Qué guarda | Cómo se mantiene |
|---|---|---|
| `agent-state/MASTER_STATE.json` | Versión, REG, pruebas, rama, trabajo sin subir | **DERIVADO** por `node scripts/agent-state/actualizar.mjs` |
| `agent-state/CURRENT_ITERATION.md` | Criterio de la iteración en curso | A mano; sólo criterio, nunca cifras derivables |
| `agent-state/DESIGN_STATE.md` | Estado del sistema de diseño y del barrido visual | A mano, tras cada iteración |
| `agent-state/PATIENT_COMPANION_STATE.md` | Estado del compañero del paciente y del paquete de visita | A mano, tras cada iteración |
| `agent-state/LAST_SAFE_CHECKPOINT.md` | Último punto del que se puede reanudar sin rehacer nada | **Tras cada unidad cerrada**, con SHA de git |
| `agent-state/BACKLOG.json` | Backlog priorizado, con los P0/P1/P2/P3 de V9 | Tras cada hallazgo y cada cierre |
| `agent-state/BLOCKERS.md` | Lo que exige credencial o consola del dueño | Cuando aparece |
| `agent-state/OWNER_DECISIONS_REQUIRED.md` | Decisiones que **sólo** el dueño puede tomar | Se acumulan, no se preguntan de una en una |

### Protocolo de reanudación

```
1. Leer LAST_SAFE_CHECKPOINT.md
2. git log --oneline -5   ← ¿coincide el SHA?
3. node scripts/agent-state/actualizar.mjs --verificar
4. Leer CURRENT_ITERATION.md → ¿hay una unidad a medias?
5. Si la hay: terminarla. Si no: la siguiente del §1.
6. NUNCA rehacer una unidad marcada cerrada con su SHA.
```

---

## §4 — Compuertas de calidad de V9

A las compuertas que ya existen (`vitest`, trinquete de lint, `npm run build`)
V9 añade las suyas. **Ningún candidato a liberación con un P0 abierto.**

| Compuerta | Herramienta | Estado |
|---|---|---|
| types | `npm run build` (tsc) | existente |
| lint | `node scripts/lint-trinquete.mjs` (techo 98, sólo baja) | existente |
| unit + integration | `npx vitest run` | existente |
| E2E | CI | existente, limitado (B-10: falta cuenta de prueba) |
| **accessibility** | por definir en DESIGN-SYSTEM-001 · objetivo **WCAG 2.2 AA** | **nueva** |
| **visual regression** | por definir en DESIGN-SYSTEM-001 | **nueva** |
| **mobile** | `agent-browser` con viewport móvil | **nueva** |
| **browser workflow** | `agent-browser` sobre la app corriendo | **nueva** |
| security | `security-review`, reglas de Firestore, matriz de acceso | existente |
| patient safety | motores deterministas + `patient-safety-officer` | existente |
| **patient AI red team** | las 12 preguntas de §0, como fixture permanente en `evals/patient-ai/` | **nueva** |

**Y la regla que gobierna todas**: *no se aprueba UI leyendo el código.* Se
lanza el producto, se mira, se recorre el flujo de verdad, se prueba en móvil,
se prueba con teclado y se comprueba que el estado sobrevive.

---

## §5 — Capacidades realmente disponibles (verificadas el 8-ago-2026)

Declaradas aquí para que ninguna iteración futura invente una herramienta que no
existe, y para que se note el día que una desaparezca.

**Sí hay**: Opus 5 · subagentes · 8 agentes de proyecto en `.claude/agents/` ·
skill `agent-browser` · WebFetch · WebSearch · worktrees · tareas en segundo
plano · cron · `Workflow` (`auditoria-maestra`, `nexus-os`) · vitest · trinquete
de lint · `npm run build` · comando `/v1`.

**NO hay** (y no se debe suponer): MCP de Chrome (`mcp__claude-in-chrome__*` —
el comando `/v1` todavía lo menciona; **está caduco**) · PubMed, Stripe, Notion y
Mem están conectados pero **sin autenticar**: sólo exponen `authenticate`.

---

## §6 — Bitácora de V9

Una línea por unidad cerrada. Sin número de versión y SHA, no está cerrada.

| Fecha | Unidad | SHA | Qué quedó | REG |
|---|---|---|---|---|
| 2026-08-08 | Apertura de V9 + reconciliación del tablero | *(en curso)* | Directiva íntegra en disco; V7/SUPERARLOS/GRABACIÓN intactos | — |

---

## §6 — Bitácora de V9 (continúa)

| Fecha | Unidad | SHA | Qué quedó | REG |
|---|---|---|---|---|
| 2026-08-08 | **PATIENT-UX-TRUTH-001** | `639ca73` | 7 documentos · backlog de 14 (4 P0) · inventario derivado con guardián · dos defectos reparados | **265, 266** |
| 2026-08-09 | **PATIENT-AUDIO-001/002/003** | `fed81cc` | Los tres P0 de pérdida de audio. Residuo declarado: PATIENT-AUDIO-004 | **267-270** |
| 2026-08-09 | **DESIGN-SYSTEM-001** | `fed81cc` | Tokens visibles para Tailwind (4 → ~35), cinco escalas nuevas, cero respaldos y trinquete de diseño | **274, 275** |
| 2026-08-09 | **NAVIGATION-001** | `fed81cc` | El ciclo devuelve el contexto: seguimiento que sobrevive, atrás de verdad, agenda en la URL, aviso antes de cortar el dictado | **276-279** |
| 2026-08-09 | **PATIENT-COMPANION-001** | `5d496cf` | Cinco destinos, PaqueteDeVisita DRAFT/RELEASED y la compuerta en el servidor. Composición diferida a POSTVISIT-001 por no tener llamador | **280, 281** |
