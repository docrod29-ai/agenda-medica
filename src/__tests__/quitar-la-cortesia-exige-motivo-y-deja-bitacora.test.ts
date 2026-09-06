/**
 * REP-033 · ASC-004 (AS-cobros) — quitar una cortesía no pide motivo, borra
 * quién la autorizó y por qué, y no deja bitácora: el rastro anti-fraude de
 * REG-003 se deshace con dos clics.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * `src/lib/cobros.ts:403-411` `quitarExencion(clinicId, citaId)` hace un
 * `updateDoc` con `cobroExento:false, exentoMotivo:'', exentoPor:'',
 * exentoPorNombre:'', exentoEn:''` — sin motivo, sin autor, y VACIANDO el sello
 * de la autorización. Su único llamador (`citas/page.tsx:791`) tampoco llama a
 * `logAudit`, mientras la cortesía sí lo hace (`CobrarModal.tsx:134-137`). La
 * regla de `appointments` (firestore.rules:151-158) sólo vigila false→true.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor AS-cobros, hallazgo ASC-004 (`crudos/AS-cobros.json`), en vivo:
 * ⋮ → «Quitar cortesía» → confirmar → `exentoMotivo/exentoPor` vacíos y en la
 * bitácora sólo `cobro_exento`. El equipo rojo (`crudos/R-AS-cobros.json`)
 * confirmó con grep que `logAudit` aparece en ese archivo sólo en :37, :420 y
 * :521, y probó en el emulador «PERMITIDO secretaria quita la cortesía
 * true→false sin motivo ni autor».
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * REG-003 selló la decisión de NO cobrar; nadie selló su reverso. Y el reverso
 * borra el sello original en vez de conservarlo: marcar cortesía, cobrar en
 * efectivo fuera, quitar la cortesía, volver a marcarla con otro motivo — la
 * primera autorización desaparece.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * clinical-safety §3 en lenguaje de dinero: nada cambia en silencio; toda
 * reversión es visible y rastreable. security-tenant: la regla es el borde.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO sobre `quitarExencion` real con `firebase/firestore` doblado
 * (graba las escrituras) y `logAudit` doblado (espía). Para la bitácora se
 * aceptan las dos salidas que el repositorio ya usa: el asiento lo deja la
 * función (espía) O lo deja el llamador en el bloque de `citas/page.tsx` que
 * invoca `quitarExencion` (contrato textual sobre ese bloque, como hace
 * `CobrarModal` con la cortesía). La forma del sello conservado no se impone:
 * basta que el motivo y el autor LLEGUEN al documento.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No ejecuta la regla de `appointments` para el paso true→false (la simétrica
 * de :152). No cubre cortesías sobre citas no atendidas, que el corte no lista
 * (`corte-caja.ts:188`).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const { escrituras, asientos } = vi.hoisted(() => ({
  escrituras: [] as { path: string; d: Record<string, unknown> }[],
  asientos: [] as Record<string, unknown>[],
}))

vi.mock('@/lib/firebase', () => ({ db: { __doble: 'db' }, auth: { currentUser: { uid: 'u1' } } }))
vi.mock('@/lib/expediente/audit-log', () => ({
  logAudit: async (p: Record<string, unknown>) => { asientos.push(p) },
  drenarCola: async () => undefined,
}))
vi.mock('firebase/firestore', () => {
  type Ref = { path: string; id: string }
  const doc = (base: unknown, ...segs: string[]): Ref => {
    const b = base as Ref & { __col?: boolean }
    if (b && b.__col) return { path: `${b.path}/${segs[0] ?? 'auto'}`, id: segs[0] ?? 'auto' }
    return { path: segs.join('/'), id: segs[segs.length - 1] }
  }
  const collection = (_db: unknown, ...segs: string[]) => ({ __col: true, path: segs.join('/'), id: segs[segs.length - 1] })
  const escribir = (ref: Ref, d: Record<string, unknown>) => { escrituras.push({ path: ref.path, d }) }
  return {
    doc, collection,
    updateDoc: async (ref: Ref, d: Record<string, unknown>) => escribir(ref, d),
    addDoc: async (col: Ref, d: Record<string, unknown>) => { escribir(col, d); return { id: 'nuevo' } },
    runTransaction: async (_db: unknown, fn: (tx: unknown) => Promise<unknown>) => fn({
      get: async (ref: Ref) => ({ exists: () => true, data: () => ({ cobroExento: true, exentoMotivo: 'paciente de la familia', exentoPor: 'u0' }), id: ref.id }),
      update: (ref: Ref, d: Record<string, unknown>) => escribir(ref, d),
      set: (ref: Ref, d: Record<string, unknown>) => escribir(ref, d),
    }),
    getDocs: async () => ({ docs: [], empty: true }), query: (c: unknown) => c, where: () => ({}), orderBy: () => ({}),
  }
})

import * as cobros from '@/lib/cobros'

const raiz = path.resolve(__dirname, '../..')
/** El bloque de `citas/page.tsx` que llama a quitarExencion, ±12 líneas. */
function bloqueDelLlamador(): string {
  const src = readFileSync(path.join(raiz, 'src/app/(dashboard)/citas/page.tsx'), 'utf8').split('\n')
  const i = src.findIndex(l => /await quitarExencion\(/.test(l))
  return i === -1 ? '' : src.slice(Math.max(0, i - 12), i + 12).join('\n')
}

const quitar = cobros.quitarExencion as unknown as (...args: unknown[]) => Promise<void>

describe('REP-033 · quitar una cortesía exige motivo, conserva el sello y deja bitácora', () => {
  beforeEach(() => { escrituras.length = 0; asientos.length = 0 })

  it('control: la función existe y hoy vuelve la cita a cobro (cobroExento:false)', async () => {
    await quitar('C', 'A1', 'se cobró en efectivo al final', 'u1', 'Ana Sintética')
    const cita = escrituras.filter(e => e.path === 'clinics/C/appointments/A1')
    expect(cita.length).toBeGreaterThan(0)
    expect(JSON.stringify(cita.map(e => e.d))).toContain('"cobroExento":false')
  })

  it('HOY FALLA: sin motivo, quitar la cortesía debe RECHAZARSE (como cancelarCobro sin motivo)', async () => {
    await expect(quitar('C', 'A1')).rejects.toThrow()
    expect(escrituras.filter(e => e.path === 'clinics/C/appointments/A1')).toHaveLength(0)
  })

  it('HOY FALLA: con motivo y autor, los dos LLEGAN al documento y no se vacía el sello original', async () => {
    await quitar('C', 'A1', 'se cobró en efectivo al final', 'u1', 'Ana Sintética')
    const cita = escrituras.filter(e => e.path === 'clinics/C/appointments/A1')
    const texto = JSON.stringify(cita.map(e => e.d))
    expect(texto, 'el motivo del retiro no llega al documento').toContain('se cobró en efectivo al final')
    expect(texto, 'el autor del retiro no llega al documento').toContain('"u1"')
    const vaciaElSello = cita.some(e => e.d.exentoPor === '' && e.d.exentoMotivo === '' && !('historialCortesia' in e.d))
    expect(vaciaElSello, 'la autorización original se borra en vez de conservarse').toBe(false)
  })

  it('HOY FALLA: queda asiento en la bitácora (en la función o en su llamador)', async () => {
    await quitar('C', 'A1', 'se cobró en efectivo al final', 'u1', 'Ana Sintética')
    const enLaFuncion = asientos.some(a => /cortes|exen/i.test(String(a.evento ?? '')))
    const enElLlamador = /logAudit\(/.test(bloqueDelLlamador())
    expect(enLaFuncion || enElLlamador, 'ni quitarExencion ni su llamador dejan asiento en logAudit').toBe(true)
  })
})
