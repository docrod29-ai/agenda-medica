/**
 * V15-RESULTS-CLOSURE-001 (Fase 6) — primera rebanada: `ProgresoResultado`
 * está CONECTADO en `/pendientes`, sólo para tareas que son un resultado, y
 * sin abrir una segunda fuente de verdad.
 *
 * ── QUÉ PROTEGE ──────────────────────────────────────────────────────────────
 *
 * §9 del master loop pide que un resultado se vea como cola de ocho etapas,
 * «no una tabla estática». `/pendientes/page.tsx` ya era una cola (agrupa por
 * escalamiento), pero cada tarjeta sólo mostraba UN botón de "siguiente paso"
 * — sin distinguir dónde, de las ocho etapas de §9, está realmente un
 * resultado. Mismo riesgo que ya cazaron `nx-stat-grid-cableada.test.ts` y
 * `v15-flow-rail-cableado.test.ts`: un componente que existe en su propio
 * archivo pero nadie lo importa no cambia nada para el médico.
 *
 * ── LO QUE VERIFICA ──────────────────────────────────────────────────────────
 *
 * 1. `pendientes/page.tsx` importa `ProgresoResultado` y `esTareaDeResultado`,
 *    y los usa juntos (la pista sólo se pinta cuando el tipo es un resultado
 *    de verdad — nunca para seguimiento/receta/reconciliación/otra).
 * 2. `ProgresoResultado.tsx` NO declara su propia consulta a Firestore ni
 *    reimplementa la lógica de estado: delega en `progresoResultado()` de
 *    `@/lib/tareas-clinicas/progreso-resultado`, el módulo puro ya probado en
 *    `progreso-resultado.test.ts`. Duplicar esa lógica dentro del componente
 *    sería la MISMA clase de defecto que `ContinuidadPanel` ya evitó con
 *    `tareasVivas()`.
 * 3. La pista recibe `estado`/`ownerUid`/`prioridad` — los MISMOS campos de la
 *    `TareaClinica` que ya carga `tareasVivas()` en esta página, no una
 *    lectura nueva.
 *
 * ── PROBADO AL REVÉS ─────────────────────────────────────────────────────────
 *
 * Verificado contra el árbol previo a este cambio (`git stash`): el caso 1
 * falla (no existía el import), y el caso "sólo para tipos de resultado"
 * falla porque `esTareaDeResultado` no existía en absoluto.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * · No verifica el DOM real ni accesibilidad — eso es el arnés de capturas de
 *   esta rebanada (`scripts/design/capturar-progreso-resultado-v15.mjs`).
 * · No cubre `PanelLaboratorios.tsx`: sigue siendo la "tabla estática" que
 *   §9 nombra como el patrón a evitar, sin ningún enlace hacia
 *   `tareas_clinicas`. Investigado y diferido deliberadamente esta corrida —
 *   ver `agent-state/V15_CURRENT_ITERATION.md`, no es un olvido.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const PENDIENTES = leer('src/app/(dashboard)/pendientes/page.tsx')
const PROGRESO_UI = leer('src/components/tareas/ProgresoResultado.tsx')

describe('V15-RESULTS-CLOSURE-001 — ProgresoResultado conectado en /pendientes, no huérfano', () => {
  it('pendientes/page.tsx importa ProgresoResultado', () => {
    expect(PENDIENTES).toContain("import { ProgresoResultado } from '@/components/tareas/ProgresoResultado'")
  })

  it('pendientes/page.tsx importa esTareaDeResultado', () => {
    expect(PENDIENTES).toContain("import { esTareaDeResultado } from '@/lib/tareas-clinicas/progreso-resultado'")
  })

  it('la pista sólo se pinta detrás de la compuerta esTareaDeResultado(t.tipo)', () => {
    expect(PENDIENTES).toMatch(/esTareaDeResultado\(t\.tipo\)\s*&&\s*\(\s*<ProgresoResultado/)
  })

  it('recibe estado/ownerUid/prioridad de la misma tarea que ya carga la página', () => {
    expect(PENDIENTES).toMatch(/<ProgresoResultado\s+estado=\{t\.estado\}\s+ownerUid=\{t\.ownerUid\}\s+prioridad=\{t\.prioridad\}\s*\/>/)
  })
})

describe('V15-RESULTS-CLOSURE-001 — ProgresoResultado.tsx delega en el módulo puro, no duplica la lógica', () => {
  it('importa progresoResultado del módulo puro', () => {
    expect(PROGRESO_UI).toContain("import { progresoResultado")
    expect(PROGRESO_UI).toContain("@/lib/tareas-clinicas/progreso-resultado")
  })

  it('no abre su propia consulta a Firestore', () => {
    expect(PROGRESO_UI).not.toMatch(/collection\(\s*db,/)
    expect(PROGRESO_UI).not.toMatch(/getDocs\(/)
    expect(PROGRESO_UI).not.toContain('tareas_clinicas')
  })

  it('no reimplementa las transiciones de estado (nada de TRANSICIONES/puedeTransicionar aquí)', () => {
    expect(PROGRESO_UI).not.toContain('puedeTransicionar')
    expect(PROGRESO_UI).not.toContain('TRANSICIONES')
  })
})
