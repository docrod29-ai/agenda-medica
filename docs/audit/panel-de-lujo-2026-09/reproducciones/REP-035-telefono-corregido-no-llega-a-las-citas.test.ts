/**
 * REP-035 · ASM-004 (AS-mensajeria) — corregir el teléfono del paciente no
 * corrige el de sus citas: el recordatorio de mañana sale al número viejo
 * mientras la pantalla dijo «Paciente actualizado».
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * `src/lib/firestore.ts:594-640` `updatePatient` escribe SÓLO `patients/{id}`
 * e invalida la caché. El cron lee el teléfono de la CITA
 * (`api/cron/reminders/route.ts:219` `const phone = appt.pacienteTelefono`) y
 * sólo abre `patients/{pacienteId}` para `portalTokenVersion` (:269-271). Las
 * únicas escrituras de `pacienteTelefono` en todo `src/` son ALTAS de cita
 * (booking, webhook, AppointmentModal): ningún sincronizador.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor AS-mensajeria, hallazgo ASM-004 (`crudos/AS-mensajeria.json`). El
 * equipo rojo (`crudos/R-AS-mensajeria.json`) buscó el reconciliador y no
 * existe; lo llama «el caso canónico de el-dato-tiene-que-LLEGAR». REG-323,
 * que el auditor relaciona, es otra cosa (el payload de /pacientes borraba
 * alergias) y no lo cubre.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * `pacienteTelefono` es un dato DESNORMALIZADO en la cita (útil para citas sin
 * expediente, del bot antiguo) y nadie es dueño de mantenerlo: ni el editor del
 * paciente lo propaga, ni el lector (cron) cae al expediente cuando lo hay.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * el-dato-tiene-que-llegar: «¿quién lo lee después, y encuentra lo que
 * espera?». Invariante «UN PACIENTE · UNA IDENTIDAD»: dos copias del teléfono
 * son dos fuentes de verdad.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO sobre `updatePatient` real con `firebase/firestore` doblado en
 * memoria (lecturas desde `docs`, todas las escrituras grabadas: updateDoc,
 * setDoc, writeBatch, runTransaction). Se acepta también la OTRA reparación
 * que propone el hallazgo —que el cron resuelva el teléfono desde
 * `patients/{pacienteId}`— como contrato textual sobre la ruta del cron: si
 * la lectura de `patients` en el bucle usa `telefono`, la prueba pasa.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * Citas huérfanas sin `pacienteId` (bot antiguo). El menú «Llamar» de
 * `citas/page.tsx:1227`, que lee el mismo campo. La lista de espera.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const { docs, escrituras } = vi.hoisted(() => ({
  docs: {} as Record<string, Record<string, unknown>>,
  escrituras: [] as { path: string; op: string; d: Record<string, unknown> }[],
}))

vi.mock('@/lib/firebase', () => ({ db: { __doble: 'db' }, auth: { currentUser: { uid: 'u1' } } }))
vi.mock('@/lib/expediente/audit-log', () => ({ logAudit: async () => undefined, drenarCola: async () => undefined }))

vi.mock('firebase/firestore', () => {
  type Ref = { __col?: boolean; path: string; id: string }
  type Filtro = [string, string, unknown]
  type Q = { path: string; filtros: Filtro[] }
  let n = 0
  const collection = (base: unknown, ...segs: string[]): Ref => {
    const b = base as Ref
    const pre = b && typeof b.path === 'string' ? `${b.path}/` : ''
    return { __col: true, path: pre + segs.join('/'), id: segs[segs.length - 1] }
  }
  const doc = (base: unknown, ...segs: string[]): Ref => {
    const b = base as Ref
    if (b && b.__col) { const id = segs[0] ?? `auto_${++n}`; return { path: `${b.path}/${id}`, id } }
    return { path: segs.join('/'), id: segs[segs.length - 1] }
  }
  const snap = (p: string) => ({ id: p.split('/').pop(), ref: { path: p }, exists: () => p in docs, data: () => docs[p] })
  const escribir = (op: string, ref: Ref, d: Record<string, unknown>) => {
    escrituras.push({ path: ref.path, op, d })
    docs[ref.path] = op === 'set' ? { ...d } : { ...(docs[ref.path] ?? {}), ...d }
  }
  const hijosDe = (q: Q) => Object.keys(docs)
    .filter(p => p.startsWith(`${q.path}/`) && !p.slice(q.path.length + 1).includes('/'))
    .filter(p => q.filtros.every(([f, op, v]) => {
      const x = docs[p][f]
      if (op === '==') return x === v
      if (op === 'in') return (v as unknown[]).includes(x)
      if (op === '>=') return String(x) >= String(v)
      if (op === '>') return String(x) > String(v)
      if (op === '<=') return String(x) <= String(v)
      if (op === '<') return String(x) < String(v)
      return true
    }))
  const query = (base: unknown, ...restricciones: unknown[]): Q => {
    const b = base as Q & Ref
    const q: Q = { path: b.path, filtros: [...(b.filtros ?? [])] }
    for (const r of restricciones as ({ __where?: Filtro } | undefined)[]) if (r && r.__where) q.filtros.push(r.__where)
    return q
  }
  const tx = {
    get: async (ref: Ref) => snap(ref.path),
    update: (ref: Ref, d: Record<string, unknown>) => escribir('update', ref, d),
    set: (ref: Ref, d: Record<string, unknown>) => escribir('set', ref, d),
  }
  return {
    collection, doc, query,
    where: (f: string, op: string, v: unknown) => ({ __where: [f, op, v] as Filtro }),
    orderBy: () => ({}), limit: () => ({}), startAfter: () => ({}), documentId: () => '__name__',
    serverTimestamp: () => new Date().toISOString(), Timestamp: { now: () => ({ toDate: () => new Date() }) },
    getDoc: async (ref: Ref) => snap(ref.path),
    getDocs: async (q: Q) => { const d = hijosDe(q).map(snap); return { docs: d, empty: d.length === 0, size: d.length, forEach: (fn: (s: unknown) => void) => d.forEach(fn) } },
    updateDoc: async (ref: Ref, d: Record<string, unknown>) => escribir('update', ref, d),
    setDoc: async (ref: Ref, d: Record<string, unknown>) => escribir('set', ref, d),
    addDoc: async (col: Ref, d: Record<string, unknown>) => { const r = doc(col); escribir('set', r, d); return r },
    deleteDoc: async (ref: Ref) => { delete docs[ref.path] },
    runTransaction: async (_db: unknown, fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    writeBatch: () => {
      const ops: (() => void)[] = []
      const b = {
        update: (ref: Ref, d: Record<string, unknown>) => { ops.push(() => escribir('update', ref, d)); return b },
        set: (ref: Ref, d: Record<string, unknown>) => { ops.push(() => escribir('set', ref, d)); return b },
        delete: (ref: Ref) => { ops.push(() => { delete docs[ref.path] }); return b },
        commit: async () => { ops.forEach(f => f()) },
      }
      return b
    },
  }
})

import { updatePatient } from '@/lib/firestore'

const raiz = path.resolve(__dirname, '../../../..')

/** ¿El cron, al leer `patients/{pacienteId}` dentro del bucle, usa su `telefono`? */
function elCronCaeAlExpediente(): boolean {
  const src = readFileSync(path.join(raiz, 'src/app/api/cron/reminders/route.ts'), 'utf8')
  const i = src.indexOf(".collection('patients')")
  if (i === -1) return false
  return /\btelefono\b/.test(src.slice(i, i + 600))
}

