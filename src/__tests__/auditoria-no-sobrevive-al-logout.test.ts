/**
 * GOLDEN — la cola de auditoría se quedaba en el disco al cerrar sesión.
 *
 * ── EL HUECO ─────────────────────────────────────────────────────────────────
 *
 * `nx.audit.pendientes` vive en `localStorage` y guarda los asientos de bitácora
 * que no se pudieron mandar: llevan dentro el paciente y el evento.
 *
 * La limpieza del cierre de sesión sólo mira `PREFIJOS_PHI`
 * (`nx.consulta.bkp.`, `nx.uci.`), así que esa cola **sobrevivía al logout**. En
 * un consultorio con equipo compartido —que es la norma— quedaban en disco
 * asientos clínicos visibles para quien entrara después.
 *
 * ── POR QUÉ NO SE BORRA SIN MÁS ──────────────────────────────────────────────
 *
 * Un asiento sin mandar es **registro medicolegal**. Borrarlo «por seguridad»
 * cambia un problema de privacidad por una pérdida de trazabilidad, que es
 * exactamente el error que este proyecto ya cometió con los borradores y
 * corrigió: purgar sólo cuando el trabajo está a salvo.
 *
 * ── LA REPARACIÓN ────────────────────────────────────────────────────────────
 *
 * Se **manda** la cola antes de cerrar, mientras el token todavía sirve — que es
 * lo único que la vacía de verdad. Lo que no se pueda enviar se queda, igual que
 * el borrador, y los asientos de otra persona siguen esperando a que vuelva.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { esClaveBorrador, clavesABorrar } from '@/lib/mobile/local-drafts'

const salir = readFileSync(join(process.cwd(), 'src/lib/salir-seguro.ts'), 'utf8')
const audit = readFileSync(join(process.cwd(), 'src/lib/expediente/audit-log.ts'), 'utf8')

describe('LA COLA SE VACÍA MANDÁNDOLA, NO BORRÁNDOLA', () => {
  it('el cierre de sesión drena la cola', () => {
    expect(salir).toContain('drenarCola')
    expect(audit).toContain('export async function drenarCola')
  })

  it('y lo hace ANTES del signOut', () => {
    /**
     * Después, `fetchAutenticado` ya no tiene con qué autenticar y la cola no se
     * vaciaría nunca: quedaría en disco igual que antes, pero con la sensación
     * de estar resuelto.
     */
    const iDrenar = salir.indexOf('await drenarCola()')
    const iSignOut = salir.indexOf('auth.signOut()')
    expect(iDrenar).toBeGreaterThan(0)
    expect(iDrenar).toBeLessThan(iSignOut)
  })

  it('sin poder trabar el cierre de sesión', () => {
    // La bitácora no puede impedir que alguien salga de la aplicación.
    const i = salir.indexOf('drenarCola')
    expect(salir.slice(i - 200, i + 300)).toContain('catch')
  })
})

describe('LO QUE NO SE PUDO MANDAR NO SE TIRA', () => {
  it('la cola NO está entre las claves que se purgan a ciegas', () => {
    /**
     * Si estuviera, un fallo de red convertiría asientos medicolegales en nada.
     * Es la misma decisión que ya se tomó con los borradores.
     */
    expect(esClaveBorrador('nx.audit.pendientes')).toBe(false)
    expect(clavesABorrar(['nx.audit.pendientes'])).toEqual([])
  })

  it('y los asientos de OTRA persona siguen esperándola', () => {
    // Mandarlos ahora los firmaría con el nombre equivocado.
    expect(audit).toContain('if (p.uid && yo && p.uid !== yo)')
  })
})

describe('LO QUE SÍ SE SIGUE PURGANDO', () => {
  it('el borrador de consulta y las lecturas de UCI', () => {
    expect(esClaveBorrador('nx.consulta.bkp.abc')).toBe(true)
    expect(esClaveBorrador('nx.uci.seed.xyz')).toBe(true)
  })

  it('y nada que no sea PHI', () => {
    // Un purgador que borra de más se lleva la configuración del usuario.
    expect(esClaveBorrador('theme')).toBe(false)
    expect(esClaveBorrador('nx.zona')).toBe(false)
  })
})
