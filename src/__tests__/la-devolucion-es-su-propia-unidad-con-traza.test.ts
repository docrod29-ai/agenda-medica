/**
 * LA DEVOLUCIÓN ES SU PROPIA UNIDAD, CON TRAZA AL COBRO ORIGINAL.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * ASC-012 (P3, PL-D5): el concepto «Reembolso» y la fila `reembolsos` del corte
 * existían sin que nadie pudiera emitir uno: el selector lo filtraba, el monto
 * negativo se rechazaba en el origen (REG-015, con razón) y la única salida era
 * la anulación. `estado-cobro.ts` ya consumía `tipo: 'REFUND'`; el corte lo
 * prometía; nadie lo escribía.
 * ASC-016 (P3): «Por médico» en Finanzas omitía los cobros con `medicoId` pero
 * sin `medicoNombre`, mientras Comisiones los contaba: dos totales.
 * ASC-014 (P3): el CSV «para el contador» llevaba la fecha en UTC crudo, no
 * decía quién cobró ni el tipo, y excluía los anulados sin avisarlo.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Panel de Lujo 2026-09, auditor AS-cobros; el equipo rojo dejó ASC-012 en
 * «parcial» porque construir o retirar era decisión del dueño; la
 * recomendación por omisión (04-DECISIONES, PL-D5) es construirla.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * Un REFUND es un documento propio en `cobros`, monto POSITIVO (lo que salió),
 * `tipo: 'REFUND'`, `cobroOriginalId`; nunca un signo menos. `montoEfectivo`
 * es la ÚNICA definición del signo y la comparten corte, resumen y comisiones.
 * No se devuelve más de lo que entró. El original no se anula: se cobró y se
 * devolvió, y las dos cosas quedan.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No ejecuta reglas de Firestore (un REFUND pasa la regla de create tal cual:
 * `creadoPor == uid`, `monto >= 0`; la liberación de la cita necesita la regla
 * de SEGURIDAD del handoff). No cubre el botón «Devolver» de Finanzas. El
 * reembolso automático de Stripe se prueba en
 * `el-reembolso-del-anticipo-llega-al-libro-del-consultorio`.
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
    // El doble ignora la cota a propósito: lo que se prueba aquí es la REGLA de
    // negocio, y un tope que recortara los documentos escondería justo los casos
    // que estas pruebas montan. Que la cota exista lo vigila
    // `las-lecturas-sin-cota-solo-bajan.test.ts`; que no recorte de más, el
    // guardián de «más devoluciones de las que caben» de `cobros.ts`.
    limit: () => ({ campo: '__limit', valor: undefined }),
  }
})

import {
  registrarReembolso, montoEfectivo, agregarResumen, cobrosACSV, quienCobro, SIN_ATRIBUIR, type Cobro,
} from '@/lib/cobros'
import { corteDeCaja, embudoCobro } from '@/lib/corte-caja'
import { calcularComisiones } from '@/lib/comisiones'
import { situacionDeCobro } from '@/lib/finanzas/estado-cobro'

const cobro = (o: Partial<Cobro>): Cobro => ({
  fecha: '2026-09-06T21:32:00.000Z', dia: '2026-09-06', mes: '2026-09', monto: 0, metodo: 'efectivo',
  concepto: 'consulta', createdAt: '', creadoPor: 'u1', ...o,
})

beforeEach(() => {
  for (const k of Object.keys(docs)) delete docs[k]
  escrituras.length = 0
})

describe('registrarReembolso', () => {
  const original = { monto: 800, metodo: 'efectivo', concepto: 'consulta', tipo: 'PAYMENT', citaId: 'A1', patientId: 'P1', patientNombre: 'Paciente Sintético', medicoId: 'd1', medicoNombre: 'Dra. S', cancelado: false }

  it('escribe un documento REFUND con monto positivo y traza al original; el original no se toca', async () => {
    docs['clinics/C/cobros/cb1'] = { ...original }
    docs['clinics/C/appointments/A1'] = { estado: 'atendida', cobroId: 'cb1' }
    const id = await registrarReembolso('C', { cobroOriginalId: 'cb1', monto: 300, metodo: 'efectivo', motivo: 'se cobró de más', autorNombre: 'Ana' })
    const r = docs[`clinics/C/cobros/${id}`]
    expect(r).toMatchObject({ tipo: 'REFUND', cobroOriginalId: 'cb1', monto: 300, concepto: 'reembolso', motivoReembolso: 'se cobró de más', creadoPor: 'u1', creadoPorNombre: 'Ana', citaId: 'A1', patientId: 'P1', medicoId: 'd1', reembolsoTotal: false, cancelado: false })
    expect(String(r.folio)).toMatch(/^RB-/)
    expect(docs['clinics/C/cobros/cb1']).toEqual(original)
    // Parcial: la cita conserva su cobro.
    expect(docs['clinics/C/appointments/A1'].cobroId).toBe('cb1')
  })

  it('la devolución TOTAL libera la cita que ese cobro tenía tomada, en la misma transacción', async () => {
    docs['clinics/C/cobros/cb1'] = { ...original }
    docs['clinics/C/appointments/A1'] = { estado: 'atendida', cobroId: 'cb1', cobradoEn: 'x' }
    const id = await registrarReembolso('C', { cobroOriginalId: 'cb1', monto: 800, metodo: 'efectivo', motivo: 'paciente no atendido' })
    expect(docs[`clinics/C/cobros/${id}`].reembolsoTotal).toBe(true)
    expect(docs['clinics/C/appointments/A1']).toMatchObject({ cobroId: '', cobradoEn: '', reembolsoCobroId: id })
    expect(escrituras.map(e => e.op)).toEqual(['set', 'update'])
  })

  it('no se devuelve más de lo que entró (contando lo ya devuelto)', async () => {
    docs['clinics/C/cobros/cb1'] = { ...original }
    docs['clinics/C/cobros/rb0'] = { tipo: 'REFUND', cobroOriginalId: 'cb1', monto: 500, cancelado: false }
    await expect(registrarReembolso('C', { cobroOriginalId: 'cb1', monto: 301, metodo: 'efectivo', motivo: 'x' }))
      .rejects.toThrow(/quedan \$300/)
    await expect(registrarReembolso('C', { cobroOriginalId: 'cb1', monto: 300, metodo: 'efectivo', motivo: 'x' })).resolves.toBeTypeOf('string')
  })

  it('exige motivo, importe > 0, un original vivo y que sea un PAGO', async () => {
    docs['clinics/C/cobros/cb1'] = { ...original }
    await expect(registrarReembolso('C', { cobroOriginalId: 'cb1', monto: 100, metodo: 'efectivo', motivo: '  ' })).rejects.toThrow(/motivo/)
    await expect(registrarReembolso('C', { cobroOriginalId: 'cb1', monto: 0, metodo: 'efectivo', motivo: 'x' })).rejects.toThrow(/mayor que cero/)
    await expect(registrarReembolso('C', { cobroOriginalId: 'no-existe', monto: 100, metodo: 'efectivo', motivo: 'x' })).rejects.toThrow(/no existe/)
    docs['clinics/C/cobros/cb2'] = { ...original, cancelado: true }
    await expect(registrarReembolso('C', { cobroOriginalId: 'cb2', monto: 100, metodo: 'efectivo', motivo: 'x' })).rejects.toThrow(/anulado/)
    docs['clinics/C/cobros/rb1'] = { ...original, tipo: 'REFUND' }
    await expect(registrarReembolso('C', { cobroOriginalId: 'rb1', monto: 100, metodo: 'efectivo', motivo: 'x' })).rejects.toThrow(/no otra devolución/)
    expect(escrituras).toHaveLength(0)
  })

  it('es idempotente por clave de intento', async () => {
    docs['clinics/C/cobros/cb1'] = { ...original }
    const a = await registrarReembolso('C', { cobroOriginalId: 'cb1', monto: 100, metodo: 'efectivo', motivo: 'x' }, { claveIdempotencia: 'k' })
    const b = await registrarReembolso('C', { cobroOriginalId: 'cb1', monto: 100, metodo: 'efectivo', motivo: 'x' }, { claveIdempotencia: 'k' })
    expect(b).toBe(a)
    expect(escrituras.filter(e => e.op === 'set')).toHaveLength(1)
  })
})

describe('montoEfectivo: la única definición del signo', () => {
  it('un REFUND/CREDIT guardado en positivo resta; un PAYMENT suma; un negativo heredado resta', () => {
    expect(montoEfectivo({ monto: 300, tipo: 'REFUND' })).toBe(-300)
    expect(montoEfectivo({ monto: 300, tipo: 'CREDIT' })).toBe(-300)
    expect(montoEfectivo({ monto: 300, tipo: 'PAYMENT' })).toBe(300)
    expect(montoEfectivo({ monto: 300 })).toBe(300)
    expect(montoEfectivo({ monto: -200 })).toBe(-200)
  })

  it('corte de caja: un REFUND de $300 sobre un PAYMENT de $800 deja neto $500 y aparece en reembolsos', () => {
    const r = corteDeCaja([
      cobro({ id: 'cb1', monto: 800 }),
      cobro({ id: 'rb1', monto: 300, tipo: 'REFUND', cobroOriginalId: 'cb1', concepto: 'reembolso' }),
    ])
    expect(r.ingresos).toBe(800)
    expect(r.reembolsos).toBe(-300)
    expect(r.neto).toBe(500)
    expect(r.efectivo).toBe(500)
  })

  it('el embudo no cuenta un REFUND como cobro que salda', () => {
    const cita = { id: 'A1', estado: 'atendida', fechaHora: '2026-09-06 10:00', pacienteNombre: 'P' } as never
    const e = embudoCobro([cita], [cobro({ monto: 800, tipo: 'REFUND', citaId: 'A1' })])
    expect(e.cobradas).toBe(0)
    expect(e.montoCobrado).toBe(0)
  })

  it('el resumen de Finanzas resta el REFUND del total, del método, del concepto y del médico; el ticket promedio es de los pagos', () => {
    const r = agregarResumen([
      cobro({ monto: 800, medicoId: 'd1', medicoNombre: 'Dra. S', patientId: 'P1', patientNombre: 'P' }),
      cobro({ monto: 300, tipo: 'REFUND', concepto: 'reembolso', medicoId: 'd1', medicoNombre: 'Dra. S', patientId: 'P1', patientNombre: 'P' }),
    ])
    expect(r.totalIngresos).toBe(500)
    expect(r.porMetodo.efectivo.monto).toBe(500)
    expect(r.porConcepto.reembolso.monto).toBe(-300)
    expect(r.porMedico.d1.monto).toBe(500)
    expect(r.topPacientes[0].monto).toBe(500)
    expect(r.ticketPromedio).toBe(800)
  })

  it('comisiones: el REFUND resta de la base comisionable', () => {
    const rep = calcularComisiones([
      cobro({ monto: 1000, medicoId: 'a', medicoNombre: 'A' }),
      cobro({ monto: 200, tipo: 'REFUND', medicoId: 'a', medicoNombre: 'A' }),
    ], { porMedico: { a: 50 }, porDefecto: 0, conceptosExcluidos: [] })
    expect(rep.filas[0].baseComisionable).toBe(800)
    expect(rep.filas[0].comision).toBe(400)
  })

  it('estado-cobro ya lo consumía: con el REFUND total la consulta queda «reembolsado»', () => {
    const s = situacionDeCobro(800, [{ monto: 800, tipo: 'PAYMENT' }, { monto: 800, tipo: 'REFUND' }])
    expect(s.estado).toBe('reembolsado')
  })
})

describe('ASC-016 · «por médico» agrupa por id y no pierde filas', () => {
  it('un cobro con medicoId y SIN nombre se suma a su médico (igual que Comisiones)', () => {
    const r = agregarResumen([
      cobro({ monto: 500, medicoId: 'd1', medicoNombre: 'Dra. S' }),
      cobro({ monto: 300, medicoId: 'd1' }),
    ])
    expect(r.porMedico.d1).toEqual({ nombre: 'Dra. S', monto: 800, n: 2 })
  })

  it('sólo id, sin nombre en ningún cobro: «Médico sin nombre», no desaparece', () => {
    const r = agregarResumen([cobro({ monto: 300, medicoId: 'd9' })])
    expect(r.porMedico.d9).toEqual({ nombre: 'Médico sin nombre', monto: 300, n: 1 })
  })

  it('sin médico → fila «Sin atribuir», para que el desglose SUME el total', () => {
    const r = agregarResumen([cobro({ monto: 500, medicoId: 'd1', medicoNombre: 'Dra. S' }), cobro({ monto: 250 })])
    expect(r.porMedico[SIN_ATRIBUIR]).toEqual({ nombre: 'Sin atribuir', monto: 250, n: 1 })
    const suma = Object.values(r.porMedico).reduce((s, m) => s + m.monto, 0)
    expect(suma).toBe(r.totalIngresos)
  })
})

describe('ASC-014 · el CSV para el contador', () => {
  const vivo = cobro({ id: 'a', folio: 'CB-1', monto: 800, patientNombre: 'Paciente S', medicoNombre: 'Dra. S', creadoPor: 'u1' })
  const anulado = cobro({ id: 'b', folio: 'CB-2', monto: 500, cancelado: true, motivoCancelacion: 'captura doble', canceladoPorNombre: 'Ana', creadoPor: 'u2' })
  const devolucion = cobro({ id: 'c', folio: 'RB-1', monto: 300, tipo: 'REFUND', cobroOriginalId: 'a', concepto: 'reembolso', creadoPor: 'stripe:reembolso' })

  it('lleva día y hora del CONSULTORIO además del instante ISO', () => {
    const csv = cobrosACSV([vivo], { tz: 'America/Mexico_City' })
    const fila = csv.split('\n')[1].split(',')
    const cab = csv.split('\n')[0].split(',')
    expect(fila[cab.indexOf('Día (consultorio)')]).toBe('2026-09-06')
    expect(fila[cab.indexOf('Hora')]).toBe('15:32')
    expect(fila[cab.indexOf('Fecha ISO')]).toBe('2026-09-06T21:32:00.000Z')
    // En Tijuana (UTC-7 en septiembre) es una hora antes.
    expect(cobrosACSV([vivo], { tz: 'America/Tijuana' }).split('\n')[1].split(',')[cab.indexOf('Hora')]).toBe('14:32')
  })

  it('exporta los anulados MARCADOS (estado, motivo, quién) en vez de omitirlos', () => {
    const csv = cobrosACSV([vivo, anulado], { tz: 'America/Mexico_City', nombrePorUid: { u1: 'Ana', u2: 'Beto' } })
    const lineas = csv.split('\n')
    expect(lineas).toHaveLength(3)
    const cab = lineas[0].split(',')
    const f2 = lineas[2].split(',')
    expect(f2[cab.indexOf('Estado')]).toBe('anulado')
    expect(f2[cab.indexOf('Motivo de anulación')]).toBe('captura doble')
    expect(f2[cab.indexOf('Anuló')]).toBe('Ana')
    expect(lineas[1].split(',')[cab.indexOf('Estado')]).toBe('vivo')
  })

  it('dice quién cobró (nombre del equipo, nunca correo) y el tipo; la devolución sale negativa con su cobro original', () => {
    const csv = cobrosACSV([vivo, devolucion], { tz: 'America/Mexico_City', nombrePorUid: { u1: 'Ana' } })
    const [cab, f1, f2] = csv.split('\n').map(l => l.split(','))
    expect(f1[cab.indexOf('Cobró')]).toBe('Ana')
    expect(f1[cab.indexOf('Tipo')]).toBe('Pago')
    expect(f2[cab.indexOf('Tipo')]).toBe('Devolución')
    expect(f2[cab.indexOf('Monto MXN')]).toBe('-300.00')
    expect(f2[cab.indexOf('Cobro original')]).toBe('a')
    expect(f2[cab.indexOf('Cobró')]).toBe('Stripe (reembolso en línea)')
  })

  it('quienCobro nunca devuelve un correo y nunca un hueco', () => {
    expect(quienCobro({ creadoPor: 'abcdef123' })).toBe('usuario abcdef…')
    expect(quienCobro({ creadoPor: '' })).toBe('sin autor registrado')
    expect(quienCobro({ creadoPor: 'u1', creadoPorNombre: 'Ana' })).toBe('Ana')
    expect(quienCobro({ creadoPor: 'stripe:anticipo' })).toBe('Stripe (anticipo en línea)')
    expect(quienCobro({ creadoPor: 'u1' }, { u1: 'Beto' })).toBe('Beto')
  })
})
