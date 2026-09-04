# Criterio formal de terminación de V9

> **Este archivo define cuándo puede existir `agent-state/V9_COMPLETE.md`.**
>
> `V9_COMPLETE.md` **no existe todavía**, y no debe crearse hasta que todo lo de
> aquí se cumpla. Mientras no exista, V9 sigue abierto y cada ejecución continúa
> por el checkpoint.
>
> **No es una promesa: es una compuerta.**
> `src/__tests__/v9-completo-no-se-declara-antes-de-tiempo.test.ts` falla si
> `V9_COMPLETE.md` aparece mientras queda una sola condición sin cumplir.

---

## Por qué el criterio se escribe ANTES de terminar

Un programa autónomo sin condición de terminado no termina: **se le ocurren
tareas**. Rediseña lo ya diseñado, refactoriza lo que funcionaba, y cada
ejecución encuentra algo que «mejorar» porque encontrar algo siempre es posible.

Eso no es diligencia: es no saber parar. Y en un producto clínico, cambiar lo
que ya está probado tiene un coste de riesgo que no compensa un cambio que nadie
pidió.

Por eso el criterio se fija **hoy**, cuando todavía no se puede ajustar a lo que
convenga. Un criterio escrito al final se escribe para que dé aprobado.

---

## Las tres condiciones

### 1 · Las diez unidades, terminadas y validadas

Cada una necesita **SHA de cierre** en
[`LAST_SAFE_CHECKPOINT.md`](./LAST_SAFE_CHECKPOINT.md) y entrada en la bitácora
de [`docs/ai/V9-BITACORA-Y-OPERACION.md`](../docs/ai/V9-BITACORA-Y-OPERACION.md).
Sin SHA, una unidad no está cerrada.

| # | Unidad | Estado | SHA |
|---|---|---|---|
| 0 | `PATIENT-UX-TRUTH-001` | ✅ **cerrada** | `6a6501d` |
| 1 | `DESIGN-SYSTEM-001` | ✅ **cerrada** | `5bb1a2c` |
| 2 | `NAVIGATION-001` | ✅ **cerrada** | `fed81cc` |
| 3 | `PATIENT-COMPANION-001` | ✅ **cerrada** | `5d496cf` |
| 4 | `POSTVISIT-001` | ✅ **cerrada** | (esta rama) |
| 5 | `PATIENT-AI-001` | ✅ **cerrada** | (esta rama) |
| 6 | `DOCUMENTS-001` | ⬜ pendiente | — |
| 7 | `CLOSED-LOOP-PATIENT-001` | ⬜ pendiente | — |
| 8 | `PATIENT-LANGUAGE-001` | ⬜ pendiente | — |
| 9 | `VISUAL-EXCELLENCE-001` | ⬜ pendiente | — |

> Los tres P0 de audio (REG-294 a REG-297) se cerraron **fuera de turno**, por la
> regla de prioridad autónoma de la especificación: seguridad del paciente e
> integridad de datos van antes que el orden de la lista. No cerraban
> `NAVIGATION-001` por sí solos; esa unidad se cerró aparte, con REG-300 a
> REG-303.

### 2 · Cero P0 y cero P1 bloqueantes

En `BACKLOG.json`, ningún elemento con `prioridadV9` de `P0` o `P1` en estado
distinto de `CERRADO`.

**Abiertos hoy** (ver `BACKLOG.json` para el detalle y el plan de cada uno):

| Prioridad | Id |
|---|---|
| P0 | **ninguno** |
| P1 | `NAV-NAVEGADOR-001` — seis comprobaciones que sólo un navegador puede resolver |

> `POSTVISIT-GATE-001` y `POSTVISIT-ENTREGA-001` se cerraron el 27-ago-2026 con
> `POSTVISIT-001` (REG-335): la compuerta de firma vive en el servidor y lo
> liberado llega al portal del paciente por un camino recorrido de punta a punta.

