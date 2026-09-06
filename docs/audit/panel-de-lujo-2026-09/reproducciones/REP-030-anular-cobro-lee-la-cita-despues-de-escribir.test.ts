/**
 * REP-030 · ASC-001 (AS-cobros, P0) — anular un cobro ligado a una cita falla
 * SIEMPRE: la transacción escribe el cobro y DESPUÉS lee la cita, y el SDK de
 * Firestore rechaza toda transacción que lea tras escribir.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * `src/lib/cobros.ts:437` abre `runTransaction`; `:441` hace `tx.update(cobroRef,
 * …)` de forma incondicional; `:467` hace `await tx.get(citaRef)` cuando el cobro
 * lleva `citaId`. El SDK lanza `FirestoreError(invalid-argument, «Firestore
 * transactions require all reads to be executed before all writes.»)`. En vivo:
 * Finanzas → Anular → motivo → «Anular cobro» → toast rojo con ese texto, el
 * diálogo se queda abierto y el cobro sigue vivo en el corte. `allow delete: if
 * false` (firestore.rules:982) cierra cualquier otra vía: un cobro equivocado
 * no se puede corregir.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor AS-cobros, hallazgo ASC-001 (`crudos/AS-cobros.json`). El equipo rojo
 * (`crudos/R-AS-cobros.json`) leyó la transacción completa, no encontró rama que
 * evite la escritura previa, citó la línea del SDK que lanza y SUBIÓ a P0: el
 * fallo es determinista para todo cobro con cita y el único llamador es
 * `finanzas/page.tsx:635`. `quien-anulo.test.ts` es puro y nunca ejecuta
 * `cancelarCobro`.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * La lectura de la cita se añadió DENTRO del `if (citaId)` —para no liberar una
 * cita que otro cobro tenía tomada— después de la escritura del cobro, y nada
 * ejercitaba la transacción. El comentario de `registrarCobro` (:322) sí conoce
 * la regla («Se lee ANTES de cualquier escritura (Firestore lo exige)»);
 * `cancelarCobro` no la siguió.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * el-dato-tiene-que-llegar: una prueba pura del texto no comprueba que el
 * destinatario (el SDK) acepte la operación. testing-gates: el guardián se
 * prueba al revés.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO sobre el motor real `cancelarCobro`, con `firebase/firestore`
 * doblado por una transacción en memoria que impone la MISMA regla del SDK:
 * `get` después de `update`/`set` lanza el mismo mensaje. El doble se prueba
 * al revés en el primer caso.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No ejecuta las reglas de Firestore (eso es REP-031: el cobro SIN cita cae por
 * `permission-denied`, no por el orden). No comprueba que anular deje asiento en
 * `logAudit`. No cubre el texto del toast (traducir el error del SDK).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const MENSAJE_SDK = 'Firestore transactions require all reads to be executed before all writes.'

const { docs, escrituras } = vi.hoisted(() => ({
  docs: {} as Record<string, Record<string, unknown>>,
  escrituras: [] as { path: string; op: string; d: Record<string, unknown> }[],
}))

vi.mock('@/lib/firebase', () => ({ db: { __doble: 'db' }, auth: { currentUser: { uid: 'u1' } } }))

/* ── Doble de `firebase/firestore`: documentos en `docs`, y una transacción que
 * aplica la regla del SDK (todas las lecturas antes de todas las escrituras). ── */
