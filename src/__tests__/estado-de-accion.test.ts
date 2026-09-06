/**
 * `estadoDeAccion()` (src/lib/tareas-clinicas/estado-de-accion.ts) —
 * V15-FOLLOWUP-WORK-001 (Fase 7, §10).
 *
 * QUÉ FALLABA: `/pendientes` sólo distinguía «requiere atención»/«abiertos» —
 * un binario, no las categorías de acción que pide §10 (needs review /
 * waiting on result / needs scheduling / waiting on patient / overdue).
 *
 * CÓMO SE DESCUBRIÓ: al releer §10 contra el código real de
 * `pendientes/page.tsx` para decidir la siguiente rebanada de V15 tras cerrar
 * Fase 6 (Resultados/Cierre) — mismo método de medición que usó
 * `V15-ENCOUNTER-MODE-001` con la tabla de 9 comportamientos de §8.
 *
 * CAUSA RAÍZ: el modelo (`TareaClinica`) siempre tuvo suficiente señal
 * (`tipo`, `estado`, `venceEn`) para derivar 5 de las 8 categorías de §10 sin
 * ningún campo nuevo — sólo no existía la función que las derivara.
 *
 * LA REGLA QUE LO HACE SEGURO: cada categoría exige una condición real y
 * documentada (ver cabecera del módulo); nada se reparte por adivinanza entre
 * las 8 de §10 sólo para llenar la lista — lo que no tiene señal cae en
 * `otros`, declarado.
 *
 * QUÉ NO CUBRE: `cerrada_reciente` (closed recently) — `tareasVivas()` nunca
 * trae tareas cerradas, así que esta función ni la considera; es la
 * rebanada siguiente, con su propia lectura a Firestore. Tampoco decide qué
 * mostrar en pantalla — sólo clasifica una tarea, una vez. El cableado en
 * `/pendientes` se prueba aparte, en
 * `v15-pendientes-agrupa-por-estado-de-accion.test.ts`.
 */
import { describe, it, expect } from 'vitest'
import { estadoDeAccion, ORDEN_ESTADO_DE_ACCION, ETIQUETA_ESTADO_DE_ACCION } from '@/lib/tareas-clinicas/estado-de-accion'
import type { TareaClinica } from '@/lib/tareas-clinicas/modelo'

const AHORA = Date.parse('2026-08-11T12:00:00Z')
const AYER = new Date(AHORA - 86_400_000).toISOString()
const MANANA = new Date(AHORA + 86_400_000).toISOString()

function tarea(over: Partial<TareaClinica>): Pick<TareaClinica, 'estado' | 'tipo' | 'venceEn'> {
  return { estado: 'solicitada', tipo: 'otra', venceEn: MANANA, ...over }
}

describe('estadoDeAccion — una tarea, un grupo, con motivo', () => {
  it('vencida gana sobre cualquier otra señal, incluso sobre "necesita revisión"', () => {
    expect(estadoDeAccion(tarea({ tipo: 'resultado_por_revisar', venceEn: AYER }), AHORA)).toBe('vencida')
  })

  it('un estudio pendiente vencido es vencida, no "esperando resultado"', () => {
    expect(estadoDeAccion(tarea({ tipo: 'estudio_pendiente', venceEn: AYER }), AHORA)).toBe('vencida')
  })

  it('resultado_por_revisar vivo (sin vencer) es necesita_revision', () => {
    expect(estadoDeAccion(tarea({ tipo: 'estudio_pendiente', estado: 'completada' }), AHORA)).toBe('necesita_revision')
    expect(estadoDeAccion(tarea({ tipo: 'resultado_por_revisar', estado: 'solicitada' }), AHORA)).toBe('necesita_revision')
  })

  it('estado completada de CUALQUIER tipo (no sólo resultado) es necesita_revision', () => {
    expect(estadoDeAccion(tarea({ tipo: 'seguimiento', estado: 'completada' }), AHORA)).toBe('necesita_revision')
  })

  it('estudio_pendiente vivo y sin completar es esperando_resultado', () => {
    expect(estadoDeAccion(tarea({ tipo: 'estudio_pendiente', estado: 'en_curso' }), AHORA)).toBe('esperando_resultado')
  })

  it('seguimiento vivo es necesita_agendar', () => {
    expect(estadoDeAccion(tarea({ tipo: 'seguimiento', estado: 'aceptada' }), AHORA)).toBe('necesita_agendar')
  })

  it('receta_por_entregar viva es esperando_paciente', () => {
    expect(estadoDeAccion(tarea({ tipo: 'receta_por_entregar', estado: 'solicitada' }), AHORA)).toBe('esperando_paciente')
  })

  it('reconciliacion_medicamento cae en otros — no se inventa una de las 8 categorías para ella', () => {
    expect(estadoDeAccion(tarea({ tipo: 'reconciliacion_medicamento' }), AHORA)).toBe('otros')
  })

  it('indicacion_paciente (sin productor real todavía) cae en otros', () => {
    expect(estadoDeAccion(tarea({ tipo: 'indicacion_paciente' }), AHORA)).toBe('otros')
  })

  it('otra cae en otros', () => {
    expect(estadoDeAccion(tarea({ tipo: 'otra' }), AHORA)).toBe('otros')
  })

  it('pregunta_paciente (REG-521) es necesita_revision: llegó de fuera y nadie la ha mirado, como un resultado', () => {
    expect(estadoDeAccion(tarea({ tipo: 'pregunta_paciente' }), AHORA)).toBe('necesita_revision')
    // Y si venció, vencida gana, como con todo lo demás.
    expect(estadoDeAccion(tarea({ tipo: 'pregunta_paciente', venceEn: AYER }), AHORA)).toBe('vencida')
  })

  it('ORDEN_ESTADO_DE_ACCION y ETIQUETA_ESTADO_DE_ACCION cubren exactamente las mismas seis claves', () => {
    const claves = Object.keys(ETIQUETA_ESTADO_DE_ACCION).sort()
    expect([...ORDEN_ESTADO_DE_ACCION].sort()).toEqual(claves)
    expect(claves).toHaveLength(6)
  })

  it('vencida encabeza el orden — lo más accionable primero, igual que el worklist ya prioriza escalación', () => {
    expect(ORDEN_ESTADO_DE_ACCION[0]).toBe('vencida')
  })
})
