import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { acotarMeta, TOPE_META } from '@/lib/expediente/meta-de-bitacora'
import { huellaImpreso } from '@/lib/expediente/huella-impreso'

/**
 * LA HUELLA DE LA RECETA LARGA NO SE PIERDE — REG-518.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `api/auditoria/registrar` acotaba `meta` cortando el JSON a 2 000 caracteres
 * y, si el resultado no parseaba, lo descartaba ENTERO (`meta = undefined`).
 * En `receta_generada` / `receta_descargada`, `meta` es `huellaImpreso`: el
 * folio, la lista de fármacos con dosis, el total y el hash — el único rastro
 * de qué decía el papel que se llevó el paciente (la receta se puede editar
 * después de firmar la nota, y lo editado no vuelve al expediente).
 *
 * Una receta con muchos renglones o con indicaciones largas pasaba del tope, y
 * el asiento quedaba con `meta: null` y respuesta `ok: true`. Se perdía el hash
 * justo en las recetas que más falta hace reconstruir, y sin ningún error.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditoría read-only de medicación del 5-sep-2026, siguiendo la huella desde
 * el botón de imprimir hasta Firestore. Verificado por el orquestador en la
 * ruta antes de tocarla.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Se acota POR CAMPO: primero lo corto (hash, folio, total), después las
 * listas elemento a elemento, y lo que no cabe se OMITE y se DECLARA en el
 * asiento (`_truncada`, `_camposOmitidos`). El resultado siempre es un objeto
 * válido dentro del tope y siempre dice si le falta algo. Un asiento que dice
 * «me recortaron 12 fármacos» es un asiento; `null` no.
 *
 * ── PROBADO AL REVÉS ─────────────────────────────────────────────────────────
 *
 * Con la ruta como estaba, el caso «EL CASO» escribía `meta: null` para la
 * receta larga. Con el arreglo, el hash y el folio están.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - No guarda la receta entera: la lista de fármacos sigue entrando hasta
 *   donde llega. Guardar el documento impreso completo es una decisión de
 *   producto mayor, declarada en `huella-impreso.ts`.
 * - No mira otros `meta` que no sean huellas; la regla es general y las pruebas
 *   la ejercitan con objetos anidados, pero el caso que importa es la receta.
 * - El hash sigue siendo FNV-1a de 32 bits: detecta diferencias, no resiste a
 *   un adversario. Eso no cambia aquí.
 */

describe('REG-518 · acotarMeta, la función pura', () => {
  it('lo que cabe se guarda tal cual, sin marcas', () => {
    const m = { hash: 'abcd1234', folio: 'F-1', total: 3, farmacos: ['a', 'b', 'c'] }
    expect(acotarMeta(m)).toBe(m)
  })

  it('lo que no es objeto no es meta', () => {
    expect(acotarMeta(undefined)).toBeUndefined()
    expect(acotarMeta('texto')).toBeUndefined()
    expect(acotarMeta([1, 2])).toBeUndefined()
    expect(acotarMeta(null)).toBeUndefined()
  })

  it('EL CASO: una huella larga conserva hash, folio y total, mete los fármacos que caben y declara los que no', () => {
    const farmacos = Array.from({ length: 80 }, (_, i) => `Fármaco ${i} 500 mg · vía oral · cada 8 horas · durante 10 días · con alimentos`)
    const m = { folio: 'F-2026-0001', farmacos, total: 80, hash: 'deadbeef' }
    expect(JSON.stringify(m).length).toBeGreaterThan(TOPE_META)
    const a = acotarMeta(m)!
    expect(a).toMatchObject({ folio: 'F-2026-0001', total: 80, hash: 'deadbeef', _truncada: true })
    expect(Array.isArray(a.farmacos)).toBe(true)
    expect((a.farmacos as string[]).length).toBeGreaterThan(0)
    expect((a.farmacos as string[]).length).toBeLessThan(80)
    expect((a.farmacos as string[])[0]).toBe(farmacos[0])
    expect(String((a._camposOmitidos as string[])[0])).toMatch(/^farmacos\[\d+…\]$/)
    expect(JSON.stringify(a).length).toBeLessThanOrEqual(TOPE_META)
  })

  it('una cadena larga se omite y se nombra; los objetos anidados también', () => {
    const a = acotarMeta({ hash: 'h', texto: 'x'.repeat(3000), anidado: { a: 1 } })!
    expect(a).toMatchObject({ hash: 'h', _truncada: true })
    expect(a).not.toHaveProperty('texto')
    expect(a).not.toHaveProperty('anidado')
    expect(a._camposOmitidos).toEqual(['texto', 'anidado'])
  })

  it('con un tope pequeño el resultado sigue siendo un objeto válido que cabe, con el hash dentro', () => {
    const a = acotarMeta({ hash: 'h', farmacos: ['x'.repeat(40), 'y'.repeat(40), 'z'.repeat(40)] }, 150)!
    expect(JSON.stringify(a).length).toBeLessThanOrEqual(150)
    expect(a._truncada).toBe(true)
    expect(a.hash).toBe('h')
    expect((a.farmacos as string[]).length).toBeLessThan(3)
  })

  it('la huella real de una receta larga cabe con su hash', () => {
    const meds = Array.from({ length: 40 }, (_, i) => ({
      nombre: `Medicamento sintético ${i}`, dosis: '500 mg', via: 'oral', frecuencia: 'cada 8 horas', duracion: '10 días',
    }))
    const h = huellaImpreso(meds as never, { folio: 'F-9', indicaciones: 'i'.repeat(500), diagnostico: 'dx' })
    const a = acotarMeta(h)!
    expect(a.hash).toBe(h.hash)
    expect(a.folio).toBe('F-9')
    expect(JSON.stringify(a).length).toBeLessThanOrEqual(TOPE_META)
  })
})