> **`PATIENT-TELE-002` se cerró el 2-sep-2026 sin reparar nada**, y merece
> decirse: **el renglón estaba desfasado, no el producto.** Describía
> `api/cron/reminders` llamando a `dondeEsLaCita` sin `tokenPaciente`, y ese
> llamador acuña el token desde `5ea8d03`. Los dos `''` que quedan en
> `whatsapp/webhook` son una decisión escrita —el bot agenda con semanas de
> antelación y un token muerto el día de la consulta contesta 404 «tu cita no
> existe», que es peor que no mandar enlace—. 35 casos en verde lo cubren.
>
> Es la advertencia de `GP-FINAL` aplicada al propio backlog: **antes de creerle
> a algo que dice que el producto está roto, hay que descartar que lo roto sea
> el instrumento.** Un P0 fantasma cuesta lo mismo que uno real: bloquea el
> criterio de terminación y manda a la siguiente sesión a reparar lo reparado.

> `PATIENT-PORTAL-001` y `A11Y-GATE-001` ya constan `CERRADO` en `BACKLOG.json`
> y se retiran de esta lista, que llevaba nombrándolos desde que se escribió.

Un P1 sólo deja de bloquear si el **dueño** lo acepta por escrito en
`OWNER_DECISIONS_REQUIRED.md` como riesgo residual: aceptar riesgo residual
crítico es decisión suya, no de quien ejecuta (§AUTONOMOUS DECISIONS de la
especificación).

### 3 · Las compuertas de calidad de la especificación

Las de §QUALITY GATES, cada una con su evidencia y su fecha:

| Compuerta | Hoy |
|---|---|
| types (`npx tsc --noEmit`) | ✅ limpio |
| lint (`node scripts/lint-trinquete.mjs`) | ✅ 96, igual que el techo |
| unit + integration (`npx vitest run`) | ✅ salvo 1 fallo de entorno declarado |
| E2E | ◐ limitado — falta cuenta de prueba (B-10) |
| **accessibility** | ❌ sin definir — `A11Y-GATE-001` |
| **visual regression** | ❌ sin definir |
| **mobile** | ❌ no ejecutado |
| **browser workflow** | ❌ no ejecutado — `NAV-NAVEGADOR-001` |
| security review | ✅ vigente |
| patient-safety review | ✅ vigente |
| **patient-AI red team** | ◐ **existe y corre** desde `PATIENT-AI-001` (2-sep-2026): `evals/patient-ai/casos.json`, 29 casos —los 12 de la especificación más 17 del equipo rojo— contra los módulos deterministas, en cada `vitest run`. **Limitado a propósito, y hay que decirlo**: mide lo que el sistema hace ANTES de dejar redactar, no lo que un modelo redacta. Cubre 4 de las 5 clases del §2; la quinta (`EDUCATIONAL_EXPLANATION`) no tiene implementación y el golden lo comprueba en vez de fingirlo |

**Ninguna compuerta puede declararse aprobada sin haberse ejecutado.** La
especificación lo prohíbe con todas las letras: *«claim validation not actually
performed»* está en la lista de NUNCA.

---

## Qué pasa cuando `V9_COMPLETE.md` exista

Las ejecuciones siguientes **no inventan trabajo nuevo ni rediseñan** para seguir
ocupadas. Se limitan a:

1. Comprobar que las compuertas siguen verdes.
2. Atender un P0 nuevo si aparece.
3. Ejecutar lo que el dueño pida explícitamente.

Si una ejecución cree que hace falta una unidad nueva después de V9, **no la
empieza**: la propone en `OWNER_DECISIONS_REQUIRED.md` y para.

---

## Qué NO significa terminar V9

- **No significa desplegar.** Desplegar y fusionar a `main` son decisiones del
  dueño, en V9 y después.
- **No significa que Hospital y UCI estén listos**: siguen en ALPHA, fuera del
  alcance.
- **No significa que el producto sea perfecto.** Significa que las diez unidades
  se cerraron con su evidencia y que no queda ningún P0 ni P1 abierto. Es una
  condición verificable, no un juicio de calidad.