describe('REP-035 · el teléfono corregido llega a las citas futuras (o el cron lo resuelve del expediente)', () => {
  beforeEach(() => {
    for (const k of Object.keys(docs)) delete docs[k]
    escrituras.length = 0
    docs['clinics/C/patients/P1'] = { nombre: 'Paciente Sintético', telefono: '5551112233', updatedAt: '2026-09-01T10:00:00.000Z' }
    docs['clinics/C/appointments/A1'] = { pacienteId: 'P1', pacienteNombre: 'Paciente Sintético', pacienteTelefono: '5551112233', fechaHora: '2099-01-10T10:00', estado: 'confirmada', consentimientoMensajes: true }
    docs['clinics/C/appointments/A0'] = { pacienteId: 'P1', pacienteNombre: 'Paciente Sintético', pacienteTelefono: '5551112233', fechaHora: '2020-01-10T10:00', estado: 'atendida' }
  })

  it('control: updatePatient escribe el teléfono nuevo en el expediente (el doble funciona)', async () => {
    await updatePatient('C', 'P1', { telefono: '5559998877' })
    expect(docs['clinics/C/patients/P1'].telefono).toBe('5559998877')
  })

  it('HOY FALLA: tras corregir el teléfono, la cita FUTURA lo lleva (o el cron lo lee del expediente)', async () => {
    await updatePatient('C', 'P1', { telefono: '5559998877' })
    const citaFutura = docs['clinics/C/appointments/A1']
    const propagado = String(citaFutura.pacienteTelefono ?? '').replace(/\D/g, '') === '5559998877'
    const escribioCitas = escrituras.some(e => e.path.includes('/appointments/'))
    expect(
      propagado || elCronCaeAlExpediente(),
      `pacienteTelefono de la cita futura sigue en ${citaFutura.pacienteTelefono}; escrituras a citas: ${escribioCitas}; el cron cae al expediente: ${elCronCaeAlExpediente()}`,
    ).toBe(true)
  })
})