// ── La ruta, ejecutada ───────────────────────────────────────────────────────

vi.mock('@/lib/authz/verificar', () => ({
  verificarCapacidad: async (_req: unknown, clinicId: string) =>
    ({ ok: true, uid: 'uid-medico', email: 'dr@ejemplo.test', role: 'medico', clinicId }),
}))

const asientos: Record<string, unknown>[] = []
vi.mock('@/lib/firebase-admin', () => ({
  default: { firestore: { FieldValue: { serverTimestamp: () => 'SERVER_TS' } } },
  adminDb: {
    collection: () => ({
      doc: () => ({
        collection: (sub: string) => {
          if (sub !== 'audit_log') throw new Error(`subcolección inesperada: ${sub}`)
          return { add: async (d: Record<string, unknown>) => { asientos.push(d); return { id: 'a1' } } }
        },
      }),
    }),
  },
}))

import { POST } from '@/app/api/auditoria/registrar/route'

function peticion(body: unknown) {
  return new NextRequest('https://ejemplo.test/api/auditoria/registrar', {
    method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => { asientos.length = 0 })

describe('REG-518 · la ruta escribe la huella acotada, nunca null por larga', () => {
  it('EL CASO: receta_generada con 80 fármacos → el asiento lleva hash, folio y la marca de truncado', async () => {
    const farmacos = Array.from({ length: 80 }, (_, i) => `Fármaco ${i} 500 mg · vía oral · cada 8 horas · durante 10 días`)
    const r = await POST(peticion({
      evento: 'receta_generada', clinicId: 'clinica-ficticia', patientId: 'pac-1', notaId: 'nota-1',
      meta: { folio: 'F-1', farmacos, total: 80, hash: 'cafebabe' },
    }))
    expect(r.status).toBe(200)
    expect(asientos).toHaveLength(1)
    const meta = asientos[0].meta as Record<string, unknown>
    // Antes del arreglo: `meta` era null aquí.
    expect(meta).not.toBeNull()
    expect(meta).toMatchObject({ hash: 'cafebabe', folio: 'F-1', total: 80, _truncada: true })
    expect(JSON.stringify(meta).length).toBeLessThanOrEqual(TOPE_META)
  })

  it('una huella corta entra completa y sin marcas, como siempre', async () => {
    await POST(peticion({
      evento: 'receta_generada', clinicId: 'clinica-ficticia', patientId: 'pac-1', notaId: 'nota-1',
      meta: { folio: 'F-2', farmacos: ['Paracetamol 500 mg · oral · cada 8 h'], total: 1, hash: '01234567' },
    }))
    expect(asientos[0].meta).toEqual({ folio: 'F-2', farmacos: ['Paracetamol 500 mg · oral · cada 8 h'], total: 1, hash: '01234567' })
  })
})
