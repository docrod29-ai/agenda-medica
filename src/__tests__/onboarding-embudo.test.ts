/**
 * «NUEVO MÉDICO FUNCIONAL SIN ASISTENCIA HUMANA» — eso no se puede afirmar sin
 * mirar el camino real.
 *
 * Los hitos ya quedaban registrados (el paciente tiene su alta, la nota su
 * fecha, el cobro su folio). Lo que no existía es la RESTA: cuánto tarda cada
 * médico nuevo en llegar a cada uno, y en cuál se queda parado.
 *
 * Y lo que se busca no es el promedio. El promedio de un embudo lo dominan los
 * que llegaron al final; los que importan son los que NO llegaron, porque el
 * paso donde se quedaron es la pantalla que hay que arreglar.
 */
import { describe, it, expect } from 'vitest'
import { embudoDe, resumirEmbudos, medianaMs, duracionCorta, HITOS } from '@/lib/onboarding/embudo'

const T0 = Date.parse('2026-07-01T09:00:00Z')
const min = (n: number) => T0 + n * 60_000
const dias = (n: number) => T0 + n * 86_400_000

describe('el recorrido de un consultorio', () => {
  it('dice en qué paso se quedó', () => {
    const e = embudoDe({ cuenta: T0, paciente: min(5), cita: min(9) })
    expect(e.atoradoEn?.clave).toBe('consulta')
    expect(e.completados).toBe(3)
  })

  it('quien llegó al final no está atorado en ningún lado', () => {
    const e = embudoDe({ cuenta: T0, paciente: min(5), cita: min(9), consulta: min(40), receta: min(45), cobro: min(50) })
    expect(e.atoradoEn).toBeNull()
    expect(e.completados).toBe(HITOS.length)
  })

  it('mide el tiempo DESDE la creación de la cuenta', () => {
    const e = embudoDe({ cuenta: T0, paciente: min(30) })
    const p = e.pasos.find(x => x.hito.clave === 'paciente')!
    expect(p.desdeCuentaMs).toBe(30 * 60_000)
  })

  it('sin cuenta no hay reloj, y no se inventa uno', () => {
    // Poner «0» diría que lo hizo instantáneamente, que es lo contrario de no saber.
    const e = embudoDe({ paciente: min(5) })
    expect(e.pasos.find(x => x.hito.clave === 'paciente')!.desdeCuentaMs).toBeNull()
  })

  it('UN HUECO EN MEDIO NO SE MAQUILLA', () => {
    /**
     * Pasa de verdad: un médico importa sus pacientes de otro sistema y su
     * primer paciente «propio» nunca existe. Rellenar el hueco escondería justo
     * la anomalía que hay que entender.
     */
    const e = embudoDe({ cuenta: T0, cita: min(9), consulta: min(40) })
    expect(e.pasos.find(x => x.hito.clave === 'paciente')!.alcanzado).toBe(false)
    expect(e.atoradoEn?.clave).toBe('paciente')
  })

  it('un instante inválido cuenta como no alcanzado', () => {
    const e = embudoDe({ cuenta: T0, paciente: 0, cita: NaN as unknown as number })
    expect(e.completados).toBe(1)
  })

  it('cada hito dice qué hacer si alguien se queda ahí', () => {
    // Un embudo que sólo cuenta no sirve: el valor está en la acción.
    for (const h of HITOS) expect(h.siSeAtora.length).toBeGreaterThan(20)
  })
})

describe('la mediana, no el promedio', () => {
  it('un rezagado no desplaza la cifra', () => {
    // Con promedio, el de 30 días haría parecer lento un alta de minutos.
    expect(medianaMs([1, 2, 3, 4, 100000])).toBe(3)
  })

  it('con un número par toma el centro', () => {
    expect(medianaMs([10, 20, 30, 40])).toBe(25)
  })

  it('sin datos devuelve null, no cero', () => {
    expect(medianaMs([])).toBeNull()
    expect(medianaMs([null, null])).toBeNull()
  })
})

describe('el patrón de todos los consultorios', () => {
  it('cuenta cuántos se quedan en cada paso — eso es lo accionable', () => {
    const r = resumirEmbudos([
      embudoDe({ cuenta: T0, paciente: min(5) }),                                  // atorado en cita
      embudoDe({ cuenta: T0, paciente: min(6), cita: min(10) }),                    // atorado en consulta
      embudoDe({ cuenta: T0, paciente: min(7), cita: min(12) }),                    // atorado en consulta
      embudoDe({ cuenta: T0, paciente: min(8), cita: min(11), consulta: dias(1), receta: dias(1), cobro: dias(1) }),
    ])
    expect(r.total).toBe(4)
    expect(r.atorados.consulta).toBe(2)
    expect(r.atorados.cita).toBe(1)
    expect(r.atorados.completo).toBe(1)
    expect(r.alcanzaron.paciente).toBe(4)
    expect(r.alcanzaron.cobro).toBe(1)
  })

  it('sin consultorios no revienta', () => {
    const r = resumirEmbudos([])
    expect(r.total).toBe(0)
    expect(r.medianaHasta.paciente).toBeNull()
  })
})

describe('duracionCorta', () => {
  it('habla en la unidad que se entiende de un vistazo', () => {
    expect(duracionCorta(30_000)).toMatch(/menos de 1 min/)
    expect(duracionCorta(5 * 60_000)).toBe('5 min')
    expect(duracionCorta(3 * 3_600_000)).toBe('3 h')
    expect(duracionCorta(2 * 86_400_000)).toBe('2 días')
    expect(duracionCorta(86_400_000)).toBe('1 día')
  })

  it('sin dato no dibuja un cero', () => {
    expect(duracionCorta(null)).toBe('—')
  })
})
