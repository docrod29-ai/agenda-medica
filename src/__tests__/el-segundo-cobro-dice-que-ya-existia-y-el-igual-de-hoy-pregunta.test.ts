/**
 * EL SEGUNDO COBRO DICE «YA EXISTÍA», EL IGUAL DE HOY PREGUNTA, Y LA CITA SE
 * MARCA EN LA MISMA ESCRITURA QUE EL COBRO.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * · ASC-009 (P2): con la cita ya cobrada desde otro dispositivo, el segundo
 *   intento devolvía el id del cobro existente y el modal decía «Cobro
 *   registrado: $X» con el importe tecleado, sin haber registrado nada, y
 *   reescribía `cobradoEn` con la hora del intento fallido.
 * · RT-005 (P2, ataque del equipo rojo): la clave de intento vive en UNA
 *   pestaña; desde dos pestañas o dos dispositivos, un abono y un cobro suelto
 *   con el mismo importe se registraban dos veces y el corte sumaba los dos.
 * · ASC-003 (P1): `cobroId`/`cobradoEn` los escribía el modal con un update
 *   suelto DESPUÉS del cobro — un update que cualquier miembro puede hacer con
 *   un `cobroId` inventado. La regla de `appointments` sólo puede exigir «el
 *   cobro existe en esta misma escritura» si viajan juntos.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Panel de Lujo 2026-09: auditor AS-cobros (ASC-003, ASC-009) y equipo rojo
 * (RT-005, verificado con salida literal). Ver `crudos/AS-cobros.json` y
 * `crudos/R-AS-cobros.json`.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * `registrarCobro` devolvía sólo un id: convergir y registrar eran
 * indistinguibles para el llamador. Y la intención se nombraba por pestaña, no
 * por lo que es igual desde cualquier sitio (cita/paciente + concepto +
 * importe + día).
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * clinical-safety §6 aplicado al dinero: ante la duda se PREGUNTA, no se
 * decide solo. Y «nada cambia en silencio»: si no se registró, se dice.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * Comportamiento sobre `registrarCobroDetallado` real, con `firebase/firestore`
 * doblado (documentos en memoria, transacción que impone «lecturas antes de
 * escrituras», `getDocs` que entiende `where(campo, '==', valor)`).
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No ejecuta las reglas de Firestore (la regla de `appointments` que exige el
 * cobro en la misma escritura es de SEGURIDAD; ver handoff-DINERO). No cubre
 * el diálogo del modal (`CobrarModal`), sólo lo que la lib le devuelve.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { docs, escrituras } = vi.hoisted(() => ({
  docs: {} as Record<string, Record<string, unknown>>,
  escrituras: [] as { path: string; op: string; d: Record<string, unknown> }[],
}))

vi.mock('@/lib/firebase', () => ({ db: { __doble: 'db' }, auth: { currentUser: { uid: 'u1', displayName: 'Ana' } } }))
vi.mock('@/lib/expediente/audit-log', () => ({ logAudit: async () => undefined, drenarCola: async () => undefined }))
vi.mock('@/lib/firestore', () => ({ getDoctors: async () => [] }))

vi.mock('firebase/firestore', () => {
  let n = 0
  type Ref = { __tipo: 'doc' | 'col'; path: string; id: string }
  type Q = { col: Ref; filtros: { campo: string; valor: unknown }[] }
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
        if (yaEscribio) throw Object.assign(new Error('Firestore transactions require all reads to be executed before all writes.'), { code: 'invalid-argument' })
        return snap(ref)
      },
      update: (ref: Ref, d: Record<string, unknown>) => { yaEscribio = true; escribir('update', ref, d) },
      set: (ref: Ref, d: Record<string, unknown>) => { yaEscribio = true; escribir('set', ref, d) },
    }
    return fn(tx)
  }
  const query = (col: Ref, ...filtros: { campo: string; valor: unknown }[]): Q => ({ col, filtros })
  const where = (campo: string, _op: string, valor: unknown) => ({ campo, valor })
  const getDocs = async (q: Q) => {
    const hijos = Object.entries(docs)
      .filter(([p]) => p.startsWith(`${q.col.path}/`) && !p.slice(q.col.path.length + 1).includes('/'))
      .filter(([, d]) => q.filtros.every(f => d[f.campo] === f.valor))
      .map(([p, d]) => ({ id: p.split('/').pop(), data: () => d }))
    return { docs: hijos, empty: hijos.length === 0, size: hijos.length }
  }
  return {
    collection, doc, runTransaction, query, where, getDocs,
    updateDoc: async (ref: Ref, d: Record<string, unknown>) => escribir('update', ref, d),
    addDoc: async (col: Ref, d: Record<string, unknown>) => { const r = doc(col); escribir('set', r, d); return r },
    orderBy: () => ({ campo: '__orderBy', valor: undefined }),
  }
})

import { registrarCobroDetallado, CobroPosiblementeDuplicado, huellaDeCobro } from '@/lib/cobros'

const base = { patientId: 'P1', patientNombre: 'Paciente Sintético', metodo: 'efectivo' as const, creadoPor: 'ignorado' }

beforeEach(() => {
  for (const k of Object.keys(docs)) delete docs[k]
  escrituras.length = 0
})

describe('ASC-009 · el resultado dice si de verdad se registró', () => {
  it('primer cobro de cierre: se registra y yaExistia=false', async () => {
    docs['clinics/C/appointments/A1'] = { estado: 'confirmada' }
    const r = await registrarCobroDetallado('C', { ...base, citaId: 'A1', monto: 800, concepto: 'consulta' }, { claveIdempotencia: 'k1' })
    expect(r.yaExistia).toBe(false)
    expect(docs[`clinics/C/cobros/${r.id}`]).toMatchObject({ monto: 800, tipo: 'PAYMENT', creadoPor: 'u1' })
  })

  it('la cita YA cobrada desde otro dispositivo: yaExistia=true, con el cobro existente, y NO se escribe nada', async () => {
    docs['clinics/C/cobros/cb-otro'] = { monto: 800, folio: 'CB-OTRO', fecha: '2026-09-06T15:00:00.000Z', tipo: 'PAYMENT' }
    docs['clinics/C/appointments/A1'] = { estado: 'atendida', cobroId: 'cb-otro', cobradoEn: '2026-09-06T15:00:00.000Z' }
    const r = await registrarCobroDetallado('C', { ...base, citaId: 'A1', monto: 8000, concepto: 'consulta' }, { claveIdempotencia: 'k-otra-pestana' })
    expect(r).toMatchObject({ id: 'cb-otro', yaExistia: true, porQue: 'cita-ya-cobrada' })
    expect(r.cobroExistente).toMatchObject({ id: 'cb-otro', monto: 800, folio: 'CB-OTRO' })
    expect(escrituras, 'un segundo intento no escribe ni el cobro ni la cita').toHaveLength(0)
    expect(docs['clinics/C/appointments/A1'].cobradoEn, 'cobradoEn no se reescribe con la hora del intento fallido').toBe('2026-09-06T15:00:00.000Z')
  })

  it('el mismo intento repetido (misma clave): yaExistia=true por mismo-intento', async () => {
    docs['clinics/C/appointments/A1'] = { estado: 'confirmada' }
    const a = await registrarCobroDetallado('C', { ...base, citaId: 'A1', monto: 800, concepto: 'consulta' }, { claveIdempotencia: 'k1' })
    docs['clinics/C/appointments/A1'] = { estado: 'confirmada' } // como si la marca no hubiera llegado
    const b = await registrarCobroDetallado('C', { ...base, citaId: 'A1', monto: 800, concepto: 'consulta' }, { claveIdempotencia: 'k1' })
    expect(b).toMatchObject({ id: a.id, yaExistia: true, porQue: 'mismo-intento' })
  })
})

describe('ASC-003 · la cita se marca DENTRO de la transacción del cobro', () => {
  it('cobro de cierre: cobroId, cobradoEn y estado atendida van en la misma transacción', async () => {
    docs['clinics/C/appointments/A1'] = { estado: 'confirmada' }
    const r = await registrarCobroDetallado('C', { ...base, citaId: 'A1', monto: 800, concepto: 'consulta' }, { claveIdempotencia: 'k1' })
    const cita = escrituras.find(e => e.path === 'clinics/C/appointments/A1')
    expect(cita?.d).toMatchObject({ cobroId: r.id, estado: 'atendida' })
    expect(String(cita?.d.cobradoEn)).toMatch(/^\d{4}-/)
    // El cobro y la marca son dos escrituras de la MISMA transacción: la
    // segunda no puede ir antes que la primera.
    expect(escrituras.map(e => e.op)).toEqual(['set', 'update'])
  })

  it('no retrocede un estado más avanzado (finalizada) a atendida', async () => {
    docs['clinics/C/appointments/A1'] = { estado: 'finalizada' }
    await registrarCobroDetallado('C', { ...base, citaId: 'A1', monto: 800, concepto: 'consulta' }, { claveIdempotencia: 'k1' })
    const cita = escrituras.find(e => e.path === 'clinics/C/appointments/A1')
    expect(cita?.d).not.toHaveProperty('estado')
    expect(cita?.d).toHaveProperty('cobroId')
  })

  it('un ABONO marca atendida pero NO reserva cobroId (la cita sigue por cobrar)', async () => {
    docs['clinics/C/appointments/A1'] = { estado: 'confirmada' }
    await registrarCobroDetallado('C', { ...base, citaId: 'A1', monto: 300, concepto: 'abono' }, { claveIdempotencia: 'k1' })
    const cita = escrituras.find(e => e.path === 'clinics/C/appointments/A1')
    expect(cita?.d).toEqual({ estado: 'atendida' })
  })
})

describe('RT-005 · un cobro igual de hoy desde otra pestaña PREGUNTA en vez de duplicar', () => {
  it('la huella es la misma desde cualquier dispositivo y distinta para otra intención', () => {
    const a = huellaDeCobro({ citaId: 'A1', concepto: 'abono', monto: 500, dia: '2026-09-06' })
    expect(huellaDeCobro({ citaId: 'A1', concepto: 'abono', monto: 500.0, dia: '2026-09-06' })).toBe(a)
    expect(huellaDeCobro({ citaId: 'A1', concepto: 'abono', monto: 500.01, dia: '2026-09-06' })).not.toBe(a)
    expect(huellaDeCobro({ citaId: 'A1', concepto: 'abono', monto: 500, dia: '2026-09-07' })).not.toBe(a)
    expect(huellaDeCobro({ citaId: 'A2', concepto: 'abono', monto: 500, dia: '2026-09-06' })).not.toBe(a)
    expect(huellaDeCobro({ patientId: 'P1', concepto: 'otro', monto: 500, dia: '2026-09-06' })).toMatch(/^pac:P1\|/)
    expect(huellaDeCobro({ concepto: 'otro', monto: 500, dia: '2026-09-06' })).toMatch(/^suelto\|/)
  })

  it('dos abonos iguales con claves DISTINTAS: el segundo lanza CobroPosiblementeDuplicado con el existente', async () => {
    docs['clinics/C/appointments/A1'] = { estado: 'atendida' }
    const abono = { ...base, citaId: 'A1', monto: 500, concepto: 'abono' as const }
    const a = await registrarCobroDetallado('C', abono, { claveIdempotencia: 'pestana-1' })
    await expect(registrarCobroDetallado('C', abono, { claveIdempotencia: 'pestana-2' }))
      .rejects.toBeInstanceOf(CobroPosiblementeDuplicado)
    try { await registrarCobroDetallado('C', abono, { claveIdempotencia: 'pestana-2' }) } catch (e) {
      expect((e as CobroPosiblementeDuplicado).existente.id).toBe(a.id)
      expect((e as CobroPosiblementeDuplicado).existente.monto).toBe(500)
      expect((e as CobroPosiblementeDuplicado).message).toMatch(/¿Es otro distinto\?/)
    }
    const cobros = Object.keys(docs).filter(p => p.startsWith('clinics/C/cobros/'))
    expect(cobros, 'sin confirmación, sigue habiendo UN solo abono').toHaveLength(1)
  })

  it('probado al revés: con «es otro distinto» confirmado, sí se registran dos', async () => {
    docs['clinics/C/appointments/A1'] = { estado: 'atendida' }
    const abono = { ...base, citaId: 'A1', monto: 500, concepto: 'abono' as const }
    await registrarCobroDetallado('C', abono, { claveIdempotencia: 'pestana-1' })
    const b = await registrarCobroDetallado('C', abono, { claveIdempotencia: 'pestana-2', esOtroDistinto: true })
    expect(b.yaExistia).toBe(false)
    expect(Object.keys(docs).filter(p => p.startsWith('clinics/C/cobros/'))).toHaveLength(2)
  })

  it('un cobro SUELTO igual de hoy también pregunta', async () => {
    const suelto = { ...base, monto: 350, concepto: 'otro' as const }
    await registrarCobroDetallado('C', suelto, { claveIdempotencia: 'k1' })
    await expect(registrarCobroDetallado('C', suelto, { claveIdempotencia: 'k2' })).rejects.toBeInstanceOf(CobroPosiblementeDuplicado)
  })

  it('un cobro igual pero ANULADO no cuenta: se puede volver a cobrar', async () => {
    const suelto = { ...base, monto: 350, concepto: 'otro' as const }
    const a = await registrarCobroDetallado('C', suelto, { claveIdempotencia: 'k1' })
    docs[`clinics/C/cobros/${a.id}`].cancelado = true
    const b = await registrarCobroDetallado('C', suelto, { claveIdempotencia: 'k2' })
    expect(b.yaExistia).toBe(false)
  })

  it('el cobro que SALDA una cita no pregunta: ya tiene su candado (cita.cobroId)', async () => {
    docs['clinics/C/appointments/A1'] = { estado: 'atendida' }
    docs['clinics/C/appointments/A2'] = { estado: 'atendida' }
    await registrarCobroDetallado('C', { ...base, citaId: 'A1', monto: 800, concepto: 'consulta' }, { claveIdempotencia: 'k1' })
    // Otra cita, mismo paciente, mismo importe, mismo día: es legítimo y no pregunta.
    const b = await registrarCobroDetallado('C', { ...base, citaId: 'A2', monto: 800, concepto: 'consulta' }, { claveIdempotencia: 'k2' })
    expect(b.yaExistia).toBe(false)
  })
})
