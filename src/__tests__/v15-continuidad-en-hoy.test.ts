/**
 * V15-TODAY-001 — la zona CONTINUITY está CONECTADA en `/dashboard`, y lee la
 * MISMA fuente de verdad que `/pendientes`, no una copia.
 *
 * ── QUÉ PROTEGE ──────────────────────────────────────────────────────────────
 *
 * `docs/ai/NEXUSMED_MASTER_LOOP_V15_STRUCTURAL_UIUX_REARCHITECTURE.md` §6 pide
 * cinco zonas en Hoy, entre ellas CONTINUITY: «result awaiting action;
 * follow-up; medication change needing review […]». `ContinuidadPanel.tsx`
 * las lee de `tareasVivas()` — el worklist que ya usa `/pendientes/page.tsx`.
 *
 * El riesgo es la misma familia de defecto que ya se vio dos veces en este
 * repositorio: `.nx-stat-grid` existió un año sin cablear
 * (`nx-stat-grid-cableada.test.ts`), y el FlowRail podía quedar como
 * componente huérfano si `layout.tsx` no lo montaba
 * (`v15-flow-rail-cableado.test.ts`). Aquí el riesgo tiene una segunda cara,
 * más cara clínicamente: que alguien, al construir la vista previa de Hoy,
 * vuelva a consultar Firestore por su cuenta en vez de reusar `tareasVivas()`
 * — eso duplicaría la fuente de verdad de una tarea clínica, exactamente lo
 * que la carta operativa prohíbe («Nunca duplicar la fuente de verdad de una
 * entidad clínica»). Dos consultas independientes a la misma colección pueden
 * desincronizarse en cuanto una de las dos le agregue un filtro que la otra no
 * tenga, y ahí un resultado crítico aparece en una pantalla y no en la otra.
 *
 * ── LO QUE VERIFICA ──────────────────────────────────────────────────────────
 *
 * 1. `dashboard/page.tsx` importa y renderiza `<ContinuidadPanel />` — no
 *    quedó escrito y sin conectar.
 * 2. Aparece DESPUÉS de «Agenda de hoy» en el orden de la pantalla — la
 *    urgencia real: lo que pasa hoy antes que lo que ya viene arrastrándose.
 * 3. `ContinuidadPanel.tsx` importa `tareasVivas` de
 *    `@/lib/tareas-clinicas/firestore` — la misma función que usa
 *    `pendientes/page.tsx` — y no declara su propia consulta a
 *    `tareas_clinicas` con `collection(`/`query(`. Una segunda fuente sería el
 *    defecto que esta prueba existe para atrapar.
 * 4. Enlaza a `/pendientes` («Ver todo»): la vista previa no es un callejón
 *    sin salida hacia el worklist completo.
 *
 * Probado al revés: si `ContinuidadPanel` se declarara pero no se importara
 * en `dashboard/page.tsx`, el caso 1 falla. Si alguien reemplazara el import
 * de `tareasVivas` por un `query(collection(db, 'clinics', ..., 'tareas_clinicas'))`
 * directo dentro del panel, el caso 3 falla nombrando la duplicación.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * · No verifica el orden real (`ordenWorklist`) ni el filtro de escalamiento
 *   (`debeEscalar`) — eso ya lo prueba `tareas-clinicas-modelo.test.ts` sobre
 *   las mismas funciones puras, y este panel no las reimplementa.
 * · No renderiza el componente con Firestore simulado: es un análisis
 *   estático de fuente, como su hermano `v15-flow-rail-cableado.test.ts`. La
 *   verificación en navegador real queda para el arnés de capturas de esta
 *   fase.
 * · No cubre la zona PREPARED BY NEXUS: esta corrida la deja declarada y sin
 *   construir a propósito (ver comentario de cabecera de `dashboard/page.tsx`).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const DASHBOARD = leer('src/app/(dashboard)/dashboard/page.tsx')
const CONTINUIDAD = leer('src/components/ContinuidadPanel.tsx')

describe('V15-TODAY-001 — ContinuidadPanel conectado en /dashboard, no huérfano', () => {
  it('dashboard/page.tsx importa ContinuidadPanel', () => {
    expect(DASHBOARD).toContain("import { ContinuidadPanel } from '@/components/ContinuidadPanel'")
  })

  it('dashboard/page.tsx lo renderiza', () => {
    expect(DASHBOARD).toMatch(/<ContinuidadPanel\s*\/>/)
  })

  it('CONTINUITY va después de TODAY — lo de hoy antes que lo arrastrado', () => {
    const agenda = DASHBOARD.indexOf('Agenda de hoy')
    const continuidad = DASHBOARD.indexOf('<ContinuidadPanel')
    expect(agenda).toBeGreaterThan(-1)
    expect(continuidad).toBeGreaterThan(-1)
    expect(agenda, 'CONTINUITY quedó antes que la agenda del día').toBeLessThan(continuidad)
  })
})

describe('V15-TODAY-001 — CONTINUITY reusa tareasVivas(), no abre una fuente de verdad propia', () => {
  it('importa tareasVivas de la misma librería que /pendientes', () => {
    expect(CONTINUIDAD).toContain("import { tareasVivas } from '@/lib/tareas-clinicas/firestore'")
  })

  it('no declara su propia consulta a Firestore sobre tareas_clinicas', () => {
    expect(CONTINUIDAD).not.toMatch(/collection\(\s*db,\s*['"]clinics['"]/)
    expect(CONTINUIDAD).not.toMatch(/['"]tareas_clinicas['"]/)
  })

  it('enlaza al worklist completo en /pendientes', () => {
    expect(CONTINUIDAD).toContain('href="/pendientes"')
  })
})
