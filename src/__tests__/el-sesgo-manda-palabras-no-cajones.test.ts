/**
 * AL RECONOCEDOR SE LE MANDAN PALABRAS, NO NOMBRES DE CAJÓN — REG-187.
 *
 * ── EL DEFECTO ───────────────────────────────────────────────────────────────
 *
 * `especialidadesDelMedico()` y `CONTEXTOS_POR_MODULO` devuelven **nombres de
 * vocabulario**: «Microbiología y PROA», «Sepsis y choque», «Ventilación
 * mecánica». Esos nombres llegaban tal cual a `sesgo-diarizado`, que los mete en
 * la lista de términos con la que se sesga al reconocedor.
 *
 * En un pase de UCI se le decía al motor **«espera oír la frase *Sepsis y
 * choque*»** —que nadie pronuncia— en vez de «espera oír norepinefrina, CVVHDF,
 * RASS, FiO2». Medido antes de tocarlo:
 *
 *     UCI  · 4 nombres de cajón  →  67 términos reales
 *     PROA · 1 nombre            →  29 términos reales
 *
 * ── POR QUÉ DUELE MÁS QUE OTROS FALLOS ───────────────────────────────────────
 *
 * El sesgo es **lo único que cambia lo que la máquina OYE**. Una palabra que
 * nunca llegó al reconocedor no la recupera ningún corrector de después: el
 * corrector, el guardián y los avisos trabajan sobre lo ya oído. Es la misma
 * lección que dejó `Spiolto` (REG-179) — y esto es esa lección multiplicada por
 * todo el vocabulario de una especialidad.
 *
 * Tercera vez que aparece el patrón «el trabajo está hecho y no llega»: REG-167
 * (el sesgo degradaba el motor), v1025 (iba a la ruta de repuesto), y ésta.
 */
import { describe, it, expect } from 'vitest'
import { terminosDeEspecialidades, nombresDelModulo, CONTEXTOS_POR_MODULO } from '@/lib/asr/lexicon'
import { componerSesgo } from '@/lib/asr/sesgo-diarizado'

describe('un nombre de cajón se convierte en las palabras de dentro', () => {
  it('UCI: los cuatro nombres traen decenas de términos', () => {
    const nombres = [...nombresDelModulo('uci')]
    expect(nombres).toHaveLength(4)
    const terminos = terminosDeEspecialidades(nombres)
    // Medido el 6-ago-2026 sobre el vocabulario real del Dr.
    expect(terminos.length).toBeGreaterThanOrEqual(60)
  })

  it('y entre ellos están los que de verdad se dicen en un pase', () => {
    const t = terminosDeEspecialidades([...nombresDelModulo('uci')]).map(x => x.toLowerCase())
    for (const palabra of ['ckrt', 'cvvhdf', 'fio2']) {
      expect(t, `falta «${palabra}» en el sesgo de UCI`).toContain(palabra)
    }
  })

  it('PROA: el nombre del cajón trae el vocabulario de infectología', () => {
    const t = terminosDeEspecialidades(['Microbiología y PROA']).map(x => x.toLowerCase())
    expect(t.length).toBeGreaterThanOrEqual(25)
    for (const palabra of ['blee', 'hemocultivo', 'urocultivo']) {
      expect(t, `falta «${palabra}»`).toContain(palabra)
    }
  })

  it('un nombre que no existe en el catálogo no inventa términos', () => {
    // Sesgar hacia palabras que nadie va a decir empeora la transcripción, y no
    // se ve: se lee como una transcripción normal con un término cambiado.
    expect(terminosDeEspecialidades(['Astrofísica'])).toEqual([])
  })

  it('sin nombres, ningún término', () => {
    expect(terminosDeEspecialidades([])).toEqual([])
  })

  it('no repite lo que dos especialidades comparten', () => {
    const t = terminosDeEspecialidades([...nombresDelModulo('uci')])
    expect(new Set(t.map(x => x.toLowerCase())).size).toBe(t.length)
  })
})

describe('y llega de verdad al sesgo que se manda', () => {
  it('el nombre de cajón ya no viaja solo: viajan sus palabras', () => {
    const sesgo = componerSesgo({ especialidad: ['Microbiología y PROA'] }, [])
    const t = sesgo.terminos.map(x => x.toLowerCase())
    expect(t).toContain('hemocultivo')
  })

  it('el nombre se conserva ADEMÁS del contenido', () => {
    // Cuesta cuatro términos y alguna especialidad sí se dice en voz alta
    // («lo mando a infectología»).
    const sesgo = componerSesgo({ especialidad: ['Microbiología y PROA'] }, [])
    expect(sesgo.terminos).toContain('Microbiología y PROA')
  })

  it('lo del PACIENTE sigue yendo primero — el orden es la política', () => {
    const sesgo = componerSesgo({
      medicamentos: ['tigeciclina'],
      especialidad: ['Microbiología y PROA'],
    }, [])
    const iPaciente = sesgo.terminos.findIndex(x => x.toLowerCase() === 'tigeciclina')
    const iCatalogo = sesgo.terminos.findIndex(x => x.toLowerCase() === 'hemocultivo')
    expect(iPaciente).toBeGreaterThanOrEqual(0)
    expect(iPaciente).toBeLessThan(iCatalogo)
  })

  it('el presupuesto sigue mandando: nada se cuela por encima del tope', () => {
    const sesgo = componerSesgo({ especialidad: [...CONTEXTOS_POR_MODULO.uci] }, [])
    const caracteres = sesgo.terminos.reduce((n, t) => n + t.length + 1, 0)
    expect(caracteres).toBeLessThanOrEqual(5800)
  })
})

describe('lo que esto NO arregla, dicho claro', () => {
  it('una palabra que no está en el catálogo sigue sin llegar', () => {
    /**
     * El sesgo sólo puede ofrecer lo que alguien escribió antes. `Spiolto` no
     * estaba y por eso el motor oyó «Espiolto o espineto» (REG-179). Expandir
     * los nombres no crea vocabulario: hace que llegue el que ya existe.
     */
    expect(terminosDeEspecialidades(['Microbiología y PROA'])).not.toContain('palabra-que-nadie-escribio')
  })
})
