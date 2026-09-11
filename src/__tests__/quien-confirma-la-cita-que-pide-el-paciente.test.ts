/**
 * QUIÉN CONFIRMA LA CITA QUE PIDE EL PACIENTE — D-054.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * Toda cita que entraba por el portal público, por el bot de WhatsApp o por la
 * lista de espera nacía `solicitada`, con el literal escrito en tres sitios
 * distintos, y alguien del consultorio tenía que confirmarla a mano. El dueño
 * decidió el 9-sep-2026 que cada médico configure si la confirmación es directa
 * o manual. La auditoría del 10-sep lo encontró sin implementar: no había campo,
 * ni pantalla, ni un solo sitio que decidiera.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * 1. Un solo módulo decide (`estadoInicialDeCita`) y las tres puertas lo LLAMAN:
 *    se comprueba en la fuente sin comentarios, con la llamada y no la mención.
 * 2. Lo ausente y lo desconocido caen a `manual`: una cita confirmada sin que
 *    nadie lo decidiera es el fallo caro, así que no se adivina.
 * 3. El médico pisa al consultorio, y no depende de `horarioPropio` (que hoy no
 *    lo enciende ninguna pantalla): confirmar no es una regla de horario.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - No ejecuta las rutas contra el emulador: la transacción de reserva y su
 *   `CONFLICTO` ya tienen sus pruebas (`reservar-dos-veces-no-son-dos-citas`).
 * - «Por horario o sede»: no hay sede en la cita ni franjas de confirmación.
 *   Cuando existan, el módulo dice dónde ampliarlo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  estadoInicialDeCita, modoDeConfirmacion, loQueSeLeDiceAlConsultorio, loQueSeLeDiceAlPaciente,
  MODOS_DE_CONFIRMACION, ETIQUETA_MODO_DE_CONFIRMACION,
} from '@/lib/agenda/estado-inicial-de-cita'
import { DEFAULT_CONFIG } from '@/types'

const AHORA = '2026-09-10T16:00:00.000Z'

describe('D-054 · el modo se resuelve médico → consultorio → manual', () => {
  it('sin nada configurado, la cita nace solicitada (lo que había)', () => {
    expect(estadoInicialDeCita(null, null, AHORA)).toEqual({ estado: 'solicitada', modo: 'manual' })
    expect(estadoInicialDeCita({}, undefined, AHORA).estado).toBe('solicitada')
  })

  it('con el consultorio en directa, nace confirmada y con fecha de confirmación', () => {
    expect(estadoInicialDeCita({ confirmacionDeCitas: 'directa' }, null, AHORA))
      .toEqual({ estado: 'confirmada', modo: 'directa', fechaConfirmacion: AHORA })
  })

  it('el médico pisa al consultorio en los dos sentidos', () => {
    expect(modoDeConfirmacion({ confirmacionDeCitas: 'directa' }, { confirmacionDeCitas: 'manual' })).toBe('manual')
    expect(modoDeConfirmacion({ confirmacionDeCitas: 'manual' }, { confirmacionDeCitas: 'directa' })).toBe('directa')
  })

  it('un valor desconocido NO se lee como directa: cae a manual', () => {
    expect(modoDeConfirmacion({ confirmacionDeCitas: 'automatica' }, null)).toBe('manual')
    expect(modoDeConfirmacion({ confirmacionDeCitas: 'directa' }, { confirmacionDeCitas: 'sí' })).toBe('directa')
    expect(modoDeConfirmacion({ confirmacionDeCitas: 'DIRECTA' as never }, null)).toBe('manual')
  })

  it('la configuración por omisión del producto es manual, y la pantalla ofrece exactamente los dos modos', () => {
    expect(DEFAULT_CONFIG.confirmacionDeCitas).toBe('manual')
    expect(MODOS_DE_CONFIRMACION).toEqual(['manual', 'directa'])
    for (const m of MODOS_DE_CONFIRMACION) expect(ETIQUETA_MODO_DE_CONFIRMACION[m]).toMatch(/\S/)
  })

  it('a cada quien se le dice la verdad: al consultorio no se le pide confirmar lo confirmado, al paciente no se le promete un contacto', () => {
    expect(loQueSeLeDiceAlConsultorio('manual')).toMatch(/solicitada/)
    expect(loQueSeLeDiceAlConsultorio('directa')).toMatch(/confirmada/)
    expect(loQueSeLeDiceAlPaciente('manual')).toMatch(/contactaremos/)
    expect(loQueSeLeDiceAlPaciente('directa')).not.toMatch(/contactaremos/)
  })
})

/* ── Las tres puertas LLAMAN al módulo: fuente sin comentarios ──────────────── */

function limpiarComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1')
}
const leer = (rel: string) => limpiarComentarios(readFileSync(join(process.cwd(), rel), 'utf8'))

describe('D-054 · las puertas de entrada no vuelven a escribir el literal', () => {
  const PUERTAS = [
    { archivo: 'src/app/api/public/booking/route.ts', llamadas: 1 },
    { archivo: 'src/app/api/whatsapp/webhook/route.ts', llamadas: 2 },
  ]
  for (const p of PUERTAS) {
    it(`${p.archivo} llama a estadoInicialDeCita ${p.llamadas} vez/veces y no escribe estado: 'solicitada' en una cita nueva`, () => {
      const src = leer(p.archivo)
      expect(src).toMatch(/import \{[^}]*\bestadoInicialDeCita\b[^}]*\} from '@\/lib\/agenda\/estado-inicial-de-cita'/)
      const llamadas = src.match(/estadoInicialDeCita\(/g) ?? []
      expect(llamadas.length).toBe(p.llamadas)
      // El literal que decidía por todos. Si vuelve, el modo configurado no llega.
      expect(src).not.toMatch(/estado:\s*'solicitada'\s*,/)
    })
  }

  it('AUTOTEST: el detector se pone rojo con el mutante que restaura el literal', () => {
    const src = leer('src/app/api/public/booking/route.ts')
    const mutante = src.replace(/estado:\s*nacimiento\.estado,/, "estado: 'solicitada',")
    expect(mutante).not.toBe(src)
    expect(mutante).toMatch(/estado:\s*'solicitada'\s*,/)
  })
})