vi.mock('firebase/firestore', () => {
  let n = 0
  type Ref = { __tipo: 'doc' | 'col'; path: string; id: string }
  const collection = (_db: unknown, ...segs: string[]): Ref => ({ __tipo: 'col', path: segs.join('/'), id: segs[segs.length - 1] })
  const doc = (base: unknown, ...segs: string[]): Ref => {
    const b = base as Ref
    if (b && b.__tipo === 'col') { const id = segs[0] ?? `auto_${++n}`; return { __tipo: 'doc', path: `${b.path}/${id}`, id } }
    return { __tipo: 'doc', path: segs.join('/'), id: segs[segs.length - 1] }
  }
  const snap = (ref: Ref) => ({ exists: () => ref.path in docs, data: () => docs[ref.path], id: ref.id, ref })
  const escribir = (op: string, ref: Ref, d: Record<string, unknown>) => {
    escrituras.push({ path: ref.path, op, d })
    docs[ref.path] = op === 'set' ? { ...d } : { ...(docs[ref.path] ?? {}), ...d }
  }
  const runTransaction = async (_db: unknown, fn: (tx: unknown) => Promise<unknown>) => {
    let yaEscribio = false
    const tx = {
      get: async (ref: Ref) => {
        if (yaEscribio) { const e = new Error(MENSAJE_SDK) as Error & { code: string }; e.code = 'invalid-argument'; throw e }
        return snap(ref)
      },
      update: (ref: Ref, d: Record<string, unknown>) => { yaEscribio = true; escribir('update', ref, d) },
      set: (ref: Ref, d: Record<string, unknown>) => { yaEscribio = true; escribir('set', ref, d) },
      delete: (ref: Ref) => { yaEscribio = true; delete docs[ref.path] },
    }
    return fn(tx)
  }
  return {
    collection, doc, runTransaction,
    updateDoc: async (ref: Ref, d: Record<string, unknown>) => escribir('update', ref, d),
    addDoc: async (col: Ref, d: Record<string, unknown>) => { const r = doc(col); escribir('set', r, d); return r },
    getDocs: async () => ({ docs: [], empty: true, size: 0 }),
    query: (c: unknown) => c, where: () => ({}), orderBy: () => ({}),
  }
})

import { cancelarCobro, registrarCobro } from '@/lib/cobros'

const ISO = '2026-09-06T15:00:00.000Z'
const cobroBase = { monto: 1200, metodo: 'efectivo', concepto: 'consulta', fecha: ISO, creadoPor: 'u1', cancelado: false }

describe('REP-030 · anular un cobro con cita no puede lanzar por el orden de la transacción', () => {
  beforeEach(() => {
    for (const k of Object.keys(docs)) delete docs[k]
    escrituras.length = 0
  })

  it('probado al revés: el doble rechaza un get después de un update, como el SDK', async () => {
    const { runTransaction, doc } = await import('firebase/firestore')
    const r = doc({ __doble: 'db' } as never, 'clinics', 'C', 'cobros', 'x')
    docs['clinics/C/cobros/x'] = { ...cobroBase }
    await expect(runTransaction({} as never, async (tx) => {
      tx.update(r, { a: 1 })
      await tx.get(r)
    })).rejects.toThrow(MENSAJE_SDK)
  })

  it('control: un cobro SIN cita se anula (el doble no estorba)', async () => {
    docs['clinics/C/cobros/suelto'] = { ...cobroBase, monto: 350 }
    await expect(cancelarCobro('C', 'suelto', 'captura duplicada', 'u1', 'Ana')).resolves.toBeUndefined()
    const anulacion = escrituras.find(e => e.path === 'clinics/C/cobros/suelto')
    expect(anulacion?.d).toMatchObject({ cancelado: true, canceladoPor: 'u1', motivoCancelacion: 'captura duplicada' })
  })

  it('control: registrarCobro con cita SÍ respeta el orden (lee antes de escribir) — es el modelo', async () => {
    docs['clinics/C/appointments/A0'] = { estado: 'atendida' }
    await expect(registrarCobro('C', {
      citaId: 'A0', patientId: 'P1', pacienteNombre: 'Paciente Sintético',
      monto: 800, metodo: 'efectivo', concepto: 'consulta',
    } as never)).resolves.toBeTypeOf('string')
    expect(docs['clinics/C/appointments/A0'].cobroId).toBeTruthy()
  })

  it('HOY FALLA: anular un cobro CON cita no lanza y libera la cita', async () => {
    docs['clinics/C/cobros/cb1'] = { ...cobroBase, citaId: 'A1', patientId: 'P1' }
    docs['clinics/C/appointments/A1'] = { estado: 'atendida', cobroId: 'cb1', cobradoEn: ISO }

    await expect(cancelarCobro('C', 'cb1', 'se cobró dos veces', 'u1', 'Ana')).resolves.toBeUndefined()

    expect(docs['clinics/C/cobros/cb1']).toMatchObject({ cancelado: true, canceladoPor: 'u1' })
    expect(docs['clinics/C/appointments/A1'].cobroId, 'la cita debe quedar liberada').toBe('')
  })
})
