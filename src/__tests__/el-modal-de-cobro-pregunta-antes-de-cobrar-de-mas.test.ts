/**
 * EL MODAL DE COBRO PREGUNTA ANTES DE COBRAR DE MÁS, NOMBRA AL OPERADOR SIN
 * SU CORREO, Y CADA CAMPO TIENE ETIQUETA.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * · ASC-010 (P2): el importe se teclea a mano y no había freno de magnitud:
 *   $8,000 por una consulta de $800 pasaba igual.
 * · ASC-015 (P3): el nombre sellado al autorizar una cortesía caía al CORREO
 *   cuando la cuenta no tenía displayName, y el corte lo imprimía.
 * · ASC-011 (P2): importe, descripción, notas, motivo de cortesía y los tres
 *   `<select>` eran `<label>` sin `htmlFor` e inputs sin `id`: sin nombre
 *   accesible (mínimo del sistema de diseño).
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Panel de Lujo 2026-09, auditor AS-cobros; el equipo rojo buscó cota o
 * confirmación en modal, lib y reglas (ninguna), comprobó que `quienAnulo` ya
 * resolvía nombres sin correo para las anulaciones, y contó los `<select>`
 * sin nombre que el auditor no había listado.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * Se pregunta, no se bloquea (un cobro grande legítimo existe). El umbral
 * 2×/0.5× es política del dueño aplicada por omisión, en un solo módulo. El
 * correo no es un nombre. `<label htmlFor>` ↔ `id` en todo control.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * Pura sobre `desvioDeImporte` y `nombreDelOperador`; contrato textual sobre
 * `CobrarModal.tsx` para las etiquetas (no hay testing-library en la suite) y
 * para que el modal pase por las dos funciones.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No renderiza el modal ni recorre el diálogo de confirmación. No hay tope
 * absoluto por consultorio validado en reglas (decisión abierta del dueño).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { desvioDeImporte } from '@/lib/finanzas/desvio-de-importe'
import { nombreDelOperador } from '@/lib/finanzas/nombre-del-operador'

const MODAL = readFileSync(join(process.cwd(), 'src/components/CobrarModal.tsx'), 'utf8')

describe('ASC-010 · desvioDeImporte', () => {
  it('$8,000 por una consulta de $800 pregunta, y la pregunta dice las dos cifras', () => {
    const d = desvioDeImporte(800, 8000)
    expect(d.preguntar).toBe(true)
    expect(d.veces).toBe(10)
    expect(d.pregunta).toMatch(/8,000/)
    expect(d.pregunta).toMatch(/800/)
  })
  it('$80 por una consulta de $800 también pregunta y sugiere el abono', () => {
    const d = desvioDeImporte(800, 80)
    expect(d.preguntar).toBe(true)
    expect(d.pregunta).toMatch(/Abono a saldo/)
  })
  it('dentro del margen (hasta 2× y desde 0.5×) no pregunta', () => {
    expect(desvioDeImporte(800, 800).preguntar).toBe(false)
    expect(desvioDeImporte(800, 1600).preguntar).toBe(false)
    expect(desvioDeImporte(800, 400).preguntar).toBe(false)
    expect(desvioDeImporte(800, 1200).preguntar).toBe(false)
  })
  it('sin precio de lista no hay contra qué comparar: no pregunta (preguntar siempre = no preguntar)', () => {
    expect(desvioDeImporte(undefined, 8000).preguntar).toBe(false)
    expect(desvioDeImporte(0, 8000).preguntar).toBe(false)
    expect(desvioDeImporte(null, 8000).preguntar).toBe(false)
  })
  it('el umbral se puede cambiar en un solo sitio', () => {
    expect(desvioDeImporte(800, 1700, 3).preguntar).toBe(false)
    expect(desvioDeImporte(800, 1700, 2).preguntar).toBe(true)
  })
  it('el modal pasa por la pregunta antes de registrar', () => {
    expect(MODAL).toMatch(/desvioDeImporte\(prefill\?\.monto, n\)/)
    expect(MODAL.indexOf('desvioDeImporte(prefill?.monto, n)')).toBeLessThan(MODAL.indexOf('registrarCobroDetallado(clinicId, datos'))
  })
})

describe('ASC-015 · nombreDelOperador nunca es un correo', () => {
  it('displayName primero', () => {
    expect(nombreDelOperador({ uid: 'u1', displayName: 'Ana', email: 'ana@sintetico.test' })).toBe('Ana')
  })
  it('sin displayName, el nombre del equipo por uid', () => {
    expect(nombreDelOperador({ uid: 'u1', email: 'x@sintetico.test' }, [{ uid: 'u1', nombre: 'Dra. Sintética' }])).toBe('Dra. Sintética')
  })
  it('o por correo, si el equipo lo tiene registrado (pero se devuelve el NOMBRE)', () => {
    expect(nombreDelOperador({ uid: 'u9', email: 'Ana@Sintetico.test' }, [{ email: 'ana@sintetico.test', nombre: 'Ana R.' }])).toBe('Ana R.')
  })
  it('sin nada que traduzca, «usuario xxxxxx…» — jamás el correo', () => {
    const n = nombreDelOperador({ uid: 'abcdef123456', email: 'demo@sintetico.test' })
    expect(n).toBe('usuario abcdef…')
    expect(n).not.toMatch(/@/)
  })
  it('el modal ya no sella `displayName || email`', () => {
    expect(MODAL).not.toMatch(/displayName \|\| auth\.currentUser\?\.email/)
    expect(MODAL).toMatch(/nombreDelOperador\(/)
  })
})

describe('ASC-011 · cada campo del modal tiene etiqueta asociada', () => {
  const labels = [...MODAL.matchAll(/<label[^>]*>/g)].map(m => m[0])
  it('hay etiquetas, y todas llevan htmlFor', () => {
    expect(labels.length).toBeGreaterThanOrEqual(8)
    for (const l of labels) expect(l, l).toMatch(/htmlFor="cobro-[a-z-]+"/)
  })
  it('cada htmlFor apunta a un id que existe en un input, select o textarea', () => {
    const ids = [...MODAL.matchAll(/htmlFor="([^"]+)"/g)].map(m => m[1])
    for (const id of ids) {
      expect(MODAL, `falta el control con id="${id}"`).toMatch(new RegExp(`<(input|select|textarea)[^>]*\\bid="${id}"`, 's'))
    }
    // Los tres <select> que el auditor no había contado.
    for (const id of ['cobro-medico', 'cobro-concepto', 'cobro-metodo']) expect(ids).toContain(id)
  })
  it('probado al revés: un <label> sin htmlFor haría fallar el guardián', () => {
    const roto = MODAL.replace('htmlFor="cobro-monto"', '')
    const sinFor = [...roto.matchAll(/<label[^>]*>/g)].map(m => m[0]).filter(l => !/htmlFor=/.test(l))
    expect(sinFor).toHaveLength(1)
  })
})
