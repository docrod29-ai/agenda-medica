/**
 * REP-052 · MP-003 (M-pediatra) — el copiloto elige «Gentamicina neonatal
 * (≤7 días)» por subcadena para CUALQUIER niño: falsa alarma crítica en un
 * escolar; y el motor devuelve esa pauta como usable a los 8 años.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * `src/lib/expediente/copiloto.ts:288`
 *   `FARMACOS_PED.find(x => nm.includes(norm(x.nombre)) || norm(x.nombre).includes(nm))`
 * Para nm='gentamicina', `norm('Gentamicina neonatal (≤7 días)')` la contiene
 * y es la PRIMERA del arreglo (pediatria.ts:67). Luego `:290`
 * `calcularDosisPediatrica(f, peso)` sin edad. La entrada neonatal lleva
 * `edadMinimaMeses: 0` y ninguna edad máxima, así que
 * `calcularDosisPediatrica(neonatal, 20, 96)` devuelve `porToma {50, 50}`.
 * Con 140 mg (7 mg/kg, dentro del tope real de 7.5) sale `excede` ⇒ `critico`.
 * El comentario de pediatria.ts:65-66 («el matcher por edad la prefiera;
 * calcularDosisPediatrica elige por edadMeses») describe una selección que no
 * existe: «escrito y sin conectar».
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor M-pediatra, MP-003; equipo rojo confirmado P1 con jiti (matcher →
 * literalmente la entrada neonatal; motor → 50 mg c/12 h para 8 años).
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * Selección por primera coincidencia de subcadena, sin edad; y un catálogo sin
 * límite superior de edad para una pauta que sólo vale ≤7 días.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * clinical-safety §5 (señalar de menos, nunca de más: un crítico falso enseña a
 * ignorar el verdadero — dosis.ts:437-445 ya lo documenta para insulina) y
 * el-dato-tiene-que-llegar («escrito y sin conectar»).
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO: `copiloto()` real y `calcularDosisPediatrica()` real. El
 * escolar sintético (8 años, 20 kg, 140 mg c/24 h) es el del auditor.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No fija la edad máxima en días de la pauta neonatal (NEEDS_CLINICAL_REVIEW:
 * la decide el Dr.). No cubre prematuridad ni edad posmenstrual. No cubre el
 * caso inverso del panel (ofrecer la pauta de 7.5 mg/kg a un recién nacido):
 * eso es PanelPediatria y exige la misma decisión del dueño.
 */
import { describe, it, expect } from 'vitest'
import { copiloto } from '@/lib/expediente/copiloto'
import { FARMACOS_PED, calcularDosisPediatrica } from '@/lib/expediente/pediatria'

const ESCOLAR = { edad: 8, signos: { peso: 20 }, medicamentos: [{ nombre: 'Gentamicina', dosis: '140 mg' }] }
const OCHO_ANIOS_EN_MESES = 96
const neonatal = FARMACOS_PED.find(f => /neonatal/i.test(f.nombre))!
const general = FARMACOS_PED.find(f => f.nombre === 'Gentamicina')!

describe('REP-052 · un escolar con «gentamicina» no casa la pauta neonatal', () => {
  const ped = copiloto(ESCOLAR).filter(s => s.id.startsWith('ped:dosis:'))

  it('control: el catálogo tiene las dos entradas y el copiloto emite algo de dosis pediátrica', () => {
    expect(neonatal).toBeDefined()
    expect(general).toBeDefined()
    expect(ped.length).toBeGreaterThan(0)
  })

  it('ninguna sugerencia pediátrica del escolar habla de la pauta neonatal (hoy: «Gentamicina neonatal (≤7 días): …»)', () => {
    const neo = ped.filter(s => /neonatal/i.test(s.id) || /neonatal/i.test(s.titulo))
    expect(neo.map(s => s.titulo), 'eligió la entrada neonatal por subcadena').toHaveLength(0)
  })

  it('140 mg a 20 kg (7 mg/kg, dentro del tope 7.5) NO es crítico (hoy: falsa alarma crítica)', () => {
    const criticos = ped.filter(s => s.nivel === 'critico')
    expect(criticos.map(s => `${s.titulo} — ${s.detalle}`), 'crítico falso').toHaveLength(0)
  })

  it('el motor no devuelve la pauta neonatal como usable a los 8 años (hoy: 50 mg c/12 h)', () => {
    const d = calcularDosisPediatrica(neonatal, 20, OCHO_ANIOS_EN_MESES) as
      (ReturnType<typeof calcularDosisPediatrica> & { noAplicaPorEdad?: boolean })
    const usable = d != null && !d.contraindicadoPorEdad && !d.noAplicaPorEdad && d.porToma.max > 0
    expect(usable, `devolvió ${JSON.stringify(d?.porToma)}`).toBe(false)
  })

  it('control: la entrada general de gentamicina sí da un rango que contiene 140 mg para 20 kg', () => {
    const d = calcularDosisPediatrica(general, 20, OCHO_ANIOS_EN_MESES)!
    expect(d.contraindicadoPorEdad).toBeFalsy()
    expect(140).toBeLessThanOrEqual(d.porToma.max * 1.05)
  })
})
