/**
 * GOLDEN PATH 9 — reintentar «Agendar» no crea otra cita ni otra bitácora.
 *
 * La transacción ya serializaba el día para impedir dos reservas concurrentes,
 * pero un reintento idéntico después de que el primer commit perdiera su respuesta
 * veía SU PROPIA cita como conflicto y devolvía 409. Peor: si el caller volvía a
 * intentar por otra vía podía terminar fabricando otra identidad para la misma
 * intención. La regla es más fuerte: misma solicitud activa → mismo id.
 *
 * Estos checks fijan la arquitectura de la reparación sin abrir una excepción al
 * conflicto real: sólo una coincidencia exacta de todos los campos permitidos por
 * esta vía se reconoce como reintento. Una cita cancelada/reagendada/no-asistió no
 * se reutiliza y un solape distinto sigue entrando al detector de conflicto.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ruta = readFileSync(join(process.cwd(), 'src/app/api/appointments/route.ts'), 'utf8')

describe('GP9 — alta/reagenda de cita idempotente', () => {
  it('define igualdad sobre la allowlist completa, no sólo hora/paciente', () => {
    expect(ruta).toContain('const mismaSolicitud = (actual: Record<string, unknown>) =>')
    expect(ruta).toContain('CAMPOS_CITA.every((k) => (actual[k] ?? null) === (limpia[k] ?? null))')
  })

  it('un alta idéntica activa devuelve el mismo id antes de tratarla como conflicto', () => {
    const detecta = ruta.indexOf('if (!reagendarId && mismaSolicitud(a as Record<string, unknown>))')
    const responde = ruta.indexOf('if (altaYaExistente)')
    const conflicto = ruta.indexOf('if (conflicto && !quiereSobreagendar) throw CONFLICTO')
    expect(detecta).toBeGreaterThan(0)
    expect(responde).toBeGreaterThan(detecta)
    expect(conflicto).toBeGreaterThan(responde)
    expect(ruta).toContain('id = altaYaExistente')
    expect(ruta).toContain('reintentoIdempotente = true')
  })

  it('no resucita una cita liberada como si fuera el mismo intento', () => {
    const libera = ruta.indexOf("if (['cancelada', 'reagendada', 'no-asistio'].includes(a.estado)) return")
    const igual = ruta.indexOf('if (!reagendarId && mismaSolicitud(a as Record<string, unknown>))')
    expect(libera).toBeGreaterThan(0)
    expect(igual).toBeGreaterThan(libera)
  })

  it('un reintento de edición que ya quedó aplicado no vuelve a escribir', () => {
    expect(ruta).toContain('if (antes && mismaSolicitud(antes))')
    const rama = ruta.slice(ruta.indexOf('if (antes && mismaSolicitud(antes))'))
    const hastaWrite = rama.slice(0, rama.indexOf('tx.set(diaRef'))
    expect(hastaWrite).toContain('reintentoIdempotente = true')
    expect(hastaWrite).toContain('return')
  })

  it('un reintento no duplica la entrada de audit_log', () => {
    expect(ruta).toContain('if (!reintentoIdempotente) {')
    const guard = ruta.indexOf('if (!reintentoIdempotente) {')
    const audit = ruta.indexOf("collection('audit_log').add({")
    expect(audit).toBeGreaterThan(guard)
  })

  it('la respuesta declara cuándo convergió a una operación previa', () => {
    expect(ruta).toContain('idempotent: reintentoIdempotente')
  })
})
