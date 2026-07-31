/**
 * REG-072 — la nota daba clase en vez de registrar.
 *
 * El Dr., sobre su propia nota: «¿para qué pones lo del Glasgow si no lo
 * necesita? Omítelo, es una nota médica, no tienes que explicar eso».
 *
 * La nota escribía, DENTRO del documento que se firma:
 *
 *   «Glasgow verbal no valorable por vía aérea artificial (reportar como “T”);
 *    seguir sedación por RASS.»
 *   «⚠ GCS 13 en paciente intubado es incoherente: el componente verbal NO es
 *    valorable (repórtalo como "T"). La conciencia con tubo se sigue por RASS.»
 *   «⚠ RASS -4: asociada a más días de ventilación y delirium; justifícala
 *    (HTIC, SDRA grave con bloqueo, estatus) o alígerala (PADIS 2018).»
 *
 * No es sólo estética. La nota es un documento **clínico-legal que el médico
 * firma**: un intensivista no necesita que le expliquen que el verbal no se
 * valora con tubo, y meter la lección en el expediente lo ensucia y lo alarga.
 *
 * El consejo NO se pierde — sigue íntegro en el panel de Alertas de la pantalla,
 * que es donde sirve: mientras trabaja, no en lo que firma.
 */
import { describe, it, expect } from 'vitest'
import { construirSeccionesUCI } from '@/lib/uci/nota'

const INTUBADO = {
  modo: 'AC-VC', soporte: 'si', glasgow: '13', rass: '-4', pupilas: 'isocoricas',
  fio2: '60', peep: '8', vt: '430', ph: '7.19', paco2: '32', lactato: '8.7',
}
const seccion = (v: Record<string, string>, key: string) =>
  construirSeccionesUCI(v, {}).find(s => s.key === key)?.value ?? ''

describe('REG-072 · la nota registra, no explica', () => {
  const neuro = seccion(INTUBADO, 'neurologico')

  it('no explica por qué el Glasgow no se valora con tubo', () => {
    expect(neuro).not.toMatch(/no valorable por vía aérea/i)
    expect(neuro).not.toMatch(/reportar como/i)
    expect(neuro).not.toMatch(/seguir sedación por RASS/i)
  })

  it('no mete banderas didácticas en el documento firmado', () => {
    const todo = construirSeccionesUCI(INTUBADO, {}).map(s => s.value).join('\n')
    expect(todo).not.toContain('⚠')
    expect(todo).not.toMatch(/justifícala|alígerala|PADIS/i)
  })

  it('en el intubado con GCS alto, sencillamente NO reporta Glasgow', () => {
    expect(neuro).not.toMatch(/Glasgow/i)
  })

  it('pero SÍ reporta lo que aplica: RASS y pupilas', () => {
    expect(neuro).toMatch(/RASS -4/)
    expect(neuro).toMatch(/isocoricas/i)
  })
})

describe('REG-072 · lo que NO se perdió', () => {
  it('un GCS BAJO en intubado sí se reporta — ahí el dato importa', () => {
    // Un coma con tubo se registra, con la convención aplicada y sin sermón.
    const n = seccion({ ...INTUBADO, glasgow: '6' }, 'neurologico')
    expect(n).toMatch(/Glasgow 6/)
    expect(n).toMatch(/verbal “T”/)
    expect(n).not.toMatch(/no valorable|seguir sedación/i)
  })

  it('sin tubo, el Glasgow se reporta normal', () => {
    const n = seccion({ glasgow: '13', rass: '0' }, 'neurologico')
    expect(n).toMatch(/Glasgow 13/)
  })

  it('los cálculos y sus interpretaciones SÍ se quedan: eso es dato, no lección', () => {
    const r = seccion({ ...INTUBADO, pplat: '23', ppico: '28' }, 'respiratorio')
    expect(r).toMatch(/Driving pressure 15/)
    expect(r).toMatch(/Compliance estática/)
  })

  it('la nota no queda vacía por quitar los avisos', () => {
    const llenas = construirSeccionesUCI(INTUBADO, {}).filter(s => s.value.trim())
    expect(llenas.length).toBeGreaterThanOrEqual(4)
  })
})
